import { expect, test } from '@playwright/test';
import { mountFixture } from './runtime-fixture';

test('catalog opens a verified tool in an opaque iframe', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Search the toolbox' }).fill('JSON Tools');
  await page.getByRole('link', { name: /Open JSON Tools/ }).click();
  await expect(page).toHaveURL(/\/json-tools\/?$/);
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts');
});

test('host enforces opaque origin, denies parent access and blocks fetch', async ({ page }) => {
  await mountFixture(page);
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts');
  const frame = page.frames().find(candidate => candidate !== page.mainFrame())!;
  expect(await frame.evaluate(() => { try { return parent.document.title; } catch { return 'blocked'; } })).toBe('blocked');
  expect(await frame.evaluate(() => { try { localStorage.setItem('escape', '1'); return 'allowed'; } catch { return 'blocked'; } })).toBe('blocked');
  expect(await frame.evaluate(async () => { try { await fetch('https://example.com/leak'); return 'allowed'; } catch { return 'blocked'; } })).toBe('blocked');
});

test('parent policy blocks external iframe self-navigation', async ({ page }) => {
  const policyMessages: string[] = [];
  let externalRequests = 0;
  page.on('console', message => policyMessages.push(message.text()));
  await page.route('https://example.com/**', async route => { externalRequests++; await route.fulfill({ body: 'unexpected external request' }); });
  await mountFixture(page);
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find(candidate => candidate !== page.mainFrame())!;
  await frame.evaluate(() => { location.href = 'https://example.com/leak'; });
  await expect.poll(() => policyMessages.join('\n')).toContain('frame-src');
  expect(externalRequests).toBe(0);
});

test('opaque tools cannot leak data through same-origin iframe navigation', async ({ page }) => {
  let requests = 0;
  const policyMessages: string[] = [];
  page.on('console', message => policyMessages.push(message.text()));
  await page.route('**/exfil-probe**', route => { requests++; return route.abort(); });
  await mountFixture(page);
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find(candidate => candidate !== page.mainFrame())!;
  await frame.evaluate(() => { location.href = '/exfil-probe?payload=sentinel'; });
  await expect.poll(() => policyMessages.join('\n')).toContain('frame-src');
  expect(requests).toBe(0);
});

test('bundle request failures show a working retry', async ({ page }) => {
  let fail = true;
  await page.route('**/bundles/**', async route => {
    if (fail) await route.fulfill({ status: 503, body: 'unavailable' });
    else await route.continue();
  });
  await page.goto('/json-tools');
  await expect(page.getByRole('alert')).toContainText('503');
  fail = false;
  await page.getByRole('button', { name: 'Retry loading' }).click();
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts');
});

test('stalled bundle requests time out and expose retry', async ({ page }) => {
  await page.clock.install();
  await page.route('**/bundles/**', () => { /* Intentionally leave the request pending. */ });
  await page.goto('/json-tools');
  await expect(page.getByRole('status')).toContainText('Loading JSON Tools');
  await page.clock.fastForward(30_001);
  await expect(page.getByRole('alert')).toContainText('timed out');
  await expect(page.getByRole('button', { name: 'Retry loading' })).toBeVisible();
});
