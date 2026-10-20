import test from 'node:test';
import assert from 'node:assert/strict';
import { pruneAssetCaches, touchAssetCache } from '../src/lib/runtime/asset-cache.js';

function store() {
  const values = new Map();
  return { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}
function caches(entries) {
  const all = new Map(Object.entries(entries));
  return {
    keys: async () => [...all.keys()],
    open: async key => ({ keys: async () => all.get(key).map((_, i) => new Request('https://example.org/' + i)),
      match: async req => all.get(key)[Number(new URL(req.url).pathname.slice(1))] }),
    delete: async key => all.delete(key),
    has: key => all.has(key)
  };
}
const response = bytes => new Response('', { headers: { 'x-trick-it-asset-bytes': String(bytes) } });

test('evicts only stale tool asset versions, never the current cache or shell', async () => {
  const meta = store();
  const a = caches({
    'trick-it-assets-old': [response(100)], 'trick-it-assets-current': [response(100)],
    'trick-it-shell-v1': [response(100)]
  });
  const result = await pruneAssetCaches(a, 'trick-it-assets-current', { now: 2_000_000_000, budgetBytes: 120, metadataStore: meta });
  assert.deepEqual(result.deleted, ['trick-it-assets-old']);
  assert.equal(a.has('trick-it-assets-current'), true);
  assert.equal(a.has('trick-it-shell-v1'), true);
});

test('recently used releases are retained even when over budget', async () => {
  const meta = store(); const now = Date.now();
  touchAssetCache('trick-it-assets-old', now, meta);
  const a = caches({ 'trick-it-assets-old': [response(100)], 'trick-it-assets-current': [response(100)] });
  const result = await pruneAssetCaches(a, 'trick-it-assets-current', { now, budgetBytes: 10, metadataStore: meta });
  assert.deepEqual(result.deleted, []);
});

test('unknown legacy entry sizes are conservatively accounted for', async () => {
  const meta = store();
  const a = caches({ 'trick-it-assets-legacy': [new Response('legacy')], 'trick-it-assets-current': [response(100)] });
  const result = await pruneAssetCaches(a, 'trick-it-assets-current', { now: Date.now(), budgetBytes: 1000, metadataStore: meta });
  assert.deepEqual(result.deleted, ['trick-it-assets-legacy']);
});
