import { expect, test } from './fixtures';
import { readFile } from 'node:fs/promises';

test.use({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`theme reveal preserves state with motion ${reducedMotion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion, colorScheme: 'light' });
    await page.goto('/');
    await page.evaluate(() => {
      const animate = document.documentElement.animate.bind(document.documentElement);
      (window as unknown as { reveals: unknown[] }).reveals = [];
      document.documentElement.animate = (frames, options) => {
        (window as unknown as { reveals: unknown[] }).reveals.push({ frames, options });
        return animate(frames, options);
      };
    });
    const toggle = page.locator('.theme-toggle:visible');
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('open-tools-theme'))).toBe('dark');
    if (reducedMotion === 'reduce') {
      expect(await page.evaluate(() => (window as unknown as { reveals: unknown[] }).reveals)).toHaveLength(0);
    } else {
      await expect.poll(() => page.evaluate(() => (window as unknown as { reveals: unknown[] }).reveals.length)).toBe(1);
      const reveal = await page.evaluate(() => (window as unknown as { reveals: { frames: { clipPath: string[] }; options: { pseudoElement: string } }[] }).reveals[0]);
      expect(reveal.frames.clipPath[0]).toMatch(/^circle\(0px at /);
      expect(reveal.options.pseudoElement).toBe('::view-transition-new(root)');
    }
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
}

test('theme changes without the View Transitions API and footer uses package version', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => Object.defineProperty(document, 'startViewTransition', { value: undefined }));
  await page.locator('.theme-toggle:visible').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const { version } = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  await expect(page.locator('.footer-version')).toHaveText(`trick-it v${version}`);
});

test('host blocks wheel zoom but preserves accessible magnification and normal scrolling', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  const cancelled = await page.evaluate(() => {
    const events = [
      new WheelEvent('wheel', { ctrlKey: true, cancelable: true, bubbles: true }),
      new WheelEvent('wheel', { deltaY: 100, cancelable: true, bubbles: true }),
      new KeyboardEvent('keydown', { key: '+', metaKey: true, cancelable: true, bubbles: true }),
      new KeyboardEvent('keydown', { key: '+', cancelable: true, bubbles: true }),
      new Event('gesturestart', { cancelable: true, bubbles: true })
    ];
    return events.map(event => !document.dispatchEvent(event));
  });
  expect(cancelled).toEqual([true, false, false, false, false]);
});
