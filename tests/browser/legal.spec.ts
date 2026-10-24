import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';

for (const locale of ['en', 'id'] as const) {
  for (const route of ['terms', 'policy', 'privacy'] as const) {
    test(`${locale} ${route} has localized copy, accessible navigation, and transparent PNG artwork`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 812 });
      await page.emulateMedia({ colorScheme: 'dark' });
      const prefix = locale === 'id' ? '/id' : '';
      await page.goto(`${prefix}/${route}/`);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.locator('.legal-hero h1')).toBeVisible();
      await expect(page.locator('.legal-top .language-switcher .language-trigger')).toHaveCount(1);
      await expect(page.locator('.legal-lede')).not.toBeEmpty();
      await expect(page.locator('.legal-summary p')).not.toBeEmpty();
      await expect(page.locator('.legal-section')).toHaveCount(route === 'privacy' ? 7 : 5);
      if (route === 'privacy') {
        await expect(page.locator('.legal-sections')).toContainText('Google AdSense');
        await expect(page.locator('a[href="https://policies.google.com/technologies/partner-sites"]')).toBeVisible();
      }
      if (route === 'terms') {
        await expect(page.locator('.legal-sections')).toContainText(/advertising|iklan/);
        await expect(page.locator('.legal-sections')).toContainText(/consent|persetujuan/);
      }
      if (route === 'policy') {
        await expect(page.locator('.legal-sections')).toContainText('host');
        await expect(page.locator('.legal-sections')).toContainText(/advertising|iklan/);
      }
      const image = page.locator('.legal-hero-art');
      await expect(image).toHaveAttribute('alt', /.+/);
      const src = await image.getAttribute('src');
      expect(src?.endsWith(`/illustrations/${route}-clay.png`)).toBe(true);
      const response = await page.request.get(src!);
      expect(response.ok()).toBe(true);
      expect(response.headers()['content-type']).toContain('image/png');
      const bytes = await response.body();
      expect(Array.from(bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      const pixels = await image.evaluate((img: HTMLImageElement) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const context = canvas.getContext('2d')!;
        context.drawImage(img, 0, 0);
        return { width: img.naturalWidth, height: img.naturalHeight, alpha: context.getImageData(0, 0, 1, 1).data[3] };
      });
      expect(pixels.width).toBeGreaterThanOrEqual(512);
      expect(pixels.height).toBeGreaterThanOrEqual(512);
      expect(pixels.alpha).toBe(0);
      await expect(page.locator('.legal-related a')).toHaveCount(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(accessibility.violations).toEqual([]);
    });
  }
}
