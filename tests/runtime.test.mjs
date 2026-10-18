import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/runtime/core.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { sha256, loadBundle, loadAsset, assetRequestUrl, parseRuntimeRequest, runService } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const html = '<!doctype html><title>Safe tool</title>';
const htmlHash = await sha256(new TextEncoder().encode(html));
const tool = { schemaVersion: 3, id: 'fixture', name: 'Fixture', version: '1.0.0', bundle: { sha256: htmlHash }, permissions: [], assets: [] };
const controller = () => new AbortController();
const response = (value) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

test('bundle loader verifies exact HTML bytes, identity, version and SHA before rendering', async () => {
  const valid = { id: tool.id, version: tool.version, sha256: htmlHash, html };
  assert.equal(await loadBundle(tool, '/bundle', controller().signal, async () => response(valid)), html);
  for (const invalid of [{ ...valid, id: 'other' }, { ...valid, version: '0.9.0' }, { ...valid, sha256: '0'.repeat(64) }, { ...valid, html: html + '<script>bad()</script>' }, { html }]) {
    await assert.rejects(loadBundle(tool, '/bundle', controller().signal, async () => response(invalid)), (error) => ['invalid-bundle', 'integrity'].includes(error.code));
  }
  assert.equal(await loadBundle({ ...tool, schemaVersion: 2 }, '/bundle', controller().signal, async () => response({ html })), html);
  await assert.rejects(loadBundle(tool, '/bundle', controller().signal, async () => new Response('private server details', { status: 503 })), (error) => error.status === 503 && !error.message.includes('private'));
  const abort = controller(); abort.abort();
  await assert.rejects(loadBundle(tool, '/bundle', abort.signal, async () => response(valid)), (error) => error.code === 'aborted');
});

test('BOM-containing UTF-8 HTML preserves the exact digest', async () => {
  const bomHtml = '\ufeff' + html;
  const hash = await sha256(new TextEncoder().encode(bomHtml));
  const bomTool = { ...tool, bundle: { sha256: hash } };
  assert.equal(await loadBundle(bomTool, '/bundle', controller().signal, async () => response({ id: tool.id, version: tool.version, sha256: hash, html: bomHtml })), bomHtml);
});

const model = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
const modelHash = await sha256(model);
const asset = { id: 'model', url: 'https://models.example/model.wasm', sha256: modelHash, bytes: model.length, type: 'wasm', defer: true };
function memoryCache() {
  const values = new Map();
  const cache = { match: async (key) => values.get(key)?.clone(), put: async (key, value) => { values.set(key, value.clone()); }, delete: async (key) => values.delete(key) };
  return { values, cache, storage: { open: async () => cache } };
}
test('asset loader sends no credentials, pins cache keys and never uses unverified bytes', async () => {
  const cache = memoryCache(); let calls = 0;
  const fetcher = async (url, options) => {
    calls++;
    assert.equal(new URL(url).searchParams.get('trick-it-sha256'), modelHash);
    assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error'); assert.equal(options.referrerPolicy, 'no-referrer');
    return new Response(model);
  };
  assert.deepEqual(await loadAsset(tool, asset, { signal: controller().signal, fetcher, cacheStorage: cache.storage }), model);
  assert.equal(calls, 1);
  assert.deepEqual(await loadAsset(tool, asset, { signal: controller().signal, fetcher, cacheStorage: cache.storage }), model);
  assert.equal(calls, 1);
  cache.values.set(assetRequestUrl(asset), new Response(new Uint8Array(model.length)));
  const warnings = [];
  assert.deepEqual(await loadAsset(tool, asset, { signal: controller().signal, fetcher, cacheStorage: cache.storage, onWarning: (value) => warnings.push(value) }), model);
  assert.equal(calls, 2); assert.ok(warnings.includes('cache-corrupt'));
  await assert.rejects(loadAsset(tool, asset, { signal: controller().signal, cacheStorage: null, fetcher: async () => new Response(new Uint8Array(model.length)) }), (error) => error.code === 'integrity');
  await assert.rejects(loadAsset(tool, asset, { signal: controller().signal, cacheStorage: null, fetcher: async () => new Response(new Uint8Array(model.length + 1)) }), (error) => error.code === 'size');
});
test('storage denial is explicit but does not discard a verified download', async () => {
  const warnings = [];
  assert.deepEqual(await loadAsset(tool, asset, { signal: controller().signal, cacheStorage: { open: async () => { throw new Error('private storage failure'); } }, fetcher: async () => new Response(model), onWarning: (value) => warnings.push(value) }), model);
  assert.deepEqual(warnings, ['cache-unavailable']);
  const cache = memoryCache(); cache.cache.put = async () => { throw new Error('quota exceeded'); };
  assert.deepEqual(await loadAsset(tool, asset, { signal: controller().signal, cacheStorage: cache.storage, fetcher: async () => new Response(model), onWarning: (value) => warnings.push(value) }), model);
  assert.equal(warnings.at(-1), 'cache-unavailable');
});
test('private and no-store model responses remain usable but never persist offline', async () => {
  for (const policy of ['private', 'no-store']) {
    const cache = memoryCache(); const warnings = [];
    assert.deepEqual(await loadAsset(tool, asset, { signal: controller().signal, cacheStorage: cache.storage, fetcher: async () => new Response(model, { headers: { 'cache-control': policy } }), onWarning: (value) => warnings.push(value) }), model);
    assert.equal(cache.values.size, 0);
    assert.deepEqual(warnings, ['cache-unavailable']);
  }
});
test('asset timeout aborts the request and reports a safe reason', async () => {
  await assert.rejects(loadAsset(tool, asset, { signal: controller().signal, timeoutMs: 1, cacheStorage: null,
    fetcher: async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('private timeout detail')), { once: true }))
  }), (error) => error.code === 'timeout' && !error.message.includes('private'));
  for (const invalid of ['http://models.example/x', 'https://user:secret@models.example/x', 'https://models.example/x#fragment', 'file:///etc/passwd']) {
    assert.throws(() => assetRequestUrl({ ...asset, url: invalid }), /invalid-asset/);
  }
});
test('broker rejects wrong windows, wrong tokens, undeclared and ungranted capabilities', () => {
  const frame = {}; const token = 'private-channel';
  const fixture = { ...tool, permissions: [{ name: 'external-assets' }, { name: 'wasm' }, { name: 'clipboard-write' }], assets: [asset] };
  const event = (operation, payload, changes = {}) => ({ source: frame, data: { type: 'trick-it:request', version: 1, token, id: 'request-1', operation, payload, ...changes } });
  assert.equal(parseRuntimeRequest({ ...event('asset', { id: 'model' }), source: {} }, frame, token, fixture, ['external-assets', 'wasm']), null);
  assert.equal(parseRuntimeRequest(event('asset', { id: 'model' }, { token: 'wrong' }), frame, token, fixture, ['external-assets', 'wasm']), null);
  assert.equal(parseRuntimeRequest(event('asset', { id: 'model' }, { id: '<invalid>' }), frame, token, fixture, ['external-assets', 'wasm']), null);
  assert.equal(parseRuntimeRequest(event('asset', { id: 'model' }), frame, token, fixture, ['external-assets']).error, 'denied');
  assert.equal(parseRuntimeRequest(event('asset', { id: 'model' }), frame, token, fixture, ['external-assets', 'wasm']).asset.id, 'model');
  assert.equal(parseRuntimeRequest(event('asset', { id: 'unknown', url: 'https://attacker.example' }), frame, token, fixture, ['external-assets', 'wasm']).error, 'invalid-request');
  assert.equal(parseRuntimeRequest(event('clipboard-read'), frame, token, fixture, ['clipboard-read']).error, 'denied');
  assert.equal(parseRuntimeRequest(event('clipboard-write', 'text'), frame, token, fixture, []).error, 'denied');
  assert.equal(parseRuntimeRequest(event('clipboard-write', { text: 'wrong shape' }), frame, token, fixture, ['clipboard-write']).error, 'invalid-request');
  assert.equal(parseRuntimeRequest(event('clipboard-write', 'text'), frame, token, fixture, ['clipboard-write']).error, undefined);
  assert.equal(parseRuntimeRequest(event('camera'), frame, token, fixture, ['camera']).error, 'unsupported');
});
test('camera capture requires a grant and image share is PNG-only', () => {
  const frame = {}; const fixture = { ...tool, permissions: [{ name: 'camera-capture' }, { name: 'share-image' }] };
  const parse = (operation, payload, grants = ['camera-capture', 'share-image']) =>
    parseRuntimeRequest({ source: frame, data: { type: 'trick-it:request', version: 1, token: 'channel', id: '1', operation, ...(payload === undefined ? {} : { payload }) } }, frame, 'channel', fixture, grants);
  assert.equal(parse('camera-capture').error, undefined);
  assert.equal(parse('camera-capture', { watch: true }).error, 'invalid-request');
  assert.equal(parse('camera-capture', undefined, []).error, 'denied');
  assert.equal(parse('share-image', { filename: 'qr.png', mime: 'image/png', bytes: new ArrayBuffer(16) }).error, undefined);
  assert.equal(parse('share-image', { filename: 'qr.svg', mime: 'image/svg+xml', bytes: new ArrayBuffer(16) }).error, 'invalid-request');
});

test('download payloads are bounded and cannot contain paths or executable host actions', () => {
  const frame = {}; const fixture = { ...tool, permissions: [{ name: 'downloads' }] };
  const parse = (payload) => parseRuntimeRequest({ source: frame, data: { type: 'trick-it:request', version: 1, token: 'channel', id: '1', operation: 'downloads', payload } }, frame, 'channel', fixture, ['downloads']);
  const payload = { bytes: new ArrayBuffer(8), filename: 'result.json', mime: 'application/json' };
  assert.equal(parse(payload).error, undefined);
  assert.equal(parse({ ...payload, filename: 'qr.png', mime: 'image/png' }).error, undefined);
  assert.equal(parse({ ...payload, filename: 'qr.svg', mime: 'image/svg+xml' }).error, undefined);
  assert.equal(parse({ ...payload, filename: '../escape' }).error, 'invalid-request');
  assert.equal(parse({ ...payload, bytes: new ArrayBuffer(16 * 1024 * 1024 + 1) }).error, 'invalid-request');
  assert.equal(parse({ ...payload, mime: 'application/javascript' }).error, 'invalid-request');
});

test('SEO audit broker requires a grant and validates its narrow payload', () => {
  const frame = {}; const token = 'secure-session';
  const seoTool = { ...tool, services: [{ id: 'audit', handler: 'pagespeed-seo' }], permissions: [{ name: 'services', required: true, reason: 'Audit a public page with Google' }] };
  const request = { type: 'trick-it:request', version: 1, token, id: 'seo-1', operation: 'services', payload: { feature: 'audit', input: { url: 'https://example.com', strategy: 'mobile', locale: 'id' } } };
  const parse = (payload, grants = ['services']) => parseRuntimeRequest({ source: frame, data: { ...request, payload } }, frame, token, seoTool, grants);
  assert.equal(parse(request.payload).error, undefined);
  assert.equal(parse(request.payload, []).error, 'denied');
  for (const payload of [{ ...request.payload, endpoint: 'https://evil.example' }, { ...request.payload, feature: 'missing' }, { ...request.payload, input: { url: 'file:///etc/passwd' } }]) assert.equal(parse(payload).error, 'invalid-request');
});


test('SEO service client preserves zero scores, handles quota and aborts stale work', async () => {
  const report = { score: 0, audits: [{ id: 'document-title', score: 0 }] };
  const payload = { url: 'https://example.com/', strategy: 'mobile', locale: 'en' };
  assert.equal((await runService('/api/tools/seo-checker/audit', payload, controller().signal, async (url, options) => {
    assert.equal(url, '/api/tools/seo-checker/audit'); assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
    assert.deepEqual(JSON.parse(options.body), payload); return response(report);
  })).score, 0);
  await assert.rejects(runService('/api/tools/seo-checker/audit', payload, controller().signal, async () => new Response('secret', { status: 429 })), error => error.code === 'quota');
  await assert.rejects(runService('/api/tools/seo-checker/audit', payload, controller().signal, async () => response(null)), error => error.code === 'request');
  const abort = controller(); abort.abort();
  await assert.rejects(runService('/api/tools/seo-checker/audit', payload, abort.signal), error => error.code === 'aborted');
});
