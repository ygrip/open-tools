import test from 'node:test';
import assert from 'node:assert/strict';
import { cacheableRequest, cacheableResponse } from '../src/lib/pwa-policy.js';
import { readFile } from 'node:fs/promises';

const origin = 'https://trick-it.example';
const paths = new Set(['/', '/id/', '/_app/immutable/a.js']);
const accepts = (path, method, auth) => cacheableRequest(new URL(path, origin), origin, paths, method, auth);
test('offline cache accepts only explicit public files or digest-pinned tool releases', () => {
  assert.ok(accepts('/id/'));
  assert.ok(accepts(`/bundles/json-tools/${'a'.repeat(64)}.json?version=0.3.0`));
  for (const path of ['/private', '/?token=secret', 'https://models.example/model.wasm', `/bundles/x/${'a'.repeat(64)}.json?version=1.0.0&token=secret`, '/bundles/x/latest.json']) assert.equal(accepts(path), false);
  assert.equal(accepts('/', 'POST'), false);
  assert.equal(accepts('/', 'GET', true), false);
});
test('private, varying, and failed responses never enter the offline cache', () => {
  assert.ok(cacheableResponse(new Response('ok')));
  assert.ok(cacheableResponse(new Response('ok', { headers: { vary: 'Accept-Encoding' } })));
  for (const status of [401, 404, 500, 503]) assert.equal(cacheableResponse(new Response('error', { status })), false);
  for (const headers of [{ 'cache-control': 'no-store' }, { 'cache-control': 'private' }, { vary: 'Cookie' }, { vary: '*' }, { 'set-cookie': 'private=yes' }]) assert.equal(cacheableResponse(new Response('private', { headers })), false);
});
test('PWA metadata and service-worker lifecycle require an explicit update action', async () => {
  const manifest = JSON.parse(await readFile(new URL('../static/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.name, 'trick-it');
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) assert.ok((await readFile(new URL(`../static/${icon.src}`, import.meta.url))).length);
  const worker = await readFile(new URL('../src/service-worker.ts', import.meta.url), 'utf8');
  assert.ok(worker.includes("event.data?.type !== 'trick-it:activate'"));
  assert.ok(!worker.includes('clients.claim('));
});
