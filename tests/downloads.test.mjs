import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/runtime/downloads.ts', import.meta.url))],
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'silent'
});
const { DownloadSessionManager } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

test('a cancelled save picker cannot resurrect an old tool session', async () => {
  const previousWindow = globalThis.window;
  globalThis.window = {};
  try {
    let resolvePicker;
    let aborted = 0;
    const file = { createWritable: async () => ({
      write: async () => {}, close: async () => {},
      abort: async () => { aborted++; }
    }) };
    const manager = new DownloadSessionManager(new Set(), () => new Promise(resolve => { resolvePicker = resolve; }));
    const info = { filename: 'export.zip', mime: 'application/zip', size: 10 };
    const first = manager.begin(info);
    await assert.rejects(manager.begin(info), error => error.code === 'busy');
    await manager.cancel();
    resolvePicker(file);
    await assert.rejects(first, error => error.code === 'aborted');
    assert.equal(aborted, 1);

    const retry = manager.begin(info);
    resolvePicker(file);
    const { streamId } = await retry;
    await manager.cancel(streamId);
    assert.equal(aborted, 2);
  } finally { globalThis.window = previousWindow; }
});

test('picker cancellation preserves aborted instead of leaking an old rejection', async () => {
  const previousWindow = globalThis.window;
  globalThis.window = {};
  try {
    let rejectPicker;
    const manager = new DownloadSessionManager(new Set(), () => new Promise((_, reject) => { rejectPicker = reject; }));
    const pending = manager.begin({ filename: 'export.zip', mime: 'application/zip', size: 10 });
    await manager.cancel();
    rejectPicker(new DOMException('Closed', 'AbortError'));
    await assert.rejects(pending, error => error.code === 'aborted');
  } finally { globalThis.window = previousWindow; }
});
