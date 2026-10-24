import { expect, test } from './fixtures';

test('localized header tabs scroll horizontally without overflowing the header', async ({ page }) => {
  for (const width of [320, 375, 760, 800, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/vi/');
    await page.evaluate(() => document.fonts.ready);

    const nav = page.locator('.topbar .topnav');
    const bounds = await nav.evaluate((element) => {
      const header = element.closest('.topbar')!;
      const navRect = element.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      return {
        navLeft: navRect.left,
        navRight: navRect.right,
        headerLeft: headerRect.left,
        headerRight: headerRect.right,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        overflowX: getComputedStyle(element).overflowX
      };
    });

    expect(bounds.overflowX).toBe('auto');
    expect(bounds.navLeft).toBeGreaterThanOrEqual(bounds.headerLeft);
    expect(bounds.navRight).toBeLessThanOrEqual(bounds.headerRight);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    if (width <= 375) {
      // A short translation may fit without scrolling. Force a longer label to
      // verify actual overflow handling rather than assuming it always overflows.
      await nav.locator('.about-link').evaluate((element) => {
        element.textContent = 'Cách sử dụng công cụ và hướng dẫn chi tiết';
      });
      const scrollSize = await nav.evaluate((element) => ({
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth
      }));
      expect(scrollSize.scrollWidth).toBeGreaterThan(scrollSize.clientWidth);
      await nav.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
      await expect.poll(() => nav.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
      const githubRight = await nav.locator('.mobile-github').evaluate((element) => element.getBoundingClientRect().right);
      expect(githubRight).toBeLessThanOrEqual(bounds.navRight + 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  }
});
