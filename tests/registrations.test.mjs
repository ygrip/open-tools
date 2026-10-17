import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readToolRegistrations } from '../scripts/lib/registrations.mjs';

const ref = 'a'.repeat(40);
const config = { toolDirectory: 'config/tools' };

async function fixture(fn) {
  const root = await mkdtemp(join(tmpdir(), 'trick-it-tools-'));
  await mkdir(join(root, 'config/tools'), { recursive: true });
  try { return await fn(root, join(root, 'config/tools')); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test('registrations load deterministically without modifying a central array', async () => {
  await fixture(async (root, dir) => {
    await writeFile(join(dir, 'zulu.json'), JSON.stringify({ repository: 'ygrip/zulu', ref }));
    await writeFile(join(dir, 'alpha.json'), JSON.stringify({ repository: 'ygrip/alpha', ref }));
    assert.deepEqual(await readToolRegistrations(config, root), [
      { id: 'alpha', source: { repository: 'ygrip/alpha', ref } },
      { id: 'zulu', source: { repository: 'ygrip/zulu', ref } }
    ]);
  });
});

test('a tool cannot smuggle mutable refs, new properties, duplicates or invalid IDs', async () => {
  for (const bad of [
    { repository: 'ygrip/tool', ref: 'main' },
    { repository: 'ygrip/tool', ref, local: 'examples/tool' },
    { repository: 'ygrip/tool', ref, token: 'secret' },
    { repository: '../tool', ref },
    { repository: 'ygrip/tool' }
  ]) {
    await fixture(async (root, dir) => {
      await writeFile(join(dir, 'tool.json'), JSON.stringify(bad));
      await assert.rejects(readToolRegistrations(config, root), /invalid/);
    });
  }
  await fixture(async (root, dir) => {
    await writeFile(join(dir, 'alpha.json'), JSON.stringify({ repository: 'ygrip/tool', ref }));
    await writeFile(join(dir, 'beta.json'), JSON.stringify({ repository: 'YGRIP/TOOL', ref }));
    await assert.rejects(readToolRegistrations(config, root), /duplicate/);
  });
});

test('registration directory is confined to config and symlinks are rejected', async () => {
  await fixture(async (root, dir) => {
    await writeFile(join(dir, 'real.json'), JSON.stringify({ repository: 'ygrip/real', ref }));
    await symlink(join(dir, 'real.json'), join(dir, 'link.json'));
    await assert.rejects(readToolRegistrations(config, root), /filename/);
  });
  await fixture(async (root) => {
    await assert.rejects(readToolRegistrations({ toolDirectory: '../secrets' }, root), /beneath config/);
    await assert.rejects(readToolRegistrations({ toolDirectory: 'config/tools', sources: [] }, root), /must not be combined/);
  });
});

test('legacy alternate source configs still work but empty modern registries fail closed', async () => {
  assert.deepEqual(await readToolRegistrations({ sources: [{ repository: 'ygrip/fixture', ref }] }, '.'), [
    { id: null, source: { repository: 'ygrip/fixture', ref } }
  ]);
  await fixture(async (root) => assert.rejects(readToolRegistrations(config, root), /must contain/));
});
