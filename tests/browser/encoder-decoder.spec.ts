import { expect, test } from '@playwright/test';

test('encoder-decoder converts UTF-8, handles errors and reverses output', async ({ page }) => {
  await page.goto('/encoder-decoder/');
  const tool = page.frameLocator('iframe');
  await expect(tool.getByRole('heading', { name: 'Encoder / Decoder' })).toBeVisible();
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts');
  const input = tool.getByRole('textbox', { name: 'Input' });
  const output = tool.getByRole('textbox', { name: 'Output' });
  await input.fill('Hello 世界 🌟');
  await tool.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(output).toHaveValue('SGVsbG8g5LiW55WMIPCfjJ8=');

  await tool.getByRole('button', { name: 'Use output as input' }).click();
  await tool.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(output).toHaveValue('Hello 世界 🌟');

  await tool.getByRole('combobox', { name: 'Format' }).selectOption('hex');
  await tool.getByRole('combobox', { name: 'Action' }).selectOption('decode');
  await input.fill('ff');
  await tool.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(tool.getByRole('status')).toContainText('not valid UTF-8');
  await expect(input).toHaveValue('ff');
  await expect(output).toBeEmpty();
});

test('encoder-decoder supports Indonesian and remains responsive on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/id/encoder-decoder/');
  const tool = page.frameLocator('iframe');
  await expect(tool.getByRole('button', { name: 'Konversi', exact: true })).toBeVisible();
  await tool.getByRole('combobox', { name: 'Format' }).selectOption('url');
  const input = tool.getByRole('textbox', { name: 'Input' });
  const output = tool.getByRole('textbox', { name: 'Hasil' });
  await input.fill('a b+c');
  await tool.getByRole('button', { name: 'Konversi', exact: true }).click();
  await expect(output).toHaveValue('a%20b%2Bc');
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  expect(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
