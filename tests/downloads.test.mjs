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

test('overlapping chunks and finish cannot race an outstanding write', { timeout: 1000 }, async () => {
  globalThis.window = {};
  let resolveWrite; let committed = 0; let written = 0;
  const writer = {
    write: bytes => new Promise(resolve => { resolveWrite = () => { written += bytes.byteLength; resolve(); }; }),
    close: async () => { committed = written; }, abort: async () => {}
  };
  const manager = new DownloadSessionManager(new Set(), async () => ({ createWritable: async () => writer }));
  const { streamId } = await manager.begin({ filename: 'race.bin', mime: 'application/octet-stream', size: 10 });
  const first = manager.append({ streamId, bytes: new ArrayBuffer(10) });
  await assert.rejects(manager.append({ streamId, bytes: new ArrayBuffer(6) }), error => error.code === 'busy');
  await assert.rejects(manager.finish(streamId), error => error.code === 'busy');
  resolveWrite(); await first;
  await manager.finish(streamId);
  assert.equal(committed, 10);
});

test('a cancelled old write cannot abort a newly started export', { timeout: 1000 }, async () => {
  globalThis.window = {};
  let rejectWrite; let newAborts = 0;
  let files = 0;
  const manager = new DownloadSessionManager(new Set(), async () => ({ createWritable: async () => ++files === 1 ? {
    write: () => new Promise((_, reject) => { rejectWrite = reject; }), abort: async () => {}, close: async () => {}
  } : { write: async () => {}, abort: async () => { newAborts++; }, close: async () => {} } }));
  const info = { filename: 'cancel.bin', mime: 'application/octet-stream', size: 10 };
  const first = await manager.begin(info);
  const write = manager.append({ streamId: first.streamId, bytes: new ArrayBuffer(10) });
  await manager.cancel(first.streamId);
  const second = await manager.begin(info);
  rejectWrite(new Error('old stream aborted'));
  await assert.rejects(write, error => error.code === 'aborted');
  await manager.append({ streamId: second.streamId, bytes: new ArrayBuffer(10) });
  await manager.finish(second.streamId);
  assert.equal(newAborts, 0);
});

test('buffered browsers accept the 200 MiB GIF export and reject beyond the advertised fallback', async () => {
  globalThis.window = {};
  const manager = new DownloadSessionManager(new Set());
  const info = { filename: 'large.gif', mime: 'image/gif', size: 200 * 1024 * 1024 };
  const stream = await manager.begin(info);
  assert.equal(stream.mode, 'buffered');
  await manager.cancel(stream.streamId);
  await assert.rejects(manager.begin({ ...info, size: 256 * 1024 * 1024 + 1 }), error => error.code === 'size');
});

test('host progress reports acknowledged bytes and completion only after close', async () => {
  globalThis.window = {};
  const updates = [];
  let close;
  const manager = new DownloadSessionManager(new Set(), async () => ({ createWritable: async () => ({
    write: async () => {}, abort: async () => {}, close: () => new Promise(resolve => { close = resolve; })
  }) }), value => { if (value) updates.push({ ...value }); });
  const { streamId } = await manager.begin({ filename: 'progress.bin', mime: 'application/octet-stream', size: 4 });
  await manager.append({ streamId, bytes: new ArrayBuffer(2) });
  assert.equal(updates.at(-1)?.loaded, 2);
  assert.equal(updates.at(-1)?.total, 4);
  await manager.append({ streamId, bytes: new ArrayBuffer(2) });
  const end = manager.finish(streamId);
  assert.equal(updates.at(-1).phase, 'finishing');
  close(); await end;
  assert.equal(updates.at(-1).phase, 'complete');
});

test('native streams accept multi-GiB declarations and reject above 8 GiB before opening a file', async () => {
  globalThis.window = {};
  let opened = 0;
  const manager = new DownloadSessionManager(new Set(), async () => { opened++; return { createWritable: async () => ({ abort: async () => {} }) }; });
  const info = { filename: 'large.zip', mime: 'application/zip', size: 4 * 1024 ** 3 };
  const stream = await manager.begin(info);
  assert.equal(stream.mode, 'stream');
  await manager.cancel(stream.streamId);
  await assert.rejects(manager.append({ streamId: stream.streamId, bytes: new ArrayBuffer(1) }), error => error.code === 'aborted');
  await assert.rejects(manager.begin({ ...info, size: 8 * 1024 ** 3 + 1 }), error => error.code === 'size');
  assert.equal(opened, 1);
});
