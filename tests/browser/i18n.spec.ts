import { expect, test } from '@playwright/test';

test('English pages retain the original unprefixed URLs', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: /what can we help with/i })).toBeVisible();
  const languagePicker = page.getByRole('button', { name: 'Languages: English' });
  await expect(languagePicker).toHaveAttribute('aria-expanded', 'false');
  await languagePicker.click();
  await expect(languagePicker).toHaveAttribute('aria-expanded', 'true');
  const languages = page.getByRole('group', { name: 'Languages' });
  await expect(languages.getByRole('link', { name: 'English' })).toHaveAttribute('aria-current', 'page');
  await expect(languages.getByRole('link', { name: 'Bahasa Indonesia' })).toBeVisible();
  await expect(languages.locator('.clay-flag')).toHaveCount(2);
});

test('Indonesian catalog and legal pages are prerendered at /id/', async ({ page }) => {
  await page.goto('/id/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'id');
  await expect(page.getByRole('heading', { name: 'Apa yang ingin kamu kerjakan?' })).toBeVisible();
  await page.getByRole('link', { name: 'Privasi', exact: true }).click();
  await expect(page).toHaveURL(/\/id\/privacy\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'id');
  await expect(page.getByRole('heading', { name: 'Kebijakan Privasi' })).toBeVisible();
  await page.getByRole('button', { name: 'Bahasa: Bahasa Indonesia' }).click();
  await page.getByRole('group', { name: 'Bahasa' }).getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/privacy\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('language switching preserves tool route and isolated bundle', async ({ page }) => {
  await page.goto('/json-tools/');
  await page.getByRole('button', { name: 'Languages: English' }).click();
  await page.getByRole('group', { name: 'Languages' }).getByRole('link', { name: 'Bahasa Indonesia' }).click();
  await expect(page).toHaveURL(/\/id\/json-tools\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'id');
  await expect(page.getByRole('link', { name: 'Kembali ke kotak alat' })).toBeVisible();
  await expect(page.locator('iframe[sandbox="allow-scripts"]')).toBeVisible();
  await page.getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/json-tools\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('mobile language selector remains reachable without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/id/');
  await page.getByRole('button', { name: 'Opsi', exact: true }).click();
  await expect(page.getByRole('link', { name: 'English' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bahasa Indonesia' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});


test('desktop language popover supports keyboard controls and click-away', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Languages: English' });
  await trigger.focus();
  await page.keyboard.press('ArrowDown');
  const languages = page.getByRole('group', { name: 'Languages' });
  await expect(languages.getByRole('link', { name: 'English' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(languages.getByRole('link', { name: 'Bahasa Indonesia' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(languages).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole('button', { name: 'Search tools' }).click();
  await expect(languages).not.toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Search tools' })).toBeVisible();
});
