import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { readToolArtifact, toolHostConfig } from './tool-harness/index.mjs';

test('shared tool harness reads the owning artifact and rejects stale or escaped bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'trick-it-host-test-'));
  const root = join(directory, 'tool');
  const html = '<!doctype html><h1>Synthetic runtime fixture</h1>';
  const manifest = { schemaVersion: 3, runtimeVersion: 1, id: 'fixture-tool', version: '1.0.0', bundle: { format: 'html', file: 'dist/index.html', sha256: createHash('sha256').update(html).digest('hex') } };
  const save = () => writeFile(join(root, 'tool.manifest.json'), JSON.stringify(manifest));
  try {
    await mkdir(join(root, 'dist'), { recursive: true });
    await writeFile(join(root, 'dist/index.html'), html); await save();
    assert.equal((await readToolArtifact(root)).html, html);
    await writeFile(join(root, 'dist/index.html'), html + 'changed');
    await assert.rejects(readToolArtifact(root), /checksum/);
    await writeFile(join(directory, 'outside.html'), html);
    manifest.bundle.file = '../outside.html'; await save();
    await assert.rejects(readToolArtifact(root), /Unsafe/);
    await symlink(join(directory, 'outside.html'), join(root, 'linked.html'));
    manifest.bundle.file = 'linked.html'; await save();
    await assert.rejects(readToolArtifact(root), /Unsafe/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('the harness reads verified repository locale packs and rejects corrupt or escaped copy', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'trick-it-pack-harness-'));
  const root = join(directory, 'tool');
  const html = '<!doctype html><title>Fixture</title>';
  const bytes = Buffer.from('{"title":"音楽"}');
  const digest = createHash('sha256').update(bytes).digest('hex');
  const manifest = {
    schemaVersion: 3, runtimeVersion: 1, id: 'fixture-tool', version: '1.0.0',
    bundle: { file: 'dist/index.html', sha256: createHash('sha256').update(html).digest('hex') },
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

test('tool suites run from their own repository without a second host Playwright instance', () => {
  const config = toolHostConfig({ toolRoot: '/own-tool', port: 4190 });
  assert.match(config.testDir, /own-tool.*tests.*host/);
  assert.equal(config.webServer.cwd, '/own-tool');
  assert.equal(config.webServer.command, 'node playwright.host.config.mjs --serve');
  assert.equal(config.webServer.reuseExistingServer, false);
  assert.equal(config.use.serviceWorkers, 'block');
  assert.throws(() => toolHostConfig({ toolRoot: '/own-tool', port: 0 }), /port/);
});
