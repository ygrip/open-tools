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

test('tool suites run from their own repository without a second host Playwright instance', () => {
  const config = toolHostConfig({ toolRoot: '/own-tool', port: 4190 });
  assert.match(config.testDir, /own-tool.*tests.*host/);
  assert.equal(config.webServer.cwd, '/own-tool');
  assert.equal(config.webServer.command, 'node playwright.host.config.mjs --serve');
  assert.equal(config.webServer.reuseExistingServer, false);
  assert.equal(config.use.serviceWorkers, 'block');
  assert.throws(() => toolHostConfig({ toolRoot: '/own-tool', port: 0 }), /port/);
});
