import { expect, test } from '@playwright/test';

test('English keeps original routes and exposes every supported language in a searchable modal', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: /what can we help with/i })).toBeVisible();
  const trigger = page.getByRole('button', { name: 'Languages: English' });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  const picker = page.getByRole('dialog', { name: 'Languages' });
  await expect(picker).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(picker.locator('.language-option')).toHaveCount(12);
  await expect(picker.getByRole('link', { name: /English/ })).toHaveAttribute('aria-current', 'page');
  await expect(picker.getByRole('link', { name: /Bahasa Indonesia/ })).toBeVisible();

  await picker.getByRole('searchbox', { name: 'Search languages…' }).fill('vietnam');
  await expect(picker.locator('.language-option')).toHaveCount(1);
  await expect(picker.getByRole('link', { name: /Tiếng Việt/ })).toBeVisible();
  await picker.getByRole('searchbox', { name: 'Search languages…' }).fill('zz-nothing');
  await expect(picker.getByText('No matching languages. Try another name.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(picker).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('Indonesian catalog and legal routes are preserved', async ({ page }) => {
  await page.goto('/id/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'id');
  await expect(page.getByRole('heading', { name: 'Apa yang ingin kamu kerjakan?' })).toBeVisible();
  await page.getByRole('link', { name: 'Privasi', exact: true }).click();
  await expect(page).toHaveURL(/\/id\/privacy\/?$/);
  await expect(page.getByRole('heading', { name: 'Kebijakan Privasi' })).toBeVisible();
  await page.getByRole('button', { name: 'Bahasa: Bahasa Indonesia' }).click();
  await page.getByRole('dialog', { name: 'Bahasa' }).getByRole('link', { name: /English/ }).click();
  await expect(page).toHaveURL(/\/privacy\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('language changes preserve tool route and sandbox language fallback', async ({ page }) => {
  await page.goto('/json-tools/?keep=1#guide');
  await page.getByRole('button', { name: 'Languages: English' }).click();
  const picker = page.getByRole('dialog', { name: 'Languages' });
  await picker.getByRole('searchbox', { name: 'Search languages…' }).fill('Japanese');
  const japanese = picker.getByRole('link', { name: /日本語/ });
  await expect(japanese).toHaveAttribute('href', '/ja/json-tools/?keep=1#guide');
  await japanese.click();
  await expect(page).toHaveURL(/\/ja\/json-tools\/\?keep=1#guide$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.getByRole('link', { name: /ツール一覧に戻る/ })).toBeVisible();
  await expect(page.locator('iframe[sandbox="allow-scripts"]')).toBeVisible();
  // The tool declares its own supported locales; the host must not send
  // an unsupported interface language into the isolated iframe.
  await expect(page.frameLocator('iframe').locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('button', { name: '言語: 日本語' }).click();
  await page.getByRole('dialog', { name: '言語' }).getByRole('link', { name: /English/ }).click();
  await expect(page).toHaveURL(/\/json-tools\/\?keep=1#guide$/);
});

test('mobile quick settings launches the same filterable modal without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/id/');
  await page.getByRole('button', { name: 'Opsi', exact: true }).click();
  const trigger = page.locator('.quick-settings').getByRole('button', { name: 'Bahasa: Bahasa Indonesia' });
  await trigger.click();
  const picker = page.getByRole('dialog', { name: 'Bahasa' });
  await expect(picker).toBeVisible();
  await expect(page.getByRole('button', { name: 'Opsi', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await picker.getByRole('searchbox', { name: 'Cari bahasa…' }).fill('thai');
  await expect(picker.locator('.language-option')).toHaveCount(1);
  await expect(picker.getByRole('link', { name: /ไทย/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await picker.getByRole('link', { name: /ไทย/ }).click();
  await expect(page).toHaveURL(/\/th\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'th');
});

test('language picker supports arrow navigation, modal focus and backdrop close', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Languages: English' });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const picker = page.getByRole('dialog', { name: 'Languages' });
  const input = picker.getByRole('searchbox', { name: 'Search languages…' });
  await expect(input).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(picker.getByRole('link', { name: /English/ })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(picker.getByRole('link', { name: /Bahasa Indonesia/ })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(picker).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await picker.locator('.language-dialog-inner').evaluate((node) => { node.scrollTop = 0; });
  await picker.click({ position: { x: 2, y: 2 }, force: true });
  // Clicking the panel edge is not necessarily the backdrop; the close button is always available.
  await picker.getByRole('button', { name: 'Close search' }).click();
  await expect(picker).not.toBeVisible();
});
