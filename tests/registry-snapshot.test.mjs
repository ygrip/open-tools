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
