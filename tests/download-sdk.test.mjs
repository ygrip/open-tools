import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const { outputFiles } = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/registry/sandbox.ts', import.meta.url))],
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'silent' });
const { sandboxDocument } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);

function sdk(nativeDownloads = true) {
  const token = 'test-download-channel';
  const html = sandboxDocument('<p>Fixture</p>', 'light', { token, permissions: ['downloads'], nativeDownloads });
  const receivers = [], messages = [];
  const parent = { postMessage(message, origin, transfer = []) {
    messages.push({ ...message, transfer });
    const value = message.operation === 'download-begin' ? { streamId: 'fixture-stream', mode: nativeDownloads ? 'stream' : 'buffered' } : undefined;
    queueMicrotask(() => { for (const receive of receivers) receive({ source: parent,
      data: { type: 'trick-it:response', version: 1, token, id: message.id, ok: true, value } }); });
  } };
  const window = {};
  vm.runInNewContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], {
    window, parent, ArrayBuffer, Uint8Array, setTimeout, clearTimeout,
    HTMLElement: class { focus() {} },
    document: { documentElement: { dataset: {}, style: {} }, hasFocus: () => false },
    addEventListener: (type, receive) => { if (type === 'message') receivers.push(receive); }
  });
  return { api: window.trickIt, messages, cancelFromHost: () => {
    for (const receive of receivers) receive({ source: parent, data: { type: 'trick-it:download-cancelled', version: 1, token, streamId: 'fixture-stream' } });
  } };
}

test('legacy large downloads are automatically transferred in bounded chunks with acknowledged progress', async () => {
  const { api, messages } = sdk();
  const size = 17 * 1024 * 1024, progress = [];
  const bytes = new ArrayBuffer(size);
  await api.request('downloads', { filename: 'legacy.gif', mime: 'image/gif', bytes }, value => progress.push(value));
  assert.equal(messages[0].operation, 'download-begin');
  assert.equal(messages[0].payload.size, size);
  const chunks = messages.filter(m => m.operation === 'download-chunk');
  assert.equal(chunks.length, 17);
  assert.ok(chunks.every(m => m.payload.bytes.byteLength === api.downloadLimits.chunkBytes && m.transfer[0] === m.payload.bytes));
  assert.equal(bytes.byteLength, size, 'the producer buffer is preserved');
  assert.equal(progress[1].loaded, api.downloadLimits.chunkBytes);
  assert.equal(progress.at(-1).phase, 'complete');
  assert.equal(progress.at(-1).loaded, size);
});

test('SDK advertises the actual browser limit and rejects oversized exports before prompting', async () => {
  const native = sdk(), buffered = sdk(false);
  assert.equal(native.api.downloadLimits.maxBytes, 8 * 1024 ** 3);
  assert.equal(buffered.api.downloadLimits.maxBytes, 256 * 1024 ** 2);
  async function* chunks() { yield new Uint8Array(1); }
  await assert.rejects(buffered.api.downloadStream({ filename: 'large.zip', mime: 'application/zip', size: 256 * 1024 ** 2 + 1, chunks: chunks() }), error => error.code === 'size');
  assert.equal(buffered.messages.length, 0);
});

test('cancellation and a short producer both send cleanup instead of committing a partial export', async () => {
  const { api, messages } = sdk();
  const controller = new AbortController();
  async function* chunks() { yield new Uint8Array(1024 * 1024); yield new Uint8Array(1024 * 1024); }
  await assert.rejects(api.downloadStream({ filename: 'cancel.zip', mime: 'application/zip', size: 2 * 1024 * 1024,
    chunks: chunks(), signal: controller.signal, onProgress: value => { if (value.loaded) controller.abort(); } }), error => error.code === 'aborted');
  assert.equal(messages.filter(m => m.operation === 'download-chunk').length, 1);
  assert.ok(messages.some(m => m.operation === 'download-cancel'));
  assert.ok(!messages.some(m => m.operation === 'download-end'));
  const short = sdk();
  await assert.rejects(short.api.downloadStream({ filename: 'short.zip', mime: 'application/zip', size: 3 * 1024 * 1024, chunks: chunks() }));
  assert.equal(short.messages.at(-1).operation, 'download-cancel');
});

test('AbortSignal immediately rejects a paused producer without waiting for another chunk', async () => {
  const { api, messages } = sdk();
  const controller = new AbortController();
  let started;
  const pulling = new Promise(resolve => { started = resolve; });
  async function* chunks() { started(); await new Promise(() => {}); yield new Uint8Array(1); }
  const result = api.downloadStream({ filename: 'paused.zip', mime: 'application/zip', size: 1, chunks: chunks(), signal: controller.signal }).then(() => 'saved', error => error.code);
  await pulling;
  controller.abort();
  assert.equal(await Promise.race([result, new Promise(resolve => setTimeout(() => resolve('still pending'), 20))]), 'aborted');
  assert.ok(messages.some(m => m.operation === 'download-cancel'));
});

test('host cancellation also releases a paused producer without another chunk', async () => {
  const { api, cancelFromHost } = sdk();
  let started; const pulling = new Promise(resolve => { started = resolve; });
  async function* chunks() { started(); await new Promise(() => {}); yield new Uint8Array(1); }
  const result = api.downloadStream({ filename: 'paused.zip', mime: 'application/zip', size: 1, chunks: chunks() }).then(() => 'saved', error => error.code);
  await pulling; cancelFromHost();
  assert.equal(await Promise.race([result, new Promise(resolve => setTimeout(() => resolve('still pending'), 20))]), 'aborted');
});
