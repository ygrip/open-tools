import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';

const preview = 'http://127.0.0.1:4173';

test('installed shell and an opened tool work offline without hiding missing routes', async ({ page, context }) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Search the toolbox' }).fill('keep my input');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect(page.getByRole('searchbox', { name: 'Search the toolbox' })).toHaveValue('keep my input');
  await page.goto('/json-tools/');
  await expect(page.frameLocator('iframe').getByRole('textbox', { name: 'Input', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => (await (await caches.open('trick-it-bundles-v1')).keys()).length)).toBeGreaterThan(0);
  await context.setOffline(true);
  await page.reload();
  const tool = page.frameLocator('iframe');
  await tool.getByRole('textbox', { name: 'Input', exact: true }).fill('{"offline":true}');
  await tool.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(tool.getByRole('textbox', { name: 'Output', exact: true })).toHaveValue('{\n  "offline": true\n}');
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
    const input = page.frameLocator('iframe').getByRole('textbox', { name: 'Input', exact: true });
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
