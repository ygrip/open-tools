import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPwaUpdate, canAutoRefreshCatalog } from '../src/lib/pwa-update.js';

class FakeWorker extends EventTarget {
  constructor(state) { super(); this.state = state; this.messages = []; }
  transition(state) { this.state = state; this.dispatchEvent(new Event('statechange')); }
  postMessage(message) { this.messages.push(message); queueMicrotask(() => this.transition('activated')); }
}

test('SPA-only release refreshes after an update check with no replacement worker', async () => {
  let calls = 0;
  await applyPwaUpdate({ update: async () => { calls++; }, installing: null, waiting: null });
  assert.equal(calls, 1);
});

test('waiting service worker activates after explicit approval', async () => {
  const worker = new FakeWorker('installed');
  const registration = { update: async () => {}, installing: null, waiting: worker };
  await applyPwaUpdate(registration);
  assert.deepEqual(worker.messages, [{ type: 'trick-it:activate', version: 1 }]);
  assert.equal(worker.state, 'activated');
});

test('new service worker finishes precaching before activation', async () => {
  const worker = new FakeWorker('installing');
  const registration = { installing: worker, waiting: null, update: async () => {
    throw new Error('already installing: duplicate update check');
  } };
  queueMicrotask(() => { registration.waiting = worker; worker.transition('installed'); });
  const phases = [];
  await applyPwaUpdate(registration, { onPhase: (phase) => phases.push(phase) });
  assert.equal(worker.state, 'activated');
  assert.equal(worker.messages.length, 1);
  assert.deepEqual(phases, ['checking', 'downloading', 'activating', 'ready']);
});

test('failed essential precache keeps the current app and reports failure', async () => {
  const worker = new FakeWorker('installing');
  const registration = { installing: worker, waiting: null, update: async () => {
    throw new Error('already installing: duplicate update check');
  } };
  queueMicrotask(() => worker.transition('redundant'));
  await assert.rejects(applyPwaUpdate(registration, { installTimeoutMs: 2_000 }), /could not install/);
  assert.equal(worker.messages.length, 0);
});

test('activation that never finishes raises a retryable timeout', async () => {
  const worker = new FakeWorker('installed');
  worker.postMessage = (message) => worker.messages.push(message);
  await assert.rejects(applyPwaUpdate(
    { update: async () => {}, installing: null, waiting: worker },
    { activationTimeoutMs: 10 }
  ), /Timed out/);
});

test('automatic refresh is limited to an idle catalog, never a running tool', () => {
  assert.equal(canAutoRefreshCatalog('/'), true);
  assert.equal(canAutoRefreshCatalog('/id/'), true);
  assert.equal(canAutoRefreshCatalog('/tools/', '/tools'), true);
  assert.equal(canAutoRefreshCatalog('/tools/id/', '/tools'), true);
  assert.equal(canAutoRefreshCatalog('/', '', true), false);
  assert.equal(canAutoRefreshCatalog('/json-tools/'), false);
  assert.equal(canAutoRefreshCatalog('/id/json-tools/'), false);
});

test('ongoing installation is reused instead of starting another network check', async () => {
  const worker = new FakeWorker('installing');
  let updateCalls = 0;
  const registration = {
    installing: worker, waiting: null,
    update: async () => { updateCalls++; }
  };
  queueMicrotask(() => { registration.waiting = worker; worker.transition('installed'); });
  const phases = [];
  await applyPwaUpdate(registration, { onPhase: (phase) => phases.push(phase) });
  assert.equal(updateCalls, 0);
  assert.deepEqual(phases, ['checking', 'downloading', 'activating', 'ready']);
  assert.equal(worker.state, 'activated');
});
