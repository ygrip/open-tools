import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

function moduleUrl(source) {
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const errorsUrl = moduleUrl(await readFile(new URL('../src/lib/errors.ts', import.meta.url), 'utf8'));
const { errorPresentation, reportUnexpectedError } = await import(errorsUrl);

test('global errors have friendly status-specific messages and illustrated recovery states', () => {
  for (const status of [400, 401, 403, 404, 408, 429, 500, 502, 503]) {
    const view = errorPresentation(status);
    assert.ok(view.title && view.description && view.illustrationAlt);
    assert.ok(['404', '500'].includes(view.illustration));
    assert.equal(view.retry, status === 429 || status >= 500);
  }
  assert.match(errorPresentation(404).title, /path leads nowhere/);
  assert.match(errorPresentation(403).description, /don’t have access/);
  assert.match(errorPresentation(429).description, /wait/);
  assert.match(errorPresentation(503).title, /short break/);
});

test('client and server error hooks never expose raw exceptions, stacks, or secrets', async () => {
  const original = console.error;
  const diagnostics = [];
  console.error = (...args) => diagnostics.push(args);
  try {
    for (const kind of ['client', 'server']) {
      const source = (await readFile(new URL(`../src/hooks.${kind}.ts`, import.meta.url), 'utf8'))
        .replace("from '$lib/errors'", `from '${errorsUrl}'`)
        .replace("from '$lib/paraglide/server.js'", `from '${moduleUrl("export const paraglideMiddleware = (request, callback) => callback({ request, locale: 'en' });")}'`)
        .replace("from '$lib/paraglide/runtime.js'", `from '${moduleUrl("export const getTextDirection = () => 'ltr';")}'`);
      const { handleError } = await import(moduleUrl(source));
      const result = handleError({ error: new Error('private-key-and-token-never-public'), status: 500, event: {}, message: 'unsafe original message' });
      assert.match(result.incidentId, /^[a-f0-9-]{36}$/);
      assert.equal(Object.keys(result).length, 2);
      assert.ok(!JSON.stringify(result).includes('private-key'));
      assert.ok(!JSON.stringify(result).includes('unsafe original'));
      assert.ok(!JSON.stringify(result).includes('stack'));
    }
    assert.equal(diagnostics.length, 2);
    assert.ok(!JSON.stringify(diagnostics).includes('private-key-and-token'));
  } finally { console.error = original; }
});

test('server error responses retain their status and body and cannot be cached', async () => {
  const source = (await readFile(new URL('../src/hooks.server.ts', import.meta.url), 'utf8')).replace("from '$lib/errors'", `from '${errorsUrl}'`);
  const middlewareUrl = moduleUrl(`export const paraglideMiddleware = (request, callback) => callback({ request, locale: 'en' });`);
  const runtimeUrl = moduleUrl(`export const getTextDirection = () => 'ltr';`);
  const wrapped = source
    .replace("from '$lib/paraglide/server.js'", `from '${middlewareUrl}'`)
    .replace("from '$lib/paraglide/runtime.js'", `from '${runtimeUrl}'`);
  const { handle } = await import(moduleUrl(wrapped));
  for (const status of [404, 500, 503]) {
    const result = await handle({ event: {}, resolve: async () => new Response('safe error page', { status, headers: { 'cache-control': 'public, max-age=3600', 'x-preserved': 'yes' } }) });
    assert.equal(result.status, status);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.equal(result.headers.get('x-preserved'), 'yes');
    assert.equal(await result.text(), 'safe error page');
  }
  const success = new Response('fine', { headers: { 'cache-control': 'public, max-age=60' } });
  assert.equal(await handle({ event: {}, resolve: async () => success }), success);
});

test('adversarial Error name getters cannot leak secrets or break error handling', () => {
  const original = console.error;
  const diagnostics = [];
  console.error = (...args) => diagnostics.push(args);
  try {
    let reads = 0;
    const changing = new Error('private-message');
    Object.defineProperty(changing, 'name', { get() { return reads++ === 0 ? 'Error' : 'private-secret'; } });
    assert.ok(reportUnexpectedError(changing, 500, 'server').incidentId);
    assert.equal(reads, 1);
    const throwing = new Error('private-message');
    Object.defineProperty(throwing, 'name', { get() { throw new Error('private-secret'); } });
    assert.ok(reportUnexpectedError(throwing, 500, 'client').incidentId);
    assert.ok(!JSON.stringify(diagnostics).includes('private-'));
    assert.equal(diagnostics[1][1].kind, 'UnknownError');
    assert.equal(reportUnexpectedError(new Error('private-message'), 404, 'server').incidentId, undefined);
    assert.equal(diagnostics.length, 2);
  } finally { console.error = original; }
});

test('the pre-Svelte fallback is independent and contains no raw error-message placeholder', async () => {
  const template = await readFile(new URL('../src/error.html', import.meta.url), 'utf8');
  assert.ok(template.includes('%sveltekit.status%'));
  assert.ok(!template.includes('%sveltekit.error.message%'));
  assert.ok(!template.includes('<script'));
  assert.ok(template.includes('<svg'));
  assert.ok(template.includes('prefers-color-scheme:dark'));
});
