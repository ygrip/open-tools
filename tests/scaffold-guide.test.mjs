import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { validateManifest } from '../src/lib/registry/contract.js';
import { scaffoldFiles } from './scaffold-recipe.mjs';

const execute = promisify(execFile);

test('documented scaffold builds, passes its own smoke test, and satisfies the actual contract', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'open-tools-scaffold-'));
  try {
    for (const [path, contents] of await scaffoldFiles()) {
      await mkdir(dirname(join(directory, path)), { recursive: true });
      await writeFile(join(directory, path), contents);
    }
    await execute('npm', ['test', '--prefix', directory], { timeout: 30_000 });
    const manifest = validateManifest(JSON.parse(await readFile(join(directory, 'tool.manifest.json'), 'utf8')));
    const bytes = await readFile(join(directory, manifest.bundle.file));
    assert.equal(manifest.bundle.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.notEqual(manifest.bundle.sha256, '0'.repeat(64));
    assert.equal(manifest.id, 'text-counter');
    assert.deepEqual(bytes, await readFile(join(directory, 'src/index.html')));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
