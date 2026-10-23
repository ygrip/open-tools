import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validateManifest, validateAssetOrigins, MAX_ASSET_BYTES, MAX_TOTAL_ASSET_BYTES } from '../src/lib/registry/contract.js';
import { loadSource, verifyBundle } from '../scripts/lib/bundles.mjs';
import { languageCodes } from '../src/lib/languages.js';

const example = JSON.parse(await readFile(new URL('../examples/tool.manifest.json', import.meta.url), 'utf8'));
const fresh = () => structuredClone(example);
const permission = (name) => ({ name, reason: 'Needed for this explicit feature.', required: false });
const asset = (patch = {}) => ({ id: 'model', url: 'https://models.example/model.wasm', sha256: 'a'.repeat(64), bytes: 8, type: 'wasm', defer: true, ...patch });
function withAssets() {
  return { ...fresh(), permissions: [permission('external-assets'), permission('wasm'), permission('workers')], assets: [asset()] };
}

test('v3 exposes only bounded public metadata and localized presentation', () => {
  const source = fresh();
  source.privateKey = 'never-publish';
  source.seo.privateKey = 'never-publish';
  source.guide.privateKey = 'never-publish';
  source.translations = { id: { name: 'Penghitung Teks', description: 'Hitung teks secara lokal.', guide: { summary: 'Tidak perlu izin.', steps: ['Masukkan teks.'] }, seo: { title: 'Penghitung Teks', description: 'Hitung teks di peramban.', keywords: ['teks'], robots: 'index' } } };
  const result = validateManifest(source);
  assert.equal(result.schemaVersion, 3);
  assert.equal(result.runtimeVersion, 1);
  assert.equal(result.icon, 'braces');
  assert.deepEqual(result.permissions, []);
  assert.deepEqual(result.assets, []);
  assert.equal(result.translations.id.name, 'Penghitung Teks');
  assert.ok(!JSON.stringify(result).includes('never-publish'));
});

test('tool content languages are explicit and default to English independently of metadata translations', () => {
  assert.deepEqual(validateManifest(fresh()).locales, ['en']);
  assert.deepEqual(validateManifest({ ...fresh(), locales: ['en', 'id'] }).locales, ['en', 'id']);
  assert.deepEqual(validateManifest({ ...fresh(), locales: languageCodes }).locales, languageCodes);
  assert.deepEqual(validateManifest({ ...fresh(), locales: ['id'] }).locales, ['id']);
  for (const locales of [[], ['en', 'en'], ['en', 'fr'], 'id']) assert.throws(() => validateManifest({ ...fresh(), locales }), /locales/);
});

test('translated permission reasons are bounded presentation, never additional authority', () => {
  const source = { ...fresh(), permissions: [permission('downloads')], translations: {
    ja: { name: 'テスト', description: 'ローカルで処理します。', permissionReasons: { downloads: '  結果を端末に保存します。  ' } }
  } };
  const result = validateManifest(source);
  assert.deepEqual(result.permissions, source.permissions);
  assert.deepEqual(result.translations.ja.permissionReasons, { downloads: '結果を端末に保存します。' });
});

for (const reasons of [null, [], { downloads: '' }, { downloads: 'x'.repeat(241) }, { downloads: 1 }, { downloads: { required: true } }, { workers: 'Not declared' }]) {
  test(`reject malformed translated permission reasons: ${JSON.stringify(reasons)}`, () => {
    assert.throws(() => validateManifest({ ...fresh(), permissions: [permission('downloads')], translations: {
      ja: { name: 'テスト', description: '説明', permissionReasons: reasons }
    } }), /permission reason|declared permission/);
  });
}

test('legacy v2 receives safe defaults but cannot silently opt into capabilities', () => {
  const source = fresh();
  source.schemaVersion = 2;
  for (const field of ['runtimeVersion', 'icon', 'seo', 'guide', 'permissions', 'assets', 'translations']) delete source[field];
  const result = validateManifest(source);
  assert.equal(result.runtimeVersion, 1);
  assert.equal(result.icon, 'toolbox');
  assert.equal(result.seo.title, source.name);
  assert.equal(result.guide.summary, source.description);
  assert.deepEqual([result.permissions, result.assets, result.translations], [[], [], {}]);
  assert.throws(() => validateManifest({ ...source, permissions: [permission('clipboard-read')] }), /schemaVersion 3/);
  assert.throws(() => validateManifest({ ...source, assets: [asset()] }), /schemaVersion 3/);
});

test('v3 requires complete, valid metadata and explicit supported protocol', () => {
  for (const field of ['runtimeVersion', 'icon', 'seo', 'guide', 'permissions', 'assets']) {
    const source = fresh();
    delete source[field];
    assert.throws(() => validateManifest(source), field);
  }
  for (const patch of [
    { runtimeVersion: 2 }, { icon: 'https://evil.example/icon.svg' }, { icon: '<svg>' },
    { seo: { ...example.seo, title: 'x'.repeat(101) } },
    { seo: { ...example.seo, description: 'x'.repeat(321) } },
    { seo: { ...example.seo, keywords: Array(11).fill('keyword') } },
    { seo: { ...example.seo, robots: 'anything' } },
    { guide: { summary: 'x'.repeat(501), steps: ['Step'] } },
    { guide: { summary: 'Summary', steps: [] } },
    { guide: { summary: 'Summary', steps: Array(13).fill('Step') } },
    { guide: { summary: 'Summary', steps: ['x'.repeat(501)] } },
    { translations: { fr: { name: 'Outil', description: 'Description' } } },
    { translations: { id: { name: '', description: 'Description' } } },
    { translations: { id: { name: 'Nama', description: 'Description', seo: { ...example.seo, robots: 'bad' } } } }
  ]) assert.throws(() => validateManifest({ ...fresh(), ...patch }));
});

test('permission descriptors reject unknown, duplicate, malformed or unbounded authority', () => {
  for (const permissions of [
    [permission('camera')], [permission('microphone')], [permission('allow-same-origin')],
    [permission('clipboard-read'), permission('clipboard-read')],
    [{ ...permission('downloads'), required: 'yes' }],
    [{ ...permission('downloads'), reason: '' }],
    [{ ...permission('downloads'), reason: 'x'.repeat(241) }],
    'clipboard-read', null
  ]) assert.throws(() => validateManifest({ ...fresh(), permissions }));
});

test('asset metadata rejects unsafe URLs, ambiguous IDs, digest/type/defer/size errors', () => {
  for (const url of ['http://models.example/model', '//models.example/model', 'javascript:alert(1)', 'data:application/wasm;base64,AA==', 'file:///tmp/model', 'https://user:private-secret@models.example/model', 'https://models.example/model#fragment', 'https://models.example\\evil/model', 'https://models.example/ model']) {
    assert.throws(() => validateManifest({ ...withAssets(), assets: [asset({ url })] }), (error) => !error.message.includes('private-secret'));
  }
  for (const patch of [{ id: '../model' }, { id: 'Uppercase' }, { sha256: 'A'.repeat(64) }, { sha256: 'latest' }, { bytes: 0 }, { bytes: 1.5 }, { bytes: MAX_ASSET_BYTES + 1 }, { type: 'html' }, { defer: 'true' }]) {
    assert.throws(() => validateManifest({ ...withAssets(), assets: [asset(patch)] }));
  }
  assert.throws(() => validateManifest({ ...withAssets(), assets: [asset(), asset()] }), /duplicate/);
  assert.throws(() => validateManifest({ ...withAssets(), assets: Array.from({ length: 17 }, (_, index) => asset({ id: `model-${index}` })) }), /invalid assets/);
  assert.throws(() => validateManifest({ ...withAssets(), assets: Array.from({ length: 3 }, (_, index) => asset({ id: `model-${index}`, bytes: MAX_ASSET_BYTES })) }), /total/);
  const result = validateManifest({ ...withAssets(), assets: [asset({ bytes: MAX_ASSET_BYTES }), asset({ id: 'second', bytes: MAX_ASSET_BYTES })] });
  assert.equal(result.assets.length, 2);
});

test('up to 128 MiB per asset with a separate 256 MiB aggregate ceiling', () => {
  assert.equal(MAX_ASSET_BYTES, 128 * 1024 * 1024);
  assert.equal(MAX_TOTAL_ASSET_BYTES, 256 * 1024 * 1024);
  const model = validateManifest({ ...withAssets(), assets: [asset({ bytes: 118 * 1024 * 1024 }), asset({ id: 'tokenizer', bytes: 17 * 1024 * 1024, type: 'data' })] });
  assert.equal(model.assets.length, 2);
  assert.throws(() => validateManifest({ ...withAssets(), assets: [asset({ bytes: MAX_ASSET_BYTES + 1 })] }), /byte limit/);
  assert.throws(() => validateManifest({ ...withAssets(), assets: [asset({ bytes: MAX_ASSET_BYTES }), asset({ id: 'b', bytes: MAX_ASSET_BYTES }), asset({ id: 'c', bytes: 1 })] }), /total/);
});

test('every asset capability must be declared independently of trust and required flags', () => {
  assert.throws(() => validateManifest({ ...withAssets(), permissions: [] }), /external-assets/);
  assert.throws(() => validateManifest({ ...withAssets(), permissions: [permission('external-assets')] }), /wasm/);
  assert.throws(() => validateManifest({ ...withAssets(), permissions: [permission('external-assets')], assets: [asset({ type: 'worker' })] }), /workers/);
  const result = validateManifest(withAssets());
  assert.equal(result.permissions[0].required, false);
});

test('registry approval is exact origin matching, never a hostname suffix or URL prefix', () => {
  const manifest = validateManifest(withAssets());
  validateAssetOrigins(manifest, ['https://models.example']);
  for (const origins of [[], ['https://example'], ['https://models.example.evil'], ['https://models.example/'], ['https://models.example/path'], ['http://models.example'], ['https://user:secret@models.example'], 'https://models.example']) {
    assert.throws(() => validateAssetOrigins(manifest, origins));
  }
  assert.throws(() => validateAssetOrigins({ ...manifest, assets: [asset({ url: 'https://models.example.evil/model' })] }, ['https://models.example']), /not approved/);
});

test('remote loading requires registry asset approval before downloading the tool bundle', async () => {
  const html = Buffer.from('<!doctype html><html><body>ML tool</body></html>');
  const manifest = { ...withAssets(), bundle: { format: 'html', file: 'dist/index.html', sha256: createHash('sha256').update(html).digest('hex') } };
  const file = (bytes) => ({ type: 'file', encoding: 'base64', size: bytes.length, content: bytes.toString('base64') });
  const calls = [];
  const github = async (path) => {
    calls.push(path);
    return file(path.includes('tool.manifest.json') ? Buffer.from(JSON.stringify(manifest)) : html);
  };
  const source = { repository: 'ygrip/text-counter', ref: 'a'.repeat(40) };
  await assert.rejects(loadSource(source, { trustedOwners: ['ygrip'] }, '.', github), /not approved/);
  assert.equal(calls.length, 1);
  const loaded = await loadSource(source, { trustedOwners: ['ygrip'], trustedAssetOrigins: ['https://models.example'] }, '.', github);
  assert.equal(loaded.manifest.assets[0].id, 'model');
  assert.ok(calls.every((path) => path.startsWith('/repos/ygrip/text-counter/')));
});

test('a UTF-8 BOM survives the JSON envelope so runtime rehashing checks the original bytes', () => {
  const bytes = Buffer.from('\ufeff<!doctype html><html><body>Unicode ✓</body></html>');
  const manifest = { bundle: { sha256: createHash('sha256').update(bytes).digest('hex') } };
  const html = verifyBundle(bytes, manifest);
  assert.equal(html.charCodeAt(0), 0xfeff);
  assert.deepEqual(Buffer.from(JSON.parse(JSON.stringify({ html })).html), bytes);
});
