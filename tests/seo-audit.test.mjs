import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAudit, normalizeReport, validateTarget } from '../worker/seo-audit.mjs';
const result = { lighthouseResult: { finalUrl: 'https://example.com/', fetchTime: '2026-10-18T02:00:00.000Z', lighthouseVersion: '13.0.0', categories: { seo: { score: 0.72, auditRefs: [{ id: 'document-title', weight: 1 }, { id: 'structured-data', weight: 0 }] } }, audits: { 'document-title': { score: 0, scoreDisplayMode: 'binary', title: 'Missing title', description: 'Add a title', details: { items: [{ node: { snippet: '<html onclick="alert(1)">' } }] } }, 'structured-data': { score: null, scoreDisplayMode: 'manual', title: 'Structured data' }, irrelevant: { score: 0 } } } };
const env = { SEO_RATE_LIMITER: { limit: async () => ({ success: true }) } };
const req = (body = { url: 'https://example.com/', strategy: 'mobile', locale: 'id' }, headers = {}) => new Request('https://tools.readynaz.com/api/seo-audit', { method: 'POST', headers: { origin: 'https://tools.readynaz.com', 'content-type': 'application/json', 'cf-connecting-ip': '1.2.3.4', ...headers }, body: JSON.stringify(body) });
test('only public HTTP(S) URLs without credentials are accepted', () => {
  assert.equal(validateTarget('https://example.com/post#section'), 'https://example.com/post');
  for (const url of ['file:///etc/passwd', 'https://user:pass@example.com', 'https://127.0.0.1', 'http://0x7f000001', 'https://[::1]', 'https://localhost', 'https://metadata.google.internal', 'https://x.local', 'https://example.com:8080', 'https://example.com/?token=secret']) assert.throws(() => validateTarget(url));
});
test('normalization keeps only category audits, nullable scores and inert bounded evidence', () => {
  const report = normalizeReport(result);
  assert.equal(report.score, 72);
  assert.equal(report.audits.length, 2);
  assert.equal(report.audits[1].score, null);
  assert.equal(report.audits[0].evidence[0], '<html onclick="alert(1)">');
  assert.throws(() => normalizeReport({ lighthouseResult: { runtimeError: { code: 'NO_FCP' } } }));
  assert.throws(() => normalizeReport({ lighthouseResult: { categories: { seo: { score: null } } } }));
});
test('endpoint contacts only fixed Google API, with locale, category and server-side secret', async () => {
  const response = await handleAudit(req(), { ...env, PAGESPEED_API_KEY: 'test-key' }, async (url, options) => {
    assert.equal(url.origin, 'https://www.googleapis.com');
    assert.equal(url.pathname, '/pagespeedonline/v5/runPagespeed');
    assert.equal(url.searchParams.get('category'), 'SEO');
    assert.equal(url.searchParams.get('locale'), 'id');
    assert.equal(url.searchParams.get('key'), 'test-key');
    // Workers' fetch throws on 'error'; a redirect must surface as a non-ok response.
    assert.equal(options.redirect, 'manual');
    return Response.json(result);
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).score, 72);
});
test('endpoint rejects cross-origin, extra fields, private URLs and oversized bodies without provider calls', async () => {
  let calls = 0; const fetcher = async () => { calls++; return Response.json(result); };
  assert.equal((await handleAudit(req(undefined, { origin: 'https://evil.example' }), env, fetcher)).status, 403);
  assert.equal((await handleAudit(req({ url: 'https://localhost' }), env, fetcher)).status, 400);
  assert.equal((await handleAudit(req({ url: 'https://example.com', key: 'override' }), env, fetcher)).status, 400);
  assert.equal((await handleAudit(req({ url: 'a'.repeat(6000) }), env, fetcher)).status, 413);
  assert.equal(calls, 0);
});
test('quota and failed audits have safe errors', async () => {
  assert.equal((await handleAudit(req(), env, async () => new Response('private error test-key', { status: 429 }))).status, 429);
  assert.equal((await handleAudit(req(), env, async () => Response.json({ lighthouseResult: { runtimeError: {} } }))).status, 502);
});
