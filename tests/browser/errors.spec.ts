import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

for (const theme of ['light', 'dark'] as const) {
  test(`unknown routes show an illustrated, usable 404 in ${theme} mode`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ colorScheme: theme });
    await page.goto('/a-missing-little-tool');
    await expect(page.getByText('Error 404', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'This little path leads nowhere.' })).toBeVisible();
    await expect(page.getByRole('img', { name: /clay toolbox searches a map/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `/tmp/open-tools-error-404-${theme}.png`, fullPage: true });
    await page.getByRole('link', { name: 'Back to the toolbox', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Small tools.');
  });
}

test('failed tool route chunks use the global illustrated 500 with a safe reference', async ({ page }) => {
  const manifest = JSON.parse(await readFile('.svelte-kit/output/client/.vite/manifest.json', 'utf8'));
  let toolChunk = '';
  for (const entry of Object.values(manifest) as Array<{ src?: string; file: string }>) {
    if (!entry.src?.includes('/nodes/')) continue;
    if ((await readFile(entry.src, 'utf8')).includes('src/routes/[tool]/+page.svelte')) toolChunk = entry.file;
  }
  expect(toolChunk).not.toBe('');
  await page.goto('/');
  await page.route(`**/${toolChunk}`, (route) => route.abort('failed'));
  await page.getByRole('searchbox', { name: 'Search the toolbox' }).fill('JSON Tools');
  await page.getByRole('link', { name: /Open JSON Tools/ }).click();
  await expect(page.getByText('Error 500', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Even little tools need a tune-up.' })).toBeVisible();
  await expect(page.getByText(/include reference/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByRole('img', { name: /repair break/ })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await page.screenshot({ path: '/tmp/open-tools-error-500.png', fullPage: true });
  await expect(page.locator('main')).not.toContainText('Failed to fetch dynamically imported module');
});

for (const status of [500, 503]) test(`exported ${status} fallback works without JavaScript or image/font requests`, async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, colorScheme: 'dark', viewport: { width: 375, height: 812 } });
  try {
    const page = await context.newPage();
    const externalAssets: string[] = [];
    page.on('request', (request) => { if (['script', 'font', 'image'].includes(request.resourceType())) externalAssets.push(request.url()); });
    await page.goto(`http://127.0.0.1:4173/${status}.html`);
    await expect(page.getByText(`Error ${status}`, { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'A little pause. We’ll get there.' })).toBeVisible();
    await expect(page.getByRole('img', { name: /repair break/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to the toolbox' })).toHaveAttribute('href', '/');
    expect(externalAssets).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally { await context.close(); }
});
