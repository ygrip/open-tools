import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mountFixture } from './runtime-fixture';

// Remounting on one page tests remembered permissions; keep the service worker from
// serving the fixture bundle request that page.route fulfils.
test.use({ serviceWorkers: 'block' });

for (const width of [375, 1440]) test(`isolated tool grows and shrinks with its content at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 812 });
  await mountFixture(page);
  const iframe = page.locator('iframe');
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  const height = () => iframe.evaluate((element) => Math.round(element.getBoundingClientRect().height));

  await expect.poll(height).toBeLessThan(500);
  await frame.evaluate(() => {
    const extra = document.createElement('div');
    extra.id = 'resize-test-extra';
    extra.style.height = '1700px';
    document.body.append(extra);
  });
  await expect.poll(height).toBeGreaterThan(1700);
  await frame.evaluate(() => document.getElementById('resize-test-extra')?.remove());
  await expect.poll(height).toBeLessThan(500);

  // Spoofed and out-of-range height messages must not affect the parent.
  await frame.evaluate(() => {
    parent.postMessage({ type: 'trick-it:resize', version: 1, token: 'wrong-session', height: 50000 }, '*');
    const script = document.querySelector('script')!.textContent!;
    const config = JSON.parse(script.match(/const config = (\{[^\n]+\});/)![1]);
    parent.postMessage({ type: 'trick-it:resize', version: 1, token: config.token, height: 100001 }, '*');
  });
  await page.evaluate(async () => {
    window.postMessage({ type: 'trick-it:resize', version: 1, token: 'forged', height: 50000 }, '*');
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
  expect(await height()).toBeLessThan(500);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('runtime permissions are asked once on first use, remembered per tool and resettable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (value: string) => { (window as unknown as { __clipboard: string }).__clipboard = value; } } });
  });
  type Sdk = { trickIt: { request: (operation: string, payload: string) => Promise<unknown> } };
  const permissions = [{ name: 'clipboard-write', reason: 'Copy a result you choose.', required: true }];
  await mountFixture(page, { permissions });
  // No upfront consent: runtime permissions are only asked when first used.
  await expect(page.getByRole('button', { name: 'Start with selected permissions' })).toHaveCount(0);
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  let frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  const write = (value: string) => frame.evaluate(async (text) => { try { await (window as unknown as Sdk).trickIt.request('clipboard-write', text); return 'allowed'; } catch { return 'denied'; } }, value);
  const denied = write('private text');
  await expect(page.getByRole('dialog', { name: 'Allow this tool action?' })).toContainText('remembers your answer');
  await page.getByRole('button', { name: 'Don’t allow', exact: true }).click();
  expect(await denied).toBe('denied');
  // The refusal is remembered: no second prompt.
  expect(await write('again')).toBe('denied');
  await expect(page.getByRole('dialog', { name: 'Allow this tool action?' })).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as { __clipboard?: string }).__clipboard)).toBeUndefined();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('trick-it:permissions:v1')!)['runtime-fixture'])).toEqual({ 'clipboard-write': 'denied' });

  await page.getByRole('button', { name: 'Reset access and restart' }).click();
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  const approved = write('chosen result');
  await expect(page.getByRole('dialog', { name: 'Allow this tool action?' })).toBeVisible();
  // A forged second request while the prompt is open cannot ride on the approval.
  await frame.evaluate(() => {
    const script = document.querySelector('script')!.textContent!;
    const config = JSON.parse(script.match(/const config = (\{[^\n]+\});/)![1]);
    parent.postMessage({ type: 'trick-it:request', version: 1, token: config.token, id: '99', operation: 'clipboard-write', payload: 'unapproved replacement' }, '*');
  });
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  expect(await approved).toBe('allowed');
  expect(await page.evaluate(() => (window as unknown as { __clipboard: string }).__clipboard)).toBe('chosen result');
  expect(await write('second copy')).toBe('allowed');
  expect(await page.evaluate(() => (window as unknown as { __clipboard: string }).__clipboard)).toBe('second copy');
  await page.frameLocator('iframe').getByRole('textbox', { name: 'Remember me' }).fill('preserve me');
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
  await expect(page.frameLocator('iframe').locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.frameLocator('iframe').getByRole('textbox', { name: 'Remember me' })).toHaveValue('preserve me');

  // Still granted on the next visit without asking.
  await mountFixture(page, { permissions });
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  expect(await write('next visit')).toBe('allowed');
  await expect(page.getByRole('dialog', { name: 'Allow this tool action?' })).toBeHidden();
});

for (const allowed of [true, false]) test(`permission dialog returns keyboard focus to its iframe after ${allowed ? 'approval' : 'refusal'}`, async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as unknown as { __holdClipboard?: boolean; __releaseClipboard?: () => void };
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {
      if (state.__holdClipboard) await new Promise<void>(resolve => { state.__releaseClipboard = resolve; });
    } } });
  });
  await mountFixture(page, { permissions: [{ name: 'clipboard-write', reason: 'Copy a chosen result.', required: true }] });
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find(candidate => candidate !== page.mainFrame())!;
  await frame.evaluate(() => {
    const button = document.createElement('button'); button.textContent = 'Request copy';
    button.onclick = () => {
      const sdk = (window as unknown as { trickIt: { request: (operation: string, payload: string) => Promise<unknown> } }).trickIt;
      void sdk.request('clipboard-write', 'fixture text').then(() => { button.dataset.outcome = 'allowed'; }, () => { button.dataset.outcome = 'denied'; });
    };
    document.body.append(button);
  });
  const button = page.frameLocator('iframe').getByRole('button', { name: 'Request copy', exact: true });
  await button.focus(); await button.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Allow this tool action?' });
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: allowed ? 'Allow' : 'Don’t allow', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(button).toHaveAttribute('data-outcome', allowed ? 'allowed' : 'denied');
  await expect(page.locator('iframe')).toBeFocused();
  await expect(button).toBeFocused();
  if (allowed) {
    // A later async response must not steal focus from a newer local control.
    await page.evaluate(() => { (window as unknown as { __holdClipboard: boolean }).__holdClipboard = true; });
    await button.evaluate(element => element.removeAttribute('data-outcome'));
    await button.press('Enter');
    await expect.poll(() => page.evaluate(() => typeof (window as unknown as { __releaseClipboard?: () => void }).__releaseClipboard)).toBe('function');
    const editor = page.frameLocator('iframe').getByRole('textbox', { name: 'Remember me' });
    await editor.focus();
    await page.evaluate(() => (window as unknown as { __releaseClipboard: () => void }).__releaseClipboard());
    await expect(button).toHaveAttribute('data-outcome', 'allowed');
    await expect(editor).toBeFocused();
  }
});

test('startup permissions are chosen once before launch and unselected ones stay unavailable', async ({ page }) => {
  const permissions = [{ name: 'wasm', reason: 'Run a fast engine.', required: false }];
  await mountFixture(page, { permissions });
  await expect(page.locator('iframe')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'This tool needs extra power' })).toBeVisible();
  await page.getByRole('button', { name: 'Start with selected permissions' }).click();
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  expect(await frame.evaluate(async () => {
    try { await WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0])); return 'allowed'; }
    catch { return 'blocked'; }
  })).toBe('blocked');
  await mountFixture(page, { permissions });
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start with selected permissions' })).toHaveCount(0);
});

test('shared asset loader shows authenticated byte progress, verifies, localizes and retries failures', async ({ page }) => {
  const size = 65536;
  const digest = createHash('sha256').update(Buffer.alloc(size, 7)).digest('hex');
  let corrupt = true;
  await page.route('https://models.example/broken**', route => route.fulfill({ body: Buffer.alloc(size, corrupt ? 9 : 7), headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' } }));
  await mountFixture(page, {
    permissions: [{ name: 'external-assets', reason: 'Load optional data.', required: true }],
    assets: ['stream', 'broken'].map(id => ({ id, url: `https://models.example/${id}`, sha256: digest, bytes: size, type: 'data', defer: true }))
  });
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: 'Start with selected permissions' }).click();
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  // Hold the second half of a real ReadableStream to inspect the intermediate state.
  await page.evaluate((size) => {
    const fetcher = window.fetch.bind(window);
    window.fetch = (input, init) => {
      if (!String(input).startsWith('https://models.example/stream')) return fetcher(input, init);
      return Promise.resolve(new Response(new ReadableStream({ start(controller) {
        controller.enqueue(new Uint8Array(size / 2).fill(7));
        (window as any).__finishAsset = () => { controller.enqueue(new Uint8Array(size / 2).fill(7)); controller.close(); };
      } }), { headers: { 'cache-control': 'no-store' } }));
    };
  }, size);
  const frame = page.frames().find(candidate => candidate !== page.mainFrame())!;
  await frame.evaluate(() => {
    const w = window as any;
    w.loader = w.trickIt.ui.loader(document.body);
    w.phases = [];
    addEventListener('message', event => { if (event.data?.type === 'trick-it:asset-progress') w.phases.push(event.data.phase); });
    w.loaded = w.loader.asset('stream');
    w.loaded.catch(() => {}); // assertions below consume the original promise
  });
  const loader = page.frameLocator('iframe').locator('.ti-loader');
  await expect(loader.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '50');
  await expect(loader).toContainText('32 KB / 64 KB · 50%');
  await expect(loader).toHaveAttribute('aria-busy', 'true');
  expect(await frame.evaluate(async () => { try { await (window as any).loader.asset('stream'); return 'unexpected'; } catch (error) { return (error as { code: string }).code; } })).toBe('busy');
  // A sibling/self-sent message, wrong session, ID or malformed counters cannot spoof progress.
  const session = await frame.evaluate(() => {
    const script = document.querySelector('script')!.textContent!;
    const config = JSON.parse(script.match(/const config = (\{[^\n]+\});/)![1]);
    window.postMessage({ type: 'trick-it:asset-progress', version: 1, token: config.token, id: '1', loaded: 99, total: 100, phase: 'loading' }, '*');
    return config.token as string;
  });
  await page.evaluate((token) => {
    const target = document.querySelector('iframe')!.contentWindow!;
    for (const fields of [{ token: 'wrong' }, { id: '999' }, { loaded: -1 }, { loaded: 101 }, { total: 0 }, { total: 536870913 }, { phase: 'done' }]) target.postMessage({ type: 'trick-it:asset-progress', version: 1, token, id: '1', loaded: 99, total: 100, phase: 'loading', ...fields }, '*');
  }, session);
  await expect(loader.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '50');
  await frame.evaluate(() => { document.documentElement.lang = 'id'; dispatchEvent(new CustomEvent('trick-it:localechange')); });
  await expect(loader).toContainText('Memuat aset');
  await expect(loader.locator('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '50');
  await page.evaluate(() => (window as any).__finishAsset());
  expect(await frame.evaluate(async () => (await (window as any).loaded).bytes.byteLength)).toBe(size);
  await expect(loader).toHaveAttribute('data-state', 'done');
  await expect(loader).toContainText('Aset siap');
  expect(await frame.evaluate(() => (window as any).phases)).toContain('verifying');

  expect(await frame.evaluate(async () => { try { await (window as any).loader.asset('broken'); return 'unexpected'; } catch (error) { return (error as { code: string }).code; } })).toBe('integrity');
  await expect(loader).toHaveAttribute('data-state', 'error');
  await expect(loader).toContainText('Gagal memuat aset');
  await expect(page.frameLocator('iframe').getByRole('textbox', { name: 'Remember me' })).toHaveValue('keep this text');
  corrupt = false;
  expect(await frame.evaluate(async () => (await (window as any).loader.asset('broken')).bytes.byteLength)).toBe(size);
  await expect(loader).toHaveAttribute('data-state', 'done');
  await frame.evaluate(() => (window as any).loader.update({ phase: 'initializing' }));
  await expect(loader).toContainText('Menyiapkan mesin');
  await expect(loader.locator('[role="progressbar"]')).toBeHidden();
  await frame.evaluate(() => (window as any).loader.remove());
  await expect(loader).toHaveCount(0);
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
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  expect(await frame.evaluate(() => new Promise<string>((resolve) => navigator.geolocation.getCurrentPosition(() => resolve('allowed'), () => resolve('blocked'))))).toBe('blocked');
  const location = frame.evaluate(() => (window as unknown as { trickIt: { request: (operation: string) => Promise<{ latitude: number; longitude: number }> } }).trickIt.request('geolocation'));
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  // The host previews the fix and asks for precision before anything reaches the tool.
  await expect(page.getByRole('dialog')).toContainText('-6.20000, 106.80000');
  await page.getByRole('button', { name: 'Share precise', exact: true }).click();
  expect(await location).toMatchObject({ latitude: -6.2, longitude: 106.8 });
  const result = frame.evaluate(() => (window as unknown as { trickIt: { request: (operation: string, payload: unknown) => Promise<unknown> } }).trickIt.request('downloads', { filename: 'result.json', mime: 'application/json', bytes: new TextEncoder().encode('{"ok":true}').buffer }));
  await expect(page.getByRole('dialog')).toContainText('result.json');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('result.json');
  await result;
});

test('clipboard reads do not occur until the host confirmation is accepted', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { readText: async () => { (window as unknown as { reads: number }).reads = ((window as unknown as { reads?: number }).reads ?? 0) + 1; return 'chosen clipboard text'; } } });
  });
  await mountFixture(page, { permissions: [{ name: 'clipboard-read', reason: 'Paste text you choose.', required: true }] });
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  const request = frame.evaluate(() => (window as unknown as { trickIt: { request: (operation: string) => Promise<string> } }).trickIt.request('clipboard-read'));
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { reads?: number }).reads)).toBeUndefined();
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
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

test('tools show centred host popups, toasts and inline clay status through trickIt.ui', async ({ page }) => {
  await mountFixture(page);
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  type Ui = { trickIt: { ui: { info: (o: unknown) => Promise<boolean>; confirm: (o: unknown) => Promise<boolean>; toast: (m: string, o?: unknown) => Promise<void>; status: (t: Element, o: unknown) => { done: (t: string) => void } } } };
  const info = frame.evaluate(() => (window as unknown as Ui).trickIt.ui.info({ title: 'Publishing your preview', items: ['Enter details', 'Download the ZIP'], ordered: true }));
  const popup = page.getByRole('dialog', { name: 'Publishing your preview' });
  await expect(popup).toBeVisible();
  await expect(popup).toContainText('From Runtime fixture');
  await expect(popup.getByRole('listitem')).toHaveCount(2);
  // Rendered by the host, not inside the iframe.
  expect(await frame.evaluate(() => document.querySelector('dialog'))).toBeNull();
  await popup.getByRole('button', { name: 'Got it' }).click();
  expect(await info).toBe(true);
  const confirm = frame.evaluate(() => (window as unknown as Ui).trickIt.ui.confirm({ title: 'Clear everything?', confirmLabel: 'Clear', tone: 'danger' }));
  await page.getByRole('dialog', { name: 'Clear everything?' }).getByRole('button', { name: 'Cancel' }).click();
  expect(await confirm).toBe(false);
  await frame.evaluate(() => (window as unknown as Ui).trickIt.ui.toast('Copied to clipboard', { tone: 'success' }));
  await expect(page.getByRole('status').filter({ hasText: 'Copied to clipboard' })).toBeVisible();
  await frame.evaluate(() => { const card = (window as unknown as Ui).trickIt.ui.status(document.body, { state: 'working', title: 'Crunching', progress: 40 }); card.done('All done'); });
  await expect(page.frameLocator('iframe').locator('.ti-status[data-state="done"]')).toContainText('All done');
  // Long unbroken results wrap instead of widening the tool.
  expect(await frame.evaluate(() => { const p = document.createElement('p'); p.textContent = 'https://developer.chrome.com/docs/' + 'x'.repeat(400); document.body.append(p); return document.documentElement.scrollWidth <= document.documentElement.clientWidth; })).toBe(true);
});

test('shared toasts and status cards never duplicate and can be closed', async ({ page }) => {
  await mountFixture(page);
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find(candidate => candidate !== page.mainFrame())!;
  type Ui = { trickIt: { ui: { toast: (m: string, o?: unknown) => Promise<void>; status: (t: Element, o: unknown) => { work: (t: string) => void; done: (t: string) => void; element: HTMLElement }; loader: (t: Element, o?: unknown) => { done: () => void; update: (o: unknown) => void } } } };
  // The same notice replaces its earlier copy; each toast has its own close button.
  await frame.evaluate(async () => { const ui = (window as unknown as Ui).trickIt.ui; await ui.toast('Copied', { tone: 'success' }); await ui.toast('Copied', { tone: 'success' }); await ui.toast('Copied', { tone: 'success' }); });
  const copied = page.locator('.toast').filter({ hasText: 'Copied' });
  await expect(copied).toHaveCount(1);
  await copied.getByRole('button', { name: 'Dismiss' }).click();
  await expect(copied).toHaveCount(0);
  // A finished status card can be closed, and a new state shows it again; a working card has no close button.
  const inner = page.frameLocator('iframe');
  await frame.evaluate(() => { const card = (window as unknown as Ui).trickIt.ui.status(document.body, { state: 'working', title: 'Busy' }); (window as unknown as { card: typeof card }).card = card; });
  await expect(inner.locator('.ti-status .ti-close')).toBeHidden();
  await frame.evaluate(() => (window as unknown as { card: { done: (t: string) => void } }).card.done('Finished'));
  await expect(inner.locator('.ti-status')).toBeVisible();
  await inner.getByRole('button', { name: 'Close' }).click();
  await expect(inner.locator('.ti-status')).toBeHidden();
  await frame.evaluate(() => (window as unknown as { card: { work: (t: string) => void } }).card.work('Again'));
  await expect(inner.locator('.ti-status')).toBeVisible();
  // A completed asset loader hides itself instead of leaving a card behind.
  await frame.evaluate(() => { const ui = (window as unknown as Ui).trickIt.ui; for (let i = 0; i < 3; i++) { const l = ui.loader(document.body); l.update({ phase: 'loading' }); l.done(); } });
  await expect(inner.locator('.ti-loader:visible')).toHaveCount(0, { timeout: 6000 });
});

test('the shared file picker keeps its layout under aggressive tool CSS', async ({ page }) => {
  await mountFixture(page);
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find(candidate => candidate !== page.mainFrame())!;
  const layout = await frame.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = '.settings label{display:grid;gap:6px;font-size:12px;font-weight:600} button,input{min-height:60px;padding:20px;border:3px solid red} span,strong{display:contents}';
    document.head.append(style);
    const host = document.createElement('div'); host.className = 'settings'; document.body.append(host);
    const picker = (window as unknown as { trickIt: { ui: { fileInput: (t: Element, o: unknown) => { element: HTMLElement } } } }).trickIt.ui.fileInput(host, { accept: ['image/png', 'image/jpeg', '.png', '.jpg', '.jpeg'], maxBytes: 10485760, label: 'Watermark image' });
    const zone = picker.element, box = zone.getBoundingClientRect(), center = (r: DOMRect) => r.left + r.width / 2;
    const orb = zone.querySelector('.ti-orb')!.getBoundingClientRect(), button = zone.querySelector('.ti-drop-button')!.getBoundingClientRect();
    return { display: getComputedStyle(zone).display, direction: getComputedStyle(zone).flexDirection, font: getComputedStyle(zone).fontSize, orbCentered: Math.abs(center(orb) - center(box)) < 2, buttonCentered: Math.abs(center(button) - center(box)) < 2, buttonNarrow: button.width < box.width / 2, hint: zone.querySelector('.ti-drop-hint')!.textContent };
  });
  expect(layout).toMatchObject({ display: 'flex', direction: 'column', font: '15px', orbCentered: true, buttonCentered: true, buttonNarrow: true, hint: 'PNG, JPEG · up to 10 MB' });
});

test('a tool popup waits for a busy host instead of opening an in-frame modal', async ({ page }) => {
  await mountFixture(page, { permissions: [{ name: 'clipboard-write', reason: 'Copy a chosen result.', required: true }] });
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find(candidate => candidate !== page.mainFrame())!;
  type Sdk = { trickIt: { request: (operation: string, payload: string) => Promise<unknown>; ui: { info: (o: unknown) => Promise<boolean> } } };
  await frame.evaluate(() => { void (window as unknown as Sdk).trickIt.request('clipboard-write', 'text').catch(() => {}); });
  const permission = page.getByRole('dialog', { name: 'Allow this tool action?' });
  await expect(permission).toBeVisible();
  const info = frame.evaluate(() => (window as unknown as Sdk).trickIt.ui.info({ title: 'Queued guide', items: ['One'] }));
  await page.waitForTimeout(700);
  expect(await frame.evaluate(() => document.querySelector('dialog'))).toBeNull();
  await page.getByRole('button', { name: 'Don’t allow', exact: true }).click();
  const guide = page.getByRole('dialog', { name: 'Queued guide' });
  await expect(guide).toBeVisible();
  expect(await frame.evaluate(() => document.querySelector('dialog'))).toBeNull();
  await guide.getByRole('button', { name: 'Got it' }).click();
  expect(await info).toBe(true);
});

test('shared clay file input validates type, size and count before the tool sees files', async ({ page }) => {
  await mountFixture(page);
  const tool = page.frameLocator('iframe');
  await expect(tool.getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  await frame.evaluate(() => {
    const ui = (window as unknown as { trickIt: { ui: { fileInput: (t: Element, o: unknown) => unknown } } }).trickIt.ui;
    (window as unknown as { picked: string[] }).picked = [];
    ui.fileInput(document.body, { label: 'Drop a photo', accept: ['image/png', '.webp'], maxBytes: 1024, onChange: (files: File[]) => { (window as unknown as { picked: string[] }).picked = files.map((f) => f.name); } });
  });
  await expect(tool.locator('.ti-drop-hint')).toHaveText('PNG, WEBP · up to 1 KB');
  const input = tool.locator('.ti-drop input[type=file]');
  await input.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
  await expect(tool.getByRole('alert')).toContainText('not supported');
  await input.setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(2048) });
  await expect(tool.getByRole('alert')).toContainText('larger than 1 KB');
  expect(await frame.evaluate(() => (window as unknown as { picked: string[] }).picked)).toEqual([]);
  await input.setInputFiles({ name: 'ok.png', mimeType: 'image/png', buffer: Buffer.alloc(100) });
  await expect(tool.locator('.ti-file')).toContainText('ok.png');
  expect(await frame.evaluate(() => (window as unknown as { picked: string[] }).picked)).toEqual(['ok.png']);
});

test('disabled file pickers lock removal and drop until re-enabled', async ({ page }) => {
  await mountFixture(page);
  const tool = page.frameLocator('iframe');
  await expect(tool.getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find(candidate => candidate !== page.mainFrame())!;
  await frame.evaluate(() => {
    const w = window as any; w.changes = 0;
    w.picker = w.trickIt.ui.fileInput(document.body, { onChange() { w.changes++; } });
  });
  await tool.locator('.ti-drop input').setInputFiles({ name: 'data.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await frame.evaluate(() => (window as any).picker.setDisabled(true));
  await expect(tool.locator('.ti-file button')).toBeDisabled();
  await frame.evaluate(() => {
    document.querySelector('.ti-file button')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const data = new DataTransfer(); data.items.add(new File(['x'], 'next.txt', { type: 'text/plain' }));
    document.querySelector('.ti-drop')!.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }));
  });
  await expect(tool.locator('.ti-file')).toContainText('data.json');
  expect(await frame.evaluate(() => (window as any).changes)).toBe(1);
  await frame.evaluate(() => (window as any).picker.setDisabled(false));
  await expect(tool.locator('.ti-file button')).toBeEnabled();
  await tool.locator('.ti-file button').click();
  await expect(tool.locator('.ti-file')).toHaveCount(0);
  expect(await frame.evaluate(() => (window as any).changes)).toBe(2);
});

test('file input previews images locally and accepts drag and drop', async ({ page }) => {
  await mountFixture(page);
  const tool = page.frameLocator('iframe');
  await expect(tool.getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  await frame.evaluate(() => (window as unknown as { trickIt: { ui: { fileInput: (t: Element, o: unknown) => unknown } } }).trickIt.ui.fileInput(document.body, { accept: 'image/*,.json', multiple: true }));
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await tool.locator('.ti-drop input').setInputFiles({ name: 'dot.png', mimeType: 'image/png', buffer: png });
  await expect(tool.locator('.ti-file .ti-thumb img')).toHaveAttribute('src', /^blob:/);
  await frame.evaluate(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['{}'], 'data.json', { type: 'application/json' }));
    document.querySelector('.ti-drop')!.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
  });
  await expect(tool.locator('.ti-file')).toHaveCount(2);
  await expect(tool.locator('.ti-file').nth(1).locator('.ti-thumb')).toHaveText('JSON');
});
