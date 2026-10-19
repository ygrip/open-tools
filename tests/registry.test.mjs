import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, symlink, rm, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateManifest } from '../src/lib/registry/contract.js';
import { createGithubClient, loadSource, verifyBundle, verifyArtwork, artIconName, MAX_BUNDLE_BYTES } from '../scripts/lib/bundles.mjs';

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

const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([4, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(16)]);
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const entry = (file, bytes) => ({ file, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length });

test('artwork is validated: schema v3 only, exact fields, webp icon and png card', () => {
  const v3 = {
    runtimeVersion: 1, appearance: { theme: 'host', protocolVersion: 1 }, icon: 'braces',
    seo: { title: 'JSON Tools', description: 'Local JSON utilities', keywords: ['json'], robots: 'index' },
    guide: { summary: 'Format JSON.', steps: ['Paste JSON.'] }, permissions: [], assets: [], translations: {}
  };
  Object.assign(v3, { ...manifest, schemaVersion: 3 });
  const art = { icon: entry('assets/icon.webp', webp), card: entry('assets/card.png', png) };
  assert.deepEqual(validateManifest({ ...v3, artwork: art }).artwork, art);
  assert.equal(validateManifest(v3).artwork, undefined);
  for (const bad of [
    { icon: { ...art.icon, file: 'assets/icon.png' } }, { icon: { ...art.icon, bytes: 12_001 } }, { icon: { ...art.icon, sha256: 'x' } },
    { icon: { ...art.icon, file: '../icon.webp' } }, { icon: art.icon, card: { ...art.card, file: 'card.webp' } },
    { icon: art.icon, card: { ...art.card, bytes: 400_001 } }, { icon: art.icon, extra: 1 }, { card: art.card }
  ]) assert.throws(() => validateManifest({ ...v3, artwork: bad }), /artwork/, JSON.stringify(bad));
  assert.throws(() => validateManifest({ ...manifest, artwork: art }), /schemaVersion 3/);
});

test('artwork bytes must match size, digest and image container', () => {
  assert.equal(verifyArtwork(webp, entry('a.webp', webp), 'icon'), webp);
  assert.equal(verifyArtwork(png, entry('a.png', png), 'card'), png);
  assert.throws(() => verifyArtwork(Buffer.concat([webp, Buffer.from('x')]), entry('a.webp', webp), 'icon'), /size mismatch/);
  assert.throws(() => verifyArtwork(Buffer.alloc(webp.length), { ...entry('a.webp', webp) }, 'icon'), /integrity mismatch/);
  assert.throws(() => verifyArtwork(png, entry('a.webp', png), 'icon'), /not a WebP/);
  assert.throws(() => verifyArtwork(webp, entry('a.png', webp), 'card'), /not a PNG/);
});

test('icon file names are content-addressed so a changed icon busts caches', () => {
  const a = { id: 'json-tools', artwork: { icon: entry('a.webp', webp) } };
  const other = Buffer.concat([webp.subarray(0, -1), Buffer.from([1])]);
  const b = { id: 'json-tools', artwork: { icon: entry('a.webp', other) } };
  assert.match(artIconName(a), /^json-tools\.[a-f0-9]{12}\.webp$/);
  assert.notEqual(artIconName(a), artIconName(b));
});
