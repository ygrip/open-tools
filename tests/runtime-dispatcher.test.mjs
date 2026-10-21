import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/runtime/dispatcher.ts', import.meta.url))],
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'silent'
});
const { classifyRuntimeMessage } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const { outputFiles: sessionBundles } = await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/runtime/session.ts', import.meta.url))],
  bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'silent'
});
const { RuntimeSession } = await import(`data:text/javascript;base64,${Buffer.from(sessionBundles[0].text).toString('base64')}`);

function harness() {
  const session = new RuntimeSession();
  session.start();
  const frameWindow = {};
  const tool = { id: 'fixture', permissions: [], assets: [] };
  const options = { session, frameWindow, frameReady: true, tool, grants: [] };
  const message = (id, operation = 'ui-toast') => ({
    source: frameWindow,
    data: { type: 'trick-it:request', version: 1, token: session.token, id, operation,
      payload: operation === 'ui-toast' ? { message: 'Hello', tone: 'info' } : undefined }
  });
  return { session, options, message, frameWindow };
}

test('session renewal revokes the old token, aborts requests and clears replay state', () => {
  const session = new RuntimeSession();
  const first = session.start();
  const token = session.token;
  session.inFlight.add('open');
  session.seen.add('open');
  session.brokerBusy = true;
  const second = session.start();
  assert.equal(first.signal.aborted, true);
  assert.equal(second.signal.aborted, false);
  assert.notEqual(session.token, token);
  assert.equal(session.inFlight.size, 0);
  assert.equal(session.seen.size, 0);
  assert.equal(session.brokerBusy, false);
  session.stop();
  assert.equal(second.signal.aborted, true);
  assert.equal(session.token, '');
});

test('dispatcher rejects spoofed frames, stale sessions and replayed requests', () => {
  const { session, options, message } = harness();
  assert.equal(classifyRuntimeMessage({ ...message('a'), source: {} }, options).kind, 'ignore');
  assert.equal(classifyRuntimeMessage({ ...message('a'), data: { ...message('a').data, token: 'wrong' } }, options).kind, 'ignore');
  assert.equal(classifyRuntimeMessage(message('a'), options).kind, 'dispatch');
  assert.deepEqual(classifyRuntimeMessage(message('a'), options), { kind: 'reject', request: message('a').data, error: 'invalid-request' });
  session.inFlight.add('a');
  assert.equal(classifyRuntimeMessage(message('a'), options).kind, 'ignore');
  session.stop();
  assert.equal(classifyRuntimeMessage(message('new'), options).kind, 'ignore');
});

test('resize requests require exact session and sandbox window, with tight bounds', () => {
  const { options, session, frameWindow } = harness();
  const resize = height => ({ source: frameWindow, data: { type: 'trick-it:resize', version: 1, token: session.token, height } });
  assert.deepEqual(classifyRuntimeMessage(resize(201), options), { kind: 'resize', height: 203 });
  assert.deepEqual(classifyRuntimeMessage(resize(1), options), { kind: 'resize', height: 200 });
  assert.equal(classifyRuntimeMessage(resize(100_001), options).kind, 'ignore');
  assert.equal(classifyRuntimeMessage({ ...resize(201), source: {} }, options).kind, 'ignore');
});

test('burst protection refuses a new operation and allows stream cancellation', () => {
  const { session, options, message } = harness();
  for (let i = 0; i < 16; i++) session.inFlight.add('q' + i);
  assert.deepEqual(classifyRuntimeMessage(message('new'), options).kind, 'reject');
  // A declared, granted cancellation remains possible while the broker is busy.
  options.tool.permissions.push({ name: 'downloads', required: false, reason: 'Save a file' });
  options.grants.push('downloads');
  const cancel = message('cancel', 'download-cancel');
  cancel.data.payload = { streamId: 'run' };
  assert.equal(classifyRuntimeMessage(cancel, options).kind, 'dispatch');
});
