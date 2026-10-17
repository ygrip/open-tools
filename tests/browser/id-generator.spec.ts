import { expect, test } from '@playwright/test';

test('ID generator supports UUIDs, monotonic ULID batches, custom IDs and CSV output', async ({ page }) => {
  await page.goto('/id-generator/');
  const tool = page.frameLocator('iframe');
  await expect(tool.getByRole('heading', { name: 'ID Generator' })).toBeVisible();
  const format = tool.getByRole('combobox', { name: 'ID format' });
  const output = tool.getByRole('textbox', { name: 'Generated IDs' });
  await tool.getByRole('button', { name: 'Generate IDs' }).click();
  let ids = (await output.inputValue()).split('\n');
  expect(ids).toHaveLength(10);
  expect(ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))).toBe(true);

  await format.selectOption('uuid-v7');
  await tool.getByRole('button', { name: 'Generate IDs' }).click();
  ids = (await output.inputValue()).split('\n');
  expect(ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))).toBe(true);

  await format.selectOption('ulid');
  await tool.getByRole('button', { name: 'Generate IDs' }).click();
  ids = (await output.inputValue()).split('\n');
  expect(ids).toHaveLength(10);
  expect(ids.every((id) => /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id))).toBe(true);
  expect(ids).toEqual([...ids].sort());

  await format.selectOption('custom');
  await tool.getByLabel('How many?').fill('2');
  await tool.getByLabel('Random length').fill('4');
  await tool.getByLabel('Custom alphabet').fill('0123456789');
  await tool.getByRole('button', { name: 'Generate IDs' }).click();
  ids = (await output.inputValue()).split('\n');
  expect(ids).toHaveLength(2);
  expect(ids.every((id) => /^order_[0-9]{4}$/.test(id))).toBe(true);
  await tool.getByRole('combobox', { name: 'Output format' }).selectOption('csv');
  expect(await output.inputValue()).toMatch(/^id\n"order_[0-9]{4}"\n"order_[0-9]{4}"$/);
  await tool.getByRole('button', { name: 'Clear' }).click();
  await expect(output).toHaveValue('');
});

test('ID generator fits narrow mobile frames without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/id-generator/');
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'ID Generator' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const frame = page.frames().find((frame) => frame !== page.mainFrame())!;
  expect(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
