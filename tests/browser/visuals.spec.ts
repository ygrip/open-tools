import { expect, test } from '@playwright/test';

test('support cards display each platform logo from local assets', async ({ page }) => {
  await page.goto('/');
  for (const platform of ['trakteer', 'kofi', 'patreon']) {
    const logo = page.locator(`.support-option .support-icon img[src$="/brand/support-${platform}.svg"]`);
    await expect(logo).toHaveCount(1);
    await expect(logo).toBeVisible();
    await expect.poll(() => logo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
});

test('tool theme follows the host without resetting input or output', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/json-tools');
  const tool = page.frameLocator('iframe');
  const input = tool.getByRole('textbox', { name: 'Input', exact: true });
  const output = tool.getByRole('textbox', { name: 'Output', exact: true });
  await input.fill('{"small":"win"}');
  await tool.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(output).toHaveValue('{\n  "small": "win"\n}');
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  expect(await frame.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  expect(await frame.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ot-bg').trim())).toBe('#fff8f0');
  const lightBackground = await input.evaluate((element) => getComputedStyle(element).backgroundColor);
  await frame.evaluate(() => { (window as unknown as { themeMarker: number }).themeMarker = 42; });
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => frame.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  expect(await frame.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ot-bg').trim())).toBe('#242127');
  expect(await input.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(lightBackground);
  expect(await frame.evaluate(() => (window as unknown as { themeMarker: number }).themeMarker)).toBe(42);
  await expect(input).toHaveValue('{"small":"win"}');
  await expect(output).toHaveValue('{\n  "small": "win"\n}');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.frameLocator('iframe').locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('theme continues to work when storage is denied', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', { value() { throw new Error('Storage denied'); } });
    Object.defineProperty(Storage.prototype, 'setItem', { value() { throw new Error('Storage denied'); } });
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/json-tools');
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'JSON Tools' })).toBeVisible();
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.frameLocator('iframe').locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('status')).toContainText('Theme changed for this visit');
});

test('quick search traps focus, closes with Escape, and restores the trigger', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Search tools', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Search tools' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('searchbox')).toBeFocused();
  await dialog.getByRole('searchbox').fill('XML');
  await expect(dialog.getByRole('link', { name: /JSON Tools/ })).toBeVisible();
  await dialog.getByRole('searchbox').fill('not a tool');
  await expect(dialog).toContainText('No helpers');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('/');
  await expect(dialog).toBeVisible();
});

test('catalog filters and empty state are usable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Search the toolbox' }).fill('not-here');
  await expect(page.getByRole('heading', { name: 'No little helpers found. Yet.' })).toBeVisible();
  await page.getByRole('button', { name: 'Show all tools' }).click();
  await expect(page.getByRole('link', { name: /Open / }).first()).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search the toolbox' }).fill('JSON');
  await expect(page.getByRole('link', { name: /Open JSON Tools/ })).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [375, 1440]) {
    test(`${theme} clay layout stays within ${width}px viewport and respects reduced motion`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Small tools.');
      const image = page.getByRole('img', { name: /smiling orange clay toolbox/ });
      await expect(image).toBeVisible();
      expect(await image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.getByRole('link', { name: 'Explore the toolbox' }).evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');
      await page.screenshot({ path: `/tmp/open-tools-${theme}-${width}.png`, fullPage: true });
    });
  }
}
