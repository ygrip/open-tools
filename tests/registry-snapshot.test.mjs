import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeRegistrySnapshot, verifyRegistrySnapshot } from '../scripts/verify-registry-snapshot.mjs';

test('the verified build rejects mutated pins, trust policy and catalog', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'trick-it-registry-'));
  try {
    await mkdir(join(dir, 'config/tools'), { recursive: true });
    await mkdir(join(dir, 'src/lib/registry'), { recursive: true });
    await mkdir(join(dir, 'scripts'), { recursive: true });
    for (const path of ['static/bundles', 'static/icons/tools', 'scripts/.generated-tool-cards']) await mkdir(join(dir, path), { recursive: true });
    const config = join(dir, 'config/registry.json');
    const pin = join(dir, 'config/tools/tool.json');
    const catalog = join(dir, 'src/lib/registry/generated.json');
    await writeFile(config, JSON.stringify({ toolDirectory: 'config/tools', trustedOwners: ['ygrip'] }));
    await writeFile(pin, JSON.stringify({ repository: 'ygrip/tool', ref: 'a'.repeat(40) }));
    await writeFile(catalog, '[]');
    await assert.rejects(verifyRegistrySnapshot(dir), /missing/);
    await writeRegistrySnapshot(dir);
    await verifyRegistrySnapshot(dir);
    await writeFile(pin, JSON.stringify({ repository: 'ygrip/tool', ref: 'b'.repeat(40) }));
    await assert.rejects(verifyRegistrySnapshot(dir), /changed/);
    await writeRegistrySnapshot(dir);
    await writeFile(catalog, '[{}]');
    await assert.rejects(verifyRegistrySnapshot(dir), /changed/);
    await writeRegistrySnapshot(dir);
    await writeFile(config, JSON.stringify({ toolDirectory: 'config/tools', trustedOwners: ['other'] }));
    await assert.rejects(verifyRegistrySnapshot(dir), /changed/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

async function fixture(run, config = { toolDirectory: 'config/tools' }) {
  const dir = await mkdtemp(join(tmpdir(), 'trick-it-registry-'));
  try {
    for (const path of ['config/tools', 'src/lib/registry', 'scripts/.generated-tool-cards', 'static/bundles/tool', 'static/icons/tools'])
      await mkdir(join(dir, path), { recursive: true });
    await writeFile(join(dir, 'config/registry.json'), JSON.stringify(config));
    await writeFile(join(dir, 'config/tools/tool.json'), JSON.stringify({ repository: 'ygrip/tool', ref: 'a'.repeat(40) }));
    await writeFile(join(dir, 'src/lib/registry/generated.json'), '[]');
    for (const path of ['static/bundles/tool/bundle.json', 'static/icons/tools/tool.png', 'scripts/.generated-tool-cards/tool.png'])
      await writeFile(join(dir, path), 'verified bytes');
    await run(dir);
  } finally { await rm(dir, { recursive: true, force: true }); }
}

for (const output of ['static/bundles/tool/bundle.json', 'static/icons/tools/tool.png', 'scripts/.generated-tool-cards/tool.png']) {
  test(`verified builds reject missing, corrupt and extra output paths in ${output}`, async () => {
    await fixture(async dir => {
      await writeRegistrySnapshot(dir);
      await verifyRegistrySnapshot(dir);
      await writeFile(join(dir, output), 'corrupt');
      await assert.rejects(verifyRegistrySnapshot(dir), /changed/);
      await writeFile(join(dir, output), 'verified bytes');
      await verifyRegistrySnapshot(dir);
      await rm(join(dir, output));
      await assert.rejects(verifyRegistrySnapshot(dir), /changed/);
      await writeFile(join(dir, output), 'verified bytes');
      await writeFile(join(dir, output + '.extra'), 'unexpected published bytes');
      await assert.rejects(verifyRegistrySnapshot(dir), /changed/);
    });
  });
}

test('verified builds support legacy sources and fingerprint their full alternate config', async () => {
  const config = { sources: [{ repository: 'ygrip/tool', ref: 'a'.repeat(40) }], trustedOwners: ['ygrip'] };
  await fixture(async dir => {
    const path = 'config/alternate.json';
    await writeFile(join(dir, path), JSON.stringify(config));
    await writeRegistrySnapshot(dir, path);
    await verifyRegistrySnapshot(dir, path);
    await writeFile(join(dir, path), JSON.stringify({ ...config, sources: [{ repository: 'ygrip/tool', ref: 'b'.repeat(40) }] }));
    await assert.rejects(verifyRegistrySnapshot(dir, path), /changed/);
  }, config);
});

test('snapshot generation retains per-tool registration validation', async () => {
  await fixture(async dir => {
    await writeFile(join(dir, 'config/tools/tool.json'), JSON.stringify({ repository: 'ygrip/tool', ref: 'main' }));
    await assert.rejects(writeRegistrySnapshot(dir), /invalid pinned commit SHA/);
  });
});
