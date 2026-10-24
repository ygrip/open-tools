import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readToolArtifact, toolHostConfig } from './tool-harness/index.mjs';
import { parseManifestBytes } from '../scripts/lib/manifest.mjs';

function fixtureManifest(html) {
  return {
    schemaVersion: 3, runtimeVersion: 1, appearance: { theme: 'host', protocolVersion: 1 },
    id: 'fixture-tool', name: 'Fixture', description: 'Synthetic runtime fixture.',
    path: '/fixture-tool', repository: 'https://github.com/ygrip/fixture-tool',
    version: '1.0.0', category: 'developer', status: 'experimental', icon: 'braces',
    capabilities: [], permissions: [], assets: [], locales: ['en'], translations: {},
    seo: { title: 'Fixture', description: 'Synthetic fixture.', keywords: [], robots: 'noindex' },
    guide: { summary: 'Synthetic fixture.', steps: ['Open the fixture.'] },
    bundle: { format: 'html', file: 'dist/index.html', sha256: createHash('sha256').update(html).digest('hex') }
  };
}

test('shared tool harness reads the owning artifact and rejects stale or escaped bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'trick-it-host-test-'));
  const root = join(directory, 'tool');
  const html = '<!doctype html><h1>Synthetic runtime fixture</h1>';
  const manifest = fixtureManifest(html);
  const save = () => writeFile(join(root, 'tool.manifest.json'), JSON.stringify(manifest));
  try {
    await mkdir(join(root, 'dist'), { recursive: true });
    await writeFile(join(root, 'dist/index.html'), html); await save();
    assert.equal((await readToolArtifact(root)).html, html);
    await writeFile(join(root, 'dist/index.html'), html + 'changed');
    await assert.rejects(readToolArtifact(root), /integrity mismatch/);
    await writeFile(join(directory, 'outside.html'), html);
    manifest.bundle.file = '../outside.html'; await save();
    await assert.rejects(readToolArtifact(root), /relative, self-contained HTML file/);
    await symlink(join(directory, 'outside.html'), join(root, 'linked.html'));
    manifest.bundle.file = 'linked.html'; await save();
    await assert.rejects(readToolArtifact(root), /Unsafe/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

for (const [name, bytes, error] of [
  ['empty bundle', Buffer.alloc(0), /bundle size/],
  ['non-HTML bundle', Buffer.from('not an HTML document'), /HTML document/],
  ['invalid UTF-8 bundle', Buffer.from([0xff]), /utf-8/i],
  ['oversized bundle', Buffer.alloc(5 * 1024 * 1024 + 1), /size/]
]) test('harness rejects checksum-valid ' + name + ' using registry bundle validation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'trick-it-bundle-validation-'));
  try {
    await mkdir(join(root, 'dist'));
    await writeFile(join(root, 'dist/index.html'), bytes);
    await writeFile(join(root, 'tool.manifest.json'), JSON.stringify(fixtureManifest(bytes)));
    await assert.rejects(readToolArtifact(root), error);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('the harness reads verified repository locale packs and rejects corrupt or escaped copy', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'trick-it-pack-harness-'));
  const root = join(directory, 'tool');
  const html = '<!doctype html><title>Fixture</title>';
  const bytes = Buffer.from('{"title":"音楽"}');
  const digest = createHash('sha256').update(bytes).digest('hex');
  const manifest = {
    ...fixtureManifest(html), locales: ['en', 'ja'],
    localePacks: { ja: { file: 'dist/ja.json', sha256: digest, bytes: bytes.length } }
  };
  try {
    await mkdir(join(root, 'dist'), { recursive: true });
    await writeFile(join(root, 'tool.manifest.json'), JSON.stringify(manifest));
    await writeFile(join(root, 'dist/index.html'), html);
    await writeFile(join(root, 'dist/ja.json'), bytes);
    const artifact = await readToolArtifact(root);
    assert.deepEqual(artifact.localePacks.get(`/bundles/fixture-tool/locales/${digest}.json`), bytes);
    await writeFile(join(root, 'dist/ja.json'), Buffer.alloc(bytes.length));
    await assert.rejects(readToolArtifact(root), /integrity/);
    await rm(join(root, 'dist/ja.json'));
    await writeFile(join(directory, 'outside.json'), bytes);
    await symlink(join(directory, 'outside.json'), join(root, 'dist/ja.json'));
    await assert.rejects(readToolArtifact(root), /Unsafe locale pack symlink/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

for (const [name, translation, error] of [
  ['overlong catalog copy', { name: 'Fixture', description: 'x'.repeat(241) }, /translated description/],
  ['incomplete localized SEO', { name: 'Fixture', description: 'Fixture.', seo: { robots: 'noindex' } }, /seo title/]
]) test('harness rejects registry-invalid ' + name + ' before launching a tool', async () => {
  const root = await mkdtemp(join(tmpdir(), 'trick-it-full-manifest-'));
  try {
    const html = '<!doctype html><title>Fixture</title>';
    const manifest = fixtureManifest(html);
    manifest.locales = ['en', 'ja']; manifest.translations.ja = translation;
    await mkdir(join(root, 'dist'));
    await writeFile(join(root, 'dist/index.html'), html);
    await writeFile(join(root, 'tool.manifest.json'), JSON.stringify(manifest));
    await assert.rejects(readToolArtifact(root), error);
  } finally { await rm(root, { recursive: true, force: true }); }
});

for (const [name, bytes, error] of [
  ['oversized metadata bytes', Buffer.alloc(65_537), /manifest exceeds 64 KiB/],
  ['invalid UTF-8 metadata', Buffer.from([0xff]), /utf-8/i]
]) test('registry and harness parser reject ' + name, () => {
  assert.throws(() => parseManifestBytes(bytes), error);
});

test('tool suites run from their own repository without a second host Playwright instance', () => {
  const config = toolHostConfig({ toolRoot: '/own-tool', port: 4190 });
  assert.match(config.testDir, /own-tool.*tests.*host/);
  assert.equal(config.webServer.cwd, '/own-tool');
  assert.equal(config.webServer.command, 'node playwright.host.config.mjs --serve');
  assert.equal(config.webServer.reuseExistingServer, false);
  assert.equal(config.use.serviceWorkers, 'block');
  assert.throws(() => toolHostConfig({ toolRoot: '/own-tool', port: 0 }), /port/);
});
