import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const locale of ['en', 'id'] as const) {
  for (const route of ['terms', 'policy'] as const) {
    test(`${locale} ${route} uses readable copy, a working illustration, and accessible navigation`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 812 });
      await page.emulateMedia({ colorScheme: 'dark' });
      const prefix = locale === 'id' ? '/id' : '';
      await page.goto(`${prefix}/${route}/`);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('.legal-hero h1')).toBeVisible();
      await expect(page.locator('.legal-top button').first()).toBeVisible();
      await expect(page.locator('.legal-lede')).not.toBeEmpty();
      await expect(page.locator('.legal-summary p')).not.toBeEmpty();
      await expect(page.locator('.legal-section')).toHaveCount(5);
      const illustration = page.locator('.legal-hero-art');
      await expect(illustration).toHaveAttribute('alt', /.+/);
      const asset = await page.request.get((await illustration.getAttribute('src'))!);
      expect(asset.ok()).toBe(true);
      expect(await asset.text()).toContain('<svg');
      await expect(page.locator('.legal-related a')).toHaveCount(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(accessibility.violations).toEqual([]);
    });
  }
}
