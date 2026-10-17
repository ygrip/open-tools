import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { compile } from 'svelte/compiler';

const root = fileURLToPath(new URL('../../', import.meta.url));
const html = '<!doctype html><html><head><title>Runtime fixture</title></head><body><h1>Runtime fixture</h1><label>Remember me<textarea>keep this text</textarea></label></body></html>';
const hash = createHash('sha256').update(html).digest('hex');
const fixture = { schemaVersion: 3, id: 'runtime-fixture', name: 'Runtime fixture', version: '1.0.0', bundle: { sha256: hash }, guide: { summary: 'Test-only tool, never registered.', steps: ['Choose a permission.'] }, permissions: [], assets: [] };
let mountScript: Promise<string> | undefined;
function script() {
  return mountScript ??= build({
    stdin: { contents: "import { mount } from 'svelte'; import Runtime from './src/lib/components/ToolRuntime.svelte'; document.body.replaceChildren(); mount(Runtime, { target: document.body, props: { tool: window.__runtimeFixture, locale: 'en' } });", resolveDir: root },
    bundle: true, write: false, format: 'iife', platform: 'browser', conditions: ['browser'], mainFields: ['browser', 'module', 'main'],
    define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'runtime-fixture', setup(builder) {
      builder.onResolve({ filter: /^\$app\/paths$/ }, () => ({ path: 'base', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: "export const base = '';" }));
      builder.onResolve({ filter: /^\$lib\// }, (args) => builder.resolve(resolve(root, 'src/lib', args.path.slice(5)), { resolveDir: root, kind: args.kind }));
      builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => ({ contents: compile(await readFile(path, 'utf8'), { filename: path, generate: 'client', css: 'injected' }).js.code, loader: 'js', resolveDir: dirname(path) }));
    } }]
  }).then((result) => result.outputFiles[0].text);
}
async function mountFixture(page: Page, changes: Record<string, unknown> = {}) {
  const tool = { ...fixture, ...changes };
  await page.route('**/bundles/runtime-fixture/**', (route) => route.fulfill({ json: { id: fixture.id, version: fixture.version, sha256: hash, html } }));
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate((value) => { (window as unknown as { __runtimeFixture: unknown }).__runtimeFixture = value; }, tool);
  await page.addScriptTag({ content: await script() });
}

test('required consent blocks startup and native host confirmation gates each clipboard write', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (value: string) => { (window as unknown as { __clipboard: string }).__clipboard = value; } } });
  });
  await mountFixture(page, { permissions: [{ name: 'clipboard-write', reason: 'Copy a result you choose.', required: true }] });
  const start = page.getByRole('button', { name: 'Start with selected permissions' });
  await expect(start).toBeDisabled();
  await expect(page.locator('iframe')).toHaveCount(0);
  await page.getByRole('checkbox', { name: /Write to your clipboard/ }).check();
  await start.click();
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  const denied = frame.evaluate(async () => {
    try { await (window as unknown as { trickIt: { request: (operation: string, payload: string) => Promise<unknown> } }).trickIt.request('clipboard-write', 'private text'); return 'allowed'; }
    catch { return 'denied'; }
  });
  await expect(page.getByRole('dialog', { name: 'Allow this tool action?' })).toBeVisible();
  await page.getByRole('button', { name: 'Deny', exact: true }).click();
  expect(await denied).toBe('denied');
  expect(await page.evaluate(() => (window as unknown as { __clipboard?: string }).__clipboard)).toBeUndefined();
  const approved = frame.evaluate(() => (window as unknown as { trickIt: { request: (operation: string, payload: string) => Promise<unknown> } }).trickIt.request('clipboard-write', 'chosen result'));
  await expect(page.getByRole('dialog', { name: 'Allow this tool action?' })).toBeVisible();
  await frame.evaluate(() => {
    const script = document.querySelector('script')!.textContent!;
    const config = JSON.parse(script.match(/const config = (\{[^\n]+\});/)![1]);
    parent.postMessage({ type: 'trick-it:request', version: 1, token: config.token, id: '2', operation: 'clipboard-write', payload: 'unapproved replacement' }, '*');
  });
  await page.getByRole('button', { name: 'Allow once', exact: true }).click();
  await approved;
  expect(await page.evaluate(() => (window as unknown as { __clipboard: string }).__clipboard)).toBe('chosen result');
  await page.frameLocator('iframe').getByRole('textbox', { name: 'Remember me' }).fill('preserve me');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await expect(page.frameLocator('iframe').locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.frameLocator('iframe').getByRole('textbox', { name: 'Remember me' })).toHaveValue('preserve me');
  await page.getByRole('button', { name: 'Revoke access and restart' }).click();
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /Write to your clipboard/ })).not.toBeChecked();
});

test('unselected optional permissions stay unavailable without browser prompts', async ({ page }) => {
  await mountFixture(page, { permissions: [{ name: 'clipboard-read', reason: 'Paste text.', required: false }] });
  await page.getByRole('button', { name: 'Start with selected permissions' }).click();
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  expect(await frame.evaluate(async () => {
    try { await (window as unknown as { trickIt: { request: (operation: string) => Promise<unknown> } }).trickIt.request('clipboard-read'); return 'allowed'; }
    catch { return 'denied'; }
  })).toBe('denied');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await frame.evaluate(async () => {
    try { await WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])); return 'allowed'; }
    catch { return 'blocked'; }
  })).toBe('blocked');
});

test('deferred WASM downloads only on request, verifies bytes and preserves opaque origin', async ({ page }) => {
  const bytes = Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  let downloads = 0;
  await page.route('https://models.example/model.wasm**', (route) => {
    downloads++;
    expect(new URL(route.request().url()).searchParams.get('trick-it-sha256')).toBe(sha256);
    return route.fulfill({ body: bytes, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/wasm' } });
  });
  await mountFixture(page, {
    permissions: [{ name: 'external-assets', reason: 'Download this model.', required: true }, { name: 'wasm', reason: 'Run the model.', required: true }],
    assets: [{ id: 'model', url: 'https://models.example/model.wasm', sha256, bytes: bytes.length, type: 'wasm', defer: true }]
  });
  expect(downloads).toBe(0);
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: 'Start with selected permissions' }).click();
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  expect(downloads).toBe(0);
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  const run = () => frame.evaluate(async () => {
    const result = await (window as unknown as { trickIt: { asset: (id: string) => Promise<{ bytes: ArrayBuffer; type: string }> } }).trickIt.asset('model');
    await WebAssembly.compile(result.bytes);
    return { bytes: result.bytes.byteLength, type: result.type };
  });
  expect(await run()).toEqual({ bytes: bytes.length, type: 'wasm' });
  expect(await run()).toEqual({ bytes: bytes.length, type: 'wasm' });
  expect(downloads).toBe(1);
  expect(await frame.evaluate(async () => {
    const sdk = (window as unknown as { trickIt: { asset: (id: string) => Promise<unknown> } }).trickIt;
    for (let index = 0; index < 1030; index++) await sdk.asset('model');
    return true;
  })).toBe(true);
  expect(downloads).toBe(1);
  expect(await frame.evaluate(() => { try { return parent.document.title; } catch { return 'blocked'; } })).toBe('blocked');
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts');
});

test('geolocation and downloads require separate host confirmations', async ({ page, context }) => {
  await context.setGeolocation({ latitude: -6.2, longitude: 106.8 });
  await context.grantPermissions(['geolocation']);
  await mountFixture(page, { permissions: [{ name: 'geolocation', reason: 'Locate a point.', required: true }, { name: 'downloads', reason: 'Save a chosen result.', required: true }] });
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: 'Start with selected permissions' }).click();
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  expect(await frame.evaluate(() => new Promise<string>((resolve) => navigator.geolocation.getCurrentPosition(() => resolve('allowed'), () => resolve('blocked'))))).toBe('blocked');
  const location = frame.evaluate(() => (window as unknown as { trickIt: { request: (operation: string) => Promise<{ latitude: number; longitude: number }> } }).trickIt.request('geolocation'));
  await page.getByRole('button', { name: 'Allow once', exact: true }).click();
  expect(await location).toMatchObject({ latitude: -6.2, longitude: 106.8 });
  const result = frame.evaluate(() => (window as unknown as { trickIt: { request: (operation: string, payload: unknown) => Promise<unknown> } }).trickIt.request('downloads', { filename: 'result.json', mime: 'application/json', bytes: new TextEncoder().encode('{"ok":true}').buffer }));
  await expect(page.getByRole('dialog')).toContainText('result.json');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Allow once', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('result.json');
  await result;
});

test('clipboard reads do not occur until the host confirmation is accepted', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { readText: async () => { (window as unknown as { reads: number }).reads = ((window as unknown as { reads?: number }).reads ?? 0) + 1; return 'chosen clipboard text'; } } });
  });
  await mountFixture(page, { permissions: [{ name: 'clipboard-read', reason: 'Paste text you choose.', required: true }] });
  await page.getByRole('checkbox', { name: /Read your clipboard/ }).check();
  await page.getByRole('button', { name: 'Start with selected permissions' }).click();
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  const request = frame.evaluate(() => (window as unknown as { trickIt: { request: (operation: string) => Promise<string> } }).trickIt.request('clipboard-read'));
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { reads?: number }).reads)).toBeUndefined();
  await page.getByRole('button', { name: 'Allow once', exact: true }).click();
  expect(await request).toBe('chosen clipboard text');
});

test('granted blob workers remain opaque and cannot fetch external resources', async ({ page }) => {
  await mountFixture(page, { permissions: [{ name: 'workers', reason: 'Run local computation.', required: true }] });
  await page.getByRole('checkbox', { name: /Run isolated background workers/ }).check();
  await page.getByRole('button', { name: 'Start with selected permissions' }).click();
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  expect(await frame.evaluate(() => new Promise<string>((resolve) => {
    const url = URL.createObjectURL(new Blob(["fetch('https://example.com/blocked').then(() => postMessage('allowed'), () => postMessage('blocked'))"], { type: 'text/javascript' }));
    const worker = new Worker(url);
    const timer = setTimeout(() => { worker.terminate(); URL.revokeObjectURL(url); resolve('timeout'); }, 5000);
    worker.onmessage = (event) => { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); resolve(event.data); };
    worker.onerror = () => { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); resolve('worker-failed'); };
  }))).toBe('blocked');
});

test('verified deferred modules can load inside the tool without granting workers', async ({ page }) => {
  const bytes = Buffer.from('export const answer = 42;');
  const digest = createHash('sha256').update(bytes).digest('hex');
  let downloads = 0;
  await page.route('https://models.example/glue.mjs**', (route) => {
    downloads++;
    return route.fulfill({ body: bytes, headers: { 'access-control-allow-origin': '*', 'content-type': 'text/javascript' } });
  });
  await mountFixture(page, {
    permissions: [{ name: 'external-assets', reason: 'Load reviewed module code.', required: true }],
    assets: [{ id: 'glue', url: 'https://models.example/glue.mjs', sha256: digest, bytes: bytes.length, type: 'script', defer: true }]
  });
  await page.getByRole('checkbox', { name: /Download declared external assets/ }).check();
  await page.getByRole('button', { name: 'Start with selected permissions' }).click();
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  expect(downloads).toBe(0);
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  expect(await frame.evaluate(async () => {
    const { bytes } = await (window as unknown as { trickIt: { asset: (id: string) => Promise<{ bytes: ArrayBuffer }> } }).trickIt.asset('glue');
    const url = URL.createObjectURL(new Blob([bytes], { type: 'text/javascript' }));
    try { return (await import(/* @vite-ignore */ url)).answer; }
    finally { URL.revokeObjectURL(url); }
  })).toBe(42);
  expect(downloads).toBe(1);
});
