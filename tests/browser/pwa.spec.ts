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
  // Legal pages are no longer precached during install. Opening one online
  // must make it available offline without delaying future updates.
  await page.goto('/id/privacy/');
  await expect.poll(() => page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) => name.startsWith('trick-it-shell-'));
    return (await Promise.all(names.map(async (name) => Boolean(await (await caches.open(name)).match('/id/privacy/'))))).some(Boolean);
  })).toBe(true);
  await page.goto('/json-tools/');
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

test('PWA update waits for approval, installs, then refreshes the app automatically', async ({ page }) => {
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
    await expect(input).toHaveValue('keep this unsaved input');
    expect(await page.evaluate(() => (window as unknown as { updateMarker: number }).updateMarker)).toBe(42);
    await Promise.all([
      page.waitForEvent('framenavigated', frame => frame === page.mainFrame()),
      page.getByRole('button', { name: 'Update now', exact: true }).click()
    ]);
    await expect(page).toHaveURL(`${origin}/json-tools/`);
    expect(await page.evaluate(() => (window as unknown as { updateMarker?: number }).updateMarker)).toBeUndefined();
    await expect(page.getByRole('button', { name: 'Reload to finish', exact: true })).toHaveCount(0);
    const caches = await page.evaluate(() => window.caches.keys());
    expect(caches).toContain(`trick-it-shell-${version}`);
    expect(caches).toContain(`trick-it-shell-${version}-test-update`);
    expect(caches).toContain('trick-it-bundles-v1');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});


test('idle catalog automatically installs a waiting release', async ({ page }) => {
  test.setTimeout(90_000);
  const version = (await (await fetch(`${preview}/_app/version.json`)).json()).version as string;
  let updated = false;
  const server = createServer(async (request, response) => {
    try {
      const upstream = await fetch(`${preview}${request.url?.startsWith('/') ? request.url : '/'}`);
      let body = Buffer.from(await upstream.arrayBuffer());
      if (request.url === '/service-worker.js' && updated) {
        const source = body.toString('utf8');
        if (!source.includes(version)) throw new Error('Compiled worker version missing');
        body = Buffer.from(source.replaceAll(version, `${version}-catalog-update`));
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
    // The first visit installs the worker; a reload creates a controlled, older catalog tab.
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    await page.evaluate(() => { (window as unknown as { updateMarker: number }).updateMarker = 42; });
    updated = true;
    await Promise.all([
      page.waitForEvent('framenavigated', frame => frame === page.mainFrame()),
      page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); })
    ]);
    await expect(page).toHaveURL(`${origin}/`);
    expect(await page.evaluate(() => (window as unknown as { updateMarker?: number }).updateMarker)).toBeUndefined();
    const caches = await page.evaluate(() => window.caches.keys());
    expect(caches).toContain(`trick-it-shell-${version}-catalog-update`);
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

test('desktop language picker shows flags and preserves the current route', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?from=language#tools');
  const switcher = page.locator('.header-actions > .language-switcher');
  const trigger = switcher.getByRole('button', { name: 'Languages: English' });
  await expect(trigger).toBeVisible();
  await expect(trigger.locator('img.clay-flag')).toHaveAttribute('src', /\/brand\/flag-en\.svg$/);
  await trigger.click();
  const panel = switcher.getByRole('group', { name: 'Languages' });
  await expect(panel.getByRole('link', { name: 'English' }).locator('img.clay-flag')).toHaveAttribute('src', /\/brand\/flag-en\.svg$/);
  await expect(panel.getByRole('link', { name: 'Bahasa Indonesia' }).locator('img.clay-flag')).toHaveAttribute('src', /\/brand\/flag-id\.svg$/);
  await panel.getByRole('link', { name: 'Bahasa Indonesia' }).click();
  await expect(page).toHaveURL(/\/id\/\?from=language#tools$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'id');
});

test('mobile quick settings keeps a flagged two-choice language switcher', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const settings = page.locator('.header-actions > .quick-settings');
  await settings.locator('.qs-trigger').click();
  const choices = settings.locator('.qs-panel .language-switcher');
  await expect(choices.locator('a[hreflang="en"] img.clay-flag')).toHaveAttribute('src', /\/brand\/flag-en\.svg$/);
  await expect(choices.locator('a[hreflang="id"] img.clay-flag')).toHaveAttribute('src', /\/brand\/flag-id\.svg$/);
  await choices.locator('a[hreflang="id"]').click();
  await expect(page).toHaveURL(/\/id\/$/);
});

test('unused prerendered routes are deferred and cached on first visit', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  const hasCachedPrivacy = () => page.evaluate(async () => {
    const shells = (await caches.keys()).filter((name) => name.startsWith('trick-it-shell-'));
    return (await Promise.all(shells.map(async (name) => Boolean(await (await caches.open(name)).match('/privacy/'))))).some(Boolean);
  });
  expect(await hasCachedPrivacy()).toBe(false);
  await page.goto('/privacy/');
  await expect.poll(hasCachedPrivacy).toBe(true);
});
