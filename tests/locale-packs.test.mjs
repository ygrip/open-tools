import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateManifest, validateAssetOrigins } from '../src/lib/registry/contract.js';
import { localePackPath } from '../src/lib/registry/locale-packs.js';
import { createGithubClient, loadSource } from '../scripts/lib/bundles.mjs';
import { verifyLocalePack } from '../scripts/lib/locale-packs.mjs';
import { verifyRegistrySnapshot } from '../scripts/verify-registry-snapshot.mjs';

const host = fileURLToPath(new URL('../', import.meta.url));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const html = Buffer.from('<!doctype html><title>Locale fixture</title>');
const copy = Buffer.from(JSON.stringify({ title: '音楽', play: '再生' }));
const pack = { file: 'dist/locales/ja.json', sha256: hash(copy), bytes: copy.length };
const manifest = {
  schemaVersion: 3, runtimeVersion: 1, appearance: { theme: 'host', protocolVersion: 1 },
  id: 'locale-fixture', name: 'Locale Fixture', description: 'Synthetic locale fixture', path: '/locale-fixture',
  repository: 'https://github.com/ygrip/locale-fixture', version: '1.0.0', category: 'developer', status: 'experimental',
  capabilities: [], icon: 'braces', seo: { title: 'Fixture', description: 'Fixture', keywords: [], robots: 'noindex' },
  guide: { summary: 'Test copy.', steps: ['Select a language.'] }, permissions: [], assets: [], translations: {},
  locales: ['en', 'ja'], localePacks: { ja: pack },
  bundle: { format: 'html', file: 'dist/index.html', sha256: hash(html) }
};
const source = { repository: 'ygrip/locale-fixture', ref: 'a'.repeat(40) };
const config = { trustedOwners: ['ygrip'], trustedAssetOrigins: [] };
const remoteFile = bytes => ({ type: 'file', encoding: 'base64', size: bytes.length, content: bytes.toString('base64') });

test('repository packs need no external origin approval and URL packs remain compatible', () => {
  assert.deepEqual(validateManifest(manifest).localePacks.ja, pack);
  assert.doesNotThrow(() => validateAssetOrigins(validateManifest(manifest), []));
  const external = { ...pack, url: 'https://copy.example/ja.json' };
  delete external.file;
  const normalized = validateManifest({ ...manifest, localePacks: { ja: external } });
  assert.deepEqual(normalized.localePacks.ja, external);
  assert.throws(() => validateAssetOrigins(normalized, []), /not approved/);
  assert.doesNotThrow(() => validateAssetOrigins(normalized, ['https://copy.example']));
});

for (const file of ['../ja.json', '/ja.json', './ja.json', 'dist/../ja.json', 'dist\\ja.json', 'dist/%2e%2e/ja.json', 'https://evil.example/ja.json', 'dist/ja.js', 'dist/ja.json?token=secret']) {
  test(`unsafe repository locale path is rejected: ${file}`, () => {
    assert.throws(() => validateManifest({ ...manifest, localePacks: { ja: { ...pack, file } } }), /locale pack file/);
  });
}

for (const bad of [
  { ...pack, url: 'https://copy.example/ja.json' }, { sha256: pack.sha256, bytes: pack.bytes },
  { ...pack, bytes: 65_537 }, { ...pack, bytes: 0 }, { ...pack, sha256: 'bad' }, { ...pack, secret: 'not allowed' }
]) {
  test(`malformed locale descriptor is rejected: ${JSON.stringify(bad)}`, () => {
    assert.throws(() => validateManifest({ ...manifest, localePacks: { ja: bad } }));
  });
}

test('private locale bytes use the same build-only PAT and immutable repository commit as HTML', async () => {
  const calls = [];
  const github = createGithubClient('private-read-only-token', async (url, options) => {
    calls.push({ url, options });
    let bytes = html;
    if (url.includes('tool.manifest.json')) bytes = Buffer.from(JSON.stringify(manifest));
    if (url.includes('dist/locales/ja.json')) bytes = copy;
    return new Response(JSON.stringify(remoteFile(bytes)));
  });
  const loaded = await loadSource(source, config, '.', github);
  assert.deepEqual(loaded.localePacks.get(localePackPath(manifest.id, pack.sha256)), copy);
  assert.equal(calls.length, 3);
  for (const { url, options } of calls) {
    assert.ok(url.endsWith(`?ref=${source.ref}`));
    assert.equal(options.headers.Authorization, 'Bearer private-read-only-token');
    assert.equal(options.redirect, 'error');
  }
  assert.ok(!JSON.stringify(loaded.manifest).includes('private-read-only-token'));
});

for (const [name, bytes] of [
  ['invalid UTF-8', Buffer.from([255])], ['invalid JSON', Buffer.from('{')],
  ['array', Buffer.from('[]')], ['empty dictionary', Buffer.from('{}')],
  ['non-string message', Buffer.from('{"title":1}')], ['blank message', Buffer.from('{"title":" "}')]
]) {
  test(`${name}: source copy is rejected before publication`, () => {
    assert.throws(() => verifyLocalePack(bytes, { sha256: hash(bytes), bytes: bytes.length }));
  });
}

test('size and digest mismatches fail closed', () => {
  assert.throws(() => verifyLocalePack(copy, { ...pack, bytes: copy.length + 1 }), /size/);
  assert.throws(() => verifyLocalePack(copy, { ...pack, sha256: '0'.repeat(64) }), /integrity/);
  assert.throws(() => verifyLocalePack(Buffer.alloc(65_537), { sha256: '0'.repeat(64), bytes: 65_537 }), /size/);
});

test('local repository packs cannot escape through symlinks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'trick-it-pack-symlink-'));
  try {
    const tool = join(root, 'examples/locale-fixture');
    await mkdir(join(tool, 'dist/locales'), { recursive: true });
    await writeFile(join(tool, 'tool.manifest.json'), JSON.stringify(manifest));
    await writeFile(join(tool, 'dist/index.html'), html);
    await writeFile(join(root, 'outside.json'), copy);
    await symlink(join(root, 'outside.json'), join(tool, pack.file));
    await assert.rejects(loadSource({ repository: source.repository, local: 'examples/locale-fixture' }, config, root), /escapes/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('registry sync stages exact pack bytes, removes stale packs, and leaves the previous deployment on verification failure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'trick-it-pack-sync-'));
  try {
    for (const folder of ['scripts', 'src/lib/registry', 'config/tools', 'examples/locale-fixture/dist/locales']) {
      await mkdir(join(root, folder), { recursive: true });
    }
    for (const path of ['scripts/sync-tools.mjs', 'scripts/verify-registry-snapshot.mjs', 'scripts/lib', 'src/lib/languages.js', 'src/lib/registry/contract.js', 'src/lib/registry/locale-packs.js']) {
      await cp(join(host, path), join(root, path), { recursive: true });
    }
    await writeFile(join(root, 'package.json'), '{"type":"module"}');
    await writeFile(join(root, 'config/registry.json'), JSON.stringify({ ...config, toolDirectory: 'config/tools' }));
    await writeFile(join(root, 'config/tools/locale-fixture.json'), JSON.stringify({ repository: source.repository, local: 'examples/locale-fixture' }));
    const directory = join(root, 'examples/locale-fixture');
    await writeFile(join(directory, 'tool.manifest.json'), JSON.stringify(manifest));
    await writeFile(join(directory, 'dist/index.html'), html);
    await writeFile(join(directory, pack.file), copy);
    const sync = () => spawnSync(process.execPath, [join(root, 'scripts/sync-tools.mjs')], { cwd: root, encoding: 'utf8' });
    let result = sync();
    assert.equal(result.status, 0, result.stderr);
    const deployed = join(root, 'static' + localePackPath(manifest.id, pack.sha256));
    assert.deepEqual(await readFile(deployed), copy);
    await verifyRegistrySnapshot(root);
    await writeFile(deployed + '.stale', 'stale');
    result = sync();
    assert.equal(result.status, 0, result.stderr);
    await assert.rejects(readFile(deployed + '.stale'), { code: 'ENOENT' });
    const catalogPath = join(root, 'src/lib/registry/generated.json');
    const catalog = await readFile(catalogPath);
    assert.deepEqual(JSON.parse(catalog)[0].localePacks.ja, pack);
    await writeFile(deployed, 'corrupt deployment');
    await assert.rejects(verifyRegistrySnapshot(root), /changed/);
    await writeFile(deployed, copy);
    await writeFile(join(directory, pack.file), Buffer.alloc(copy.length));
    result = sync();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /locale pack integrity/);
    assert.deepEqual(await readFile(deployed), copy);
    assert.deepEqual(await readFile(catalogPath), catalog);
    await verifyRegistrySnapshot(root);
  } finally { await rm(root, { recursive: true, force: true }); }
});
