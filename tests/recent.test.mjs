import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/recent.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const store = new Map();
globalThis.localStorage = { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => store.set(key, String(value)), removeItem: (key) => store.delete(key) };
const recent = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('recent tools keep timestamps, stay readable from legacy ID lists and reject unsafe IDs', () => {
  store.set('trick-it:recent-tools', JSON.stringify(['json-tools', '../evil', { id: 'csv-tools', at: 5 }, 'json-tools', { id: 'x', at: 'soon' }]));
  assert.deepEqual(recent.readRecentEntries(), [{ id: 'json-tools' }, { id: 'csv-tools', at: 5 }, { id: 'x' }]);
  recent.recordRecentTool('csv-tools', 1000);
  assert.deepEqual(recent.readRecentEntries().slice(0, 2), [{ id: 'csv-tools', at: 1000 }, { id: 'json-tools' }]);
  assert.deepEqual(recent.readRecentTools(), ['csv-tools', 'json-tools', 'x']);
  store.set('trick-it:recent-tools', '{broken');
  assert.deepEqual(recent.readRecentEntries(), []);
});

test('relative time is compact and localized', () => {
  const now = Date.UTC(2026, 9, 18, 12);
  assert.equal(recent.relativeTime(undefined, 'en', now), '');
  assert.equal(recent.relativeTime(now - 10_000, 'en', now), 'now');
  assert.equal(recent.relativeTime(now - 5 * 60_000, 'en', now), '5 minutes ago');
  assert.equal(recent.relativeTime(now - 26 * 3_600_000, 'en', now), 'yesterday');
  assert.equal(recent.relativeTime(now - 3 * 3_600_000, 'id', now), '3 jam yang lalu');
});
