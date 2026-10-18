import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { stateProbe } from './runtime-fixture';

const preview = 'http://127.0.0.1:4173';

test('installed shell and an opened tool work offline without hiding missing routes', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Search the toolbox' }).fill('keep my input');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect(page.getByRole('searchbox', { name: 'Search the toolbox' })).toHaveValue('keep my input');
  await page.goto('/json-tools/');
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts');
  await expect.poll(() => page.evaluate(async () => (await (await caches.open('trick-it-bundles-v1')).keys()).length)).toBeGreaterThan(0);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts');
  // The sandbox document is replaced while the offline bundle loads: resolve the frame on every poll and ignore a navigation in flight.
  await expect.poll(async () => {
    const frame = page.frames().find(candidate => candidate !== page.mainFrame());
    return frame?.evaluate(() => typeof (window as unknown as { trickIt?: { request?: unknown } }).trickIt?.request).catch(() => 'navigating');
  }, { timeout: 15_000 }).toBe('function');
  const legal = await page.goto('/id/privacy/');
  expect(legal?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', 'id');
  const missing = await page.goto('/id/a-page-never-saved/');
  expect(missing?.status()).toBe(503);
  await expect(page.getByRole('heading', { name: 'Sedang luring.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Beranda Indonesia' })).toHaveAttribute('href', '/id/');
});

test('PWA update requires approval and never reloads a running tool', async ({ page }) => {
  test.setTimeout(60_000);
  const version = (await (await fetch(`${preview}/_app/version.json`)).json()).version as string;
  let updated = false;
  const server = createServer(async (request, response) => {
    try {
      const upstream = await fetch(`${preview}${request.url?.startsWith('/') ? request.url : '/'}`);
      let body = Buffer.from(await upstream.arrayBuffer());
      if (request.url === '/service-worker.js' && updated) {
        const source = body.toString('utf8');
        if (!source.includes(version)) throw new Error('Compiled worker version missing');
        body = Buffer.from(source.replaceAll(version, `${version}-test-update`));
      }
      const headers = Object.fromEntries(upstream.headers);
      delete headers['content-encoding']; delete headers['transfer-encoding']; delete headers['content-length'];
      if (request.url === '/service-worker.js') headers['cache-control'] = 'no-store';
      response.writeHead(upstream.status, { ...headers, 'content-length': String(body.length) });
      response.end(body);
    } catch { response.writeHead(503); response.end('Test proxy unavailable'); }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server missing');
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    await page.goto(`${origin}/`);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.goto(`${origin}/json-tools/`);
    const input = await stateProbe(page);
    await input.fill('keep this unsaved input');
    await page.evaluate(() => { (window as unknown as { updateMarker: number }).updateMarker = 42; });
    updated = true;
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
    await page.getByRole('button', { name: 'Prepare update', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reload to use the update', exact: true })).toBeVisible();
    await expect(input).toHaveValue('keep this unsaved input');
    expect(await page.evaluate(() => (window as unknown as { updateMarker: number }).updateMarker)).toBe(42);
    const caches = await page.evaluate(() => window.caches.keys());
    expect(caches).toContain(`trick-it-shell-${version}`);
    expect(caches).toContain(`trick-it-shell-${version}-test-update`);
    expect(caches).toContain('trick-it-bundles-v1');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});


test('install affordance floats above the footer and respects the native install result', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('button', { name: 'Install trick-it' });
  // The listener attaches on hydration; redispatch until it has, instead of racing it.
  await expect(async () => {
    await page.evaluate(() => {
      const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
        prompt: async () => { (window as unknown as { __installInvoked: boolean }).__installInvoked = true; },
        userChoice: Promise.resolve({ outcome: 'accepted' })
      });
      window.dispatchEvent(event);
    });
    await expect(card).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 10_000 });
  expect(await card.evaluate((node) => getComputedStyle(node.closest('.pwa-card')!).position)).toBe('fixed');
  await card.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __installInvoked?: boolean }).__installInvoked)).toBe(true);
  await expect(card).toHaveCount(0);
});
