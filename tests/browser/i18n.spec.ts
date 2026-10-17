import { expect, test } from '@playwright/test';

test('English pages retain the original unprefixed URLs', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: /what can we help with/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bahasa Indonesia' })).toHaveAttribute('href', '/id/');
});

test('Indonesian catalog and legal pages are prerendered at /id/', async ({ page }) => {
  await page.goto('/id/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'id');
  await expect(page.getByRole('heading', { name: 'Apa yang ingin kamu kerjakan?' })).toBeVisible();
  await page.getByRole('link', { name: 'Privasi', exact: true }).click();
  await expect(page).toHaveURL(/\/id\/privacy\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'id');
  await expect(page.getByRole('heading', { name: 'Kebijakan Privasi' })).toBeVisible();
  await page.getByRole('link', { name: 'English' }).click();
  await expect(page).toHaveURL(/\/privacy\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('language switching preserves tool route and isolated bundle', async ({ page }) => {
  await page.goto('/json-tools/');
  await page.getByRole('link', { name: 'Bahasa Indonesia' }).click();
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
  await expect(page.getByRole('link', { name: 'English' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bahasa Indonesia' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
