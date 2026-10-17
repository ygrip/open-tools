import { expect, test } from '@playwright/test';

test('catalog opens the bundle and runs all four operations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /JSON Tools/ }).click();
  await expect(page).toHaveURL(/\/json-tools\/?$/);
  const tool = page.frameLocator('iframe');
  const input = tool.getByRole('textbox', { name: 'Input', exact: true });
  const output = tool.getByRole('textbox', { name: 'Output', exact: true });
  await input.fill('{"items":[{"name":"Notebook"},{"name":"Pen"}]}');
  await tool.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(output).toHaveValue(JSON.stringify({ items: [{ name: 'Notebook' }, { name: 'Pen' }] }, null, 2));
  await tool.getByRole('combobox', { name: 'Operation', exact: true }).selectOption('query');
  await tool.getByLabel('JSONPath expression').fill('$.items[*].name');
  await tool.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(output).toHaveValue('[\n  "Notebook",\n  "Pen"\n]');
  await tool.getByRole('combobox', { name: 'Operation', exact: true }).selectOption('json-to-xml');
  await input.fill('{"name":"A & B"}');
  await tool.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(output).toHaveValue(/<root>\s*<name>A &amp; B<\/name>\s*<\/root>/);
  await tool.getByRole('combobox', { name: 'Operation', exact: true }).selectOption('xml-to-json');
  await input.fill('<root><name>A &amp; B</name></root>');
  await tool.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(output).toHaveValue(JSON.stringify({ root: { name: 'A & B' } }, null, 2));
  await input.fill('<!DOCTYPE root><root/>');
  await tool.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(tool.getByRole('status')).toContainText('DOCTYPE and ENTITY');
});

test('host enforces opaque origin, denies parent access and blocks fetch', async ({ page }) => {
  await page.goto('/json-tools');
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'JSON Tools' })).toBeVisible();
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts');
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  expect(await frame.evaluate(() => {
    try { return parent.document.title; } catch { return 'blocked'; }
  })).toBe('blocked');
  expect(await frame.evaluate(() => {
    try { localStorage.setItem('escape', '1'); return 'allowed'; } catch { return 'blocked'; }
  })).toBe('blocked');
  expect(await frame.evaluate(async () => {
    try { await fetch('https://example.com/leak'); return 'allowed'; } catch { return 'blocked'; }
  })).toBe('blocked');
});

test('parent policy blocks external iframe self-navigation', async ({ page }) => {
  const policyMessages: string[] = [];
  let externalRequests = 0;
  page.on('console', (message) => policyMessages.push(message.text()));
  await page.route('https://example.com/**', async (route) => {
    externalRequests++;
    await route.fulfill({ body: 'unexpected external request' });
  });
  await page.goto('/json-tools');
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'JSON Tools' })).toBeVisible();
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  await frame.evaluate(() => { location.href = 'https://example.com/leak'; });
  await expect.poll(() => policyMessages.join('\n')).toContain('frame-src');
  expect(externalRequests).toBe(0);
});

test('bundle request failures show a working retry', async ({ page }) => {
  let fail = true;
  await page.route('**/bundles/**', async (route) => {
    if (fail) await route.fulfill({ status: 503, body: 'unavailable' });
    else await route.continue();
  });
  await page.goto('/json-tools');
  await expect(page.getByRole('alert')).toContainText('503');
  fail = false;
  await page.getByRole('button', { name: 'Retry loading' }).click();
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'JSON Tools' })).toBeVisible();
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

test('mobile tool layout stays within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/json-tools');
  await expect(page.frameLocator('iframe').getByRole('textbox', { name: 'Input', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  expect(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
