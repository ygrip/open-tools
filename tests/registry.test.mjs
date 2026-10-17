import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, symlink, rm, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateManifest } from '../src/lib/registry/contract.js';
import { createGithubClient, loadSource, verifyBundle, MAX_BUNDLE_BYTES } from '../scripts/lib/bundles.mjs';

const html = Buffer.from('<!doctype html><html><body>Private tool</body></html>');
const manifest = {
  schemaVersion: 2, appearance: { theme: 'host', protocolVersion: 1 }, id: 'json-tools', path: '/json-tools', name: 'JSON Tools',
  description: 'Local JSON utilities', category: 'data', status: 'experimental',
  version: '0.1.0', repository: 'https://github.com/ygrip/json-tools', capabilities: ['json'],
  bundle: { format: 'html', file: 'dist/index.html', sha256: createHash('sha256').update(html).digest('hex') }
};
const config = { trustedOwners: ['ygrip'] };
const source = { repository: 'ygrip/json-tools', ref: 'a'.repeat(40) };

function remoteFile(bytes) {
  return { type: 'file', encoding: 'base64', size: bytes.length, content: bytes.toString('base64') };
}

test('contract strips private/unknown metadata and validates every published field', () => {
  assert.deepEqual(validateManifest({ ...manifest, secret: 'not public' }), validateManifest(manifest));
  assert.ok(!Object.hasOwn(validateManifest({ ...manifest, secret: 'not public' }), 'secret'));
  for (const patch of [
    { schemaVersion: 1 }, { schemaVersion: 3 }, { appearance: undefined },
    { appearance: { theme: 'independent', protocolVersion: 1 } },
    { appearance: { theme: 'host', protocolVersion: 2 } }, { id: '../oops' }, { id: 'policy', path: '/policy' },
    { path: '/privacy' }, { category: 'unknown' }, { status: 'unknown' }, { version: 'latest' }, { version: `${'1'.repeat(81)}.0.0` },
    { name: ' ' }, { name: [] }, { description: '' }, { capabilities: [1] },
    { repository: 'https://evil.example/tool' },
    { bundle: { ...manifest.bundle, file: '../secret.html' } },
    { bundle: { ...manifest.bundle, file: '/index.html' } },
    { bundle: { ...manifest.bundle, sha256: 'wrong' } }
  ]) assert.throws(() => validateManifest({ ...manifest, ...patch }), JSON.stringify(patch));
});

test('tool routes cannot shadow static namespaces or prerender filenames', () => {
  for (const id of ['brand', 'illustrations', 'index', '404', '500', '503', 'bundles', 'icons', 'offline', 'manifest', 'service-worker', 'pwa', 'id', 'og', 'robots', 'sitemap']) {
    assert.throws(() => validateManifest({ ...manifest, id, path: `/${id}` }), /reserved id/);
  }
});

test('integrity, byte limit, HTML and UTF-8 are checked before publication', () => {
  assert.equal(verifyBundle(html, manifest), html.toString());
  assert.throws(() => verifyBundle(Buffer.from('tampered'), manifest), /integrity/);
  assert.throws(() => verifyBundle(Buffer.alloc(MAX_BUNDLE_BYTES + 1), manifest), /size/);
  for (const bytes of [Buffer.from('not HTML'), Buffer.from([0xff])]) {
    assert.throws(() => verifyBundle(bytes, { bundle: { sha256: createHash('sha256').update(bytes).digest('hex') } }));
  }
});

test('private remote contents use build-only authentication and a pinned commit', async () => {
  const calls = [];
  const github = createGithubClient('private-read-token', async (url, options) => {
    calls.push({ url, options });
    const file = url.includes('tool.manifest.json') ? Buffer.from(JSON.stringify(manifest)) : html;
    return new Response(JSON.stringify(remoteFile(file)));
  });
  assert.deepEqual(await loadSource(source, config, '.', github), { manifest: validateManifest(manifest), html: html.toString() });
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.ok(call.url.endsWith(`?ref=${source.ref}`));
    assert.equal(call.options.headers.Authorization, 'Bearer private-read-token');
    assert.equal(call.options.redirect, 'error');
  }
  assert.ok(!JSON.stringify(manifest).includes('private-read-token'));
});

test('remote sources fail closed for untrusted owners, mutable refs and mismatched identity', async () => {
  await assert.rejects(loadSource({ ...source, repository: 'unknown/tool' }, config, '.', () => {}), /not trusted/);
  await assert.rejects(loadSource({ ...source, ref: 'main' }, config, '.', () => {}), /commit SHA/);
  await assert.rejects(loadSource(source, config, '.', async () => remoteFile(Buffer.from(JSON.stringify({ ...manifest, repository: 'https://github.com/ygrip/other' })))), /does not match/);
  const github = createGithubClient('token', async () => new Response('denied', { status: 403 }));
  await assert.rejects(loadSource(source, config, '.', github), /GitHub 403/);
});

test('remote files above 1 MiB use an immutable Git blob', async () => {
  const large = Buffer.from('<!doctype html>' + ' '.repeat(1024 * 1024));
  const largeManifest = { ...manifest, bundle: { ...manifest.bundle, sha256: createHash('sha256').update(large).digest('hex') } };
  const paths = [];
  const result = await loadSource(source, config, '.', async (path) => {
    paths.push(path);
    if (path.includes('tool.manifest.json')) return remoteFile(Buffer.from(JSON.stringify(largeManifest)));
    if (path.includes('/git/blobs/')) return remoteFile(large);
    return { type: 'file', encoding: 'none', size: large.length, sha: 'b'.repeat(40) };
  });
  assert.equal(result.html, large.toString());
  assert.ok(paths[2].endsWith(`/git/blobs/${'b'.repeat(40)}`));
});

test('failed sync preserves the last catalog rather than silently dropping a tool', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'open-tools-config-'));
  const output = new URL('../src/lib/registry/generated.json', import.meta.url);
  const before = await readFile(output, 'utf8');
  try {
    const configFile = join(directory, 'registry.json');
    await writeFile(configFile, JSON.stringify({ ...config, sources: [{ ...source, ref: 'main' }] }));
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/sync-tools.mjs', import.meta.url))], {
      encoding: 'utf8', env: { ...process.env, TOOLS_REGISTRY_CONFIG: configFile }
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /full commit SHA/);
    assert.equal(await readFile(output, 'utf8'), before);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('local scaffold loads offline and prevents symlink traversal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'open-tools-test-'));
  try {
    const directory = join(root, 'examples/json-tools');
    await mkdir(join(directory, 'dist'), { recursive: true });
    await writeFile(join(directory, 'tool.manifest.json'), JSON.stringify(manifest));
    await writeFile(join(directory, 'dist/index.html'), html);
    const local = { repository: source.repository, local: 'examples/json-tools' };
    assert.deepEqual(await loadSource(local, config, root), { manifest: validateManifest(manifest), html: html.toString() });
    await rm(join(directory, 'dist/index.html'));
    await writeFile(join(root, 'secret.html'), html);
    await symlink(join(root, 'secret.html'), join(directory, 'dist/index.html'));
    await assert.rejects(loadSource(local, config, root), /escapes/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
