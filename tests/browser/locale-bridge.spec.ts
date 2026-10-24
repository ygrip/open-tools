import { expect, test } from './fixtures';
import { mountFixture } from './runtime-fixture';
import { languageCodes } from '../../src/lib/languages.js';

test('a genuinely multilingual tool receives every live locale without replacing its workspace', async ({ page }) => {
  await mountFixture(page, { locales: languageCodes });
  const frame = page.frameLocator('.runtime-workspace > iframe');
  await frame.getByRole('textbox').fill('keep this input');
  await frame.locator('body').evaluate(element => { element.dataset.identity = 'original'; });
  for (const locale of languageCodes) {
    await page.getByLabel('Test host locale', { exact: true }).selectOption(locale);
    await expect(frame.locator('html')).toHaveAttribute('lang', locale);
    await expect(frame.getByRole('textbox')).toHaveValue('keep this input');
    await expect(frame.locator('body')).toHaveAttribute('data-identity', 'original');
    expect(await frame.locator('body').evaluate(() => (window as unknown as { trickIt: { locale: string } }).trickIt.locale)).toBe(locale);
  }
});

test('unsupported tool locales use the first declared language while navigation keeps its own locale', async ({ page }) => {
  await mountFixture(page, { locales: ['id', 'en'] });
  await page.getByLabel('Test host locale', { exact: true }).selectOption('ja');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja');
  await expect(page.frameLocator('.runtime-workspace > iframe').locator('html')).toHaveAttribute('lang', 'id');
});
