import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { validateManifest, validateAssetOrigins } from '../../src/lib/registry/contract.js';

export const MAX_BUNDLE_BYTES = 5 * 1024 * 1024;

export function verifyBundle(bytes, manifest) {
  if (!bytes.length || bytes.length > MAX_BUNDLE_BYTES) throw new Error('bundle size must be 1 byte to 5 MiB');
  if (createHash('sha256').update(bytes).digest('hex') !== manifest.bundle.sha256) throw new Error('bundle integrity mismatch');
  const html = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  if (!/<!doctype html/i.test(html)) throw new Error('bundle must be an HTML document');
  return html;
}

export function createGithubClient(credentials, fetcher = fetch) {
  const scoped = credentials && typeof credentials !== 'string';
  if (scoped && (typeof credentials.forRepository !== 'function' || typeof credentials.forOwner !== 'function')) throw new Error('invalid GitHub credential resolver');
  return async function github(path, context = {}) {
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || /[\\\s\x00-\x1f\x7f#]/.test(path)) throw new Error('invalid GitHub API path');
    let token = scoped ? undefined : credentials;
    if (scoped) {
      const url = new URL(`https://api.github.com${path}`);
      const repository = url.pathname.match(/^\/repos\/([a-zA-Z0-9][a-zA-Z0-9-]{0,38}\/[a-zA-Z0-9_.-]+)(?:\/|$)/)?.[1];
      if (repository) token = await credentials.forRepository(repository);
      else if (url.pathname === '/search/repositories') {
        const owner = context.owner;
        if (url.searchParams.getAll('q').length !== 1) throw new Error('discovery requires exactly one owner-scoped query');
        const terms = (url.searchParams.get('q') || '').split(/\s+/);
        const scopes = terms.filter((term) => /^(?:user|org):/i.test(term));
        if (typeof owner !== 'string' || scopes.length !== 1 || scopes[0].toLowerCase() !== `user:${owner.toLowerCase()}` || terms.some((term) => !/^(?:user:[a-zA-Z0-9-]+|topic:[a-zA-Z0-9-]+|fork:false|archived:false)$/i.test(term))) throw new Error('discovery requires exactly its credential owner scope');
        token = await credentials.forOwner(owner);
      } else throw new Error('GitHub credential context is not a repository or owner discovery request');
    }
    let response;
    try {
      response = await fetcher(`https://api.github.com${path}`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'open-tools-registry', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        redirect: 'error', signal: AbortSignal.timeout(30_000)
      });
    } catch { throw new Error('GitHub request failed'); }
    if (!response.ok) throw new Error(`GitHub ${response.status}: ${path}`);
    if (!response.body) throw new Error('empty GitHub response');
    const reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    let tooLarge = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BUNDLE_BYTES * 2) {
          tooLarge = true;
          await reader.cancel();
          throw new Error('GitHub response too large');
        }
        chunks.push(value);
      }
    } catch { throw new Error(tooLarge ? 'GitHub response too large' : 'GitHub response could not be read'); }
    finally { reader.releaseLock(); }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new Error('GitHub response is not valid JSON'); }
  };
}

export async function loadSource(source, config, root, github) {
  if (!source || typeof source.repository !== 'string' || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(source.repository)) throw new Error('invalid source repository');
  if (!config.trustedOwners.some((owner) => owner.toLowerCase() === source.repository.split('/')[0].toLowerCase())) throw new Error('repository owner is not trusted');
  let read;
  if (source.local) {
    if (typeof source.local !== 'string' || !source.local.startsWith('examples/')) throw new Error('local source must be under examples/');
    const examplesRoot = await realpath(resolve(root, 'examples'));
    const directory = await realpath(resolve(root, source.local));
    if (!directory.startsWith(examplesRoot + sep)) throw new Error('local source escapes examples/');
    read = async (file) => {
      const target = await realpath(resolve(directory, file));
      if (!target.startsWith(directory + sep)) throw new Error('bundle escapes source directory');
      const info = await stat(target);
      if (!info.isFile() || info.size > MAX_BUNDLE_BYTES) throw new Error('expected regular file within size limit');
      return readFile(target);
    };
  } else {
    if (!/^[a-f0-9]{40}$/.test(source.ref ?? '')) throw new Error('remote sources require a full commit SHA');
    read = async (file) => {
      const path = file.split('/').map(encodeURIComponent).join('/');
      let result = await github(`/repos/${source.repository}/contents/${path}?ref=${source.ref}`);
      if (result.type !== 'file' || !Number.isInteger(result.size) || result.size > MAX_BUNDLE_BYTES) throw new Error('expected file within size limit');
      // Contents API omits base64 data above 1 MiB; the immutable blob API supports our 5 MiB limit.
      if (result.encoding === 'none' && /^[a-f0-9]{40}$/.test(result.sha ?? '')) {
        result = await github(`/repos/${source.repository}/git/blobs/${result.sha}`);
      }
      if (result.encoding !== 'base64' || typeof result.content !== 'string' || !Number.isInteger(result.size) || result.size > MAX_BUNDLE_BYTES) throw new Error('expected base64 file within size limit');
      const bytes = Buffer.from(result.content.replace(/\n/g, ''), 'base64');
      if (bytes.length !== result.size) throw new Error('GitHub file size mismatch');
      return bytes;
    };
  }
  const manifestBytes = await read('tool.manifest.json');
  if (manifestBytes.length > 64 * 1024) throw new Error('manifest exceeds 64 KiB');
  const manifest = validateManifest(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes)));
  if (manifest.repository.toLowerCase() !== `https://github.com/${source.repository}`.toLowerCase()) throw new Error('manifest repository does not match source');
  validateAssetOrigins(manifest, config.trustedAssetOrigins);
  return { manifest, html: verifyBundle(await read(manifest.bundle.file), manifest) };
}
