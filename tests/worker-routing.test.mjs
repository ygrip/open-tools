import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.mjs';

test('the Worker leaves ordinary static routes and missing pages to ASSETS', async () => {
  for (const path of ['/', '/id/seo-checker/', '/_app/file.js', '/missing/']) {
    const request = new Request('https://tools.readynaz.com' + path);
    const response = await worker.fetch(request, { ASSETS: { fetch: async received => { assert.equal(received, request); return new Response(path, { status: path === '/missing/' ? 404 : 200 }); } } });
    assert.equal(await response.text(), path);
    assert.equal(response.status, path === '/missing/' ? 404 : 200);
  }
});
test('the SEO endpoint is handled by the Worker before static 404 handling', async () => {
  const response = await worker.fetch(new Request('https://tools.readynaz.com/api/tools/seo-checker/audit'), {});
  assert.equal(response.status, 405);
});
