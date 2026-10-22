import { expect, test } from '@playwright/test';
import { mountFixture } from './runtime-fixture';

test.use({ serviceWorkers: 'block' });

for (const width of [375, 1440]) {
  test(`tool-only zoom keeps host scale, sandbox, state and auto-height at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await mountFixture(page);
    const iframe = page.locator('iframe');
    const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
    const controls = page.getByRole('group', { name: 'Tool zoom' });
    const zoomIn = controls.getByRole('button', { name: 'Zoom in tool' });
    const zoomOut = controls.getByRole('button', { name: 'Zoom out tool' });
    const reset = controls.getByRole('button', { name: 'Reset tool zoom to 100%' });
    const level = controls.getByLabel('Tool zoom level');

    await expect(iframe).toHaveAttribute('sandbox', 'allow-scripts');
    await expect(level).toHaveText('100%');
    await expect(reset).toBeDisabled();
    expect(await page.evaluate(() => getComputedStyle(document.body).zoom)).toBe('1');
    expect(await page.locator('meta[name="viewport"]').getAttribute('content')).not.toContain('user-scalable=no');

    const text = page.frameLocator('iframe').getByRole('textbox', { name: 'Remember me' });
    await text.fill('Do not restart my tool');
    await frame.evaluate(() => {
      const extra = document.createElement('div');
      extra.id = 'zoom-height-fixture';
      extra.style.height = '600px';
      document.body.append(extra);
    });
    const height = () => iframe.evaluate((el) => el.getBoundingClientRect().height);
    await expect.poll(height).toBeGreaterThan(600);
    const beforeHeight = await height();
    const beforeHeading = await frame.evaluate(() => document.querySelector('h1')!.getBoundingClientRect().height);

    await zoomIn.click();
    await expect(level).toHaveText('125%');
    await expect.poll(() => frame.evaluate(() => getComputedStyle(document.body).zoom)).toBe('1.25');
    await expect.poll(height).toBeGreaterThan(beforeHeight * 1.15);
    const afterHeading = await frame.evaluate(() => document.querySelector('h1')!.getBoundingClientRect().height);
    expect(afterHeading).toBeGreaterThan(beforeHeading * 1.15);
    await expect(text).toHaveValue('Do not restart my tool');
    expect(await page.evaluate(() => getComputedStyle(document.body).zoom)).toBe('1');

    for (let step = 0; step < 3; step++) await zoomIn.click();
    await expect(level).toHaveText('200%');
    await expect(zoomIn).toBeDisabled();
    await expect.poll(() => frame.evaluate(() => getComputedStyle(document.body).zoom)).toBe('2');

    // A forged child-window message and a malformed parent message cannot set zoom.
    const token = await frame.evaluate(() => {
      // Configuration is inserted into a different bootstrap script.
      const scripts = [...document.querySelectorAll('script')];
      const sdk = scripts.find((entry) => entry.textContent?.includes('const config = '))!.textContent!;
      const config = JSON.parse(sdk.match(/const config = (\\{[^\\n]+\\});/)![1]);
      window.postMessage({ type: 'trick-it:zoom', version: 1, token: config.token, percent: 75 }, '*');
      return config.token as string;
    });
    await page.evaluate((value) => {
      const sandbox = document.querySelector('iframe')!.contentWindow!;
      sandbox.postMessage({ type: 'trick-it:zoom', version: 1, token: value, percent: 500 }, '*');
      sandbox.postMessage({ type: 'trick-it:zoom', version: 1, token: 'wrong-session', percent: 75 }, '*');
    }, token);
    await expect.poll(() => frame.evaluate(() => getComputedStyle(document.body).zoom)).toBe('2');

    await reset.click();
    await expect(level).toHaveText('100%');
    await expect(reset).toBeDisabled();
    await expect.poll(() => frame.evaluate(() => getComputedStyle(document.body).zoom)).toBe('1');
    await expect.poll(height).toBeLessThan(beforeHeight * 1.10);
    await zoomOut.click();
    await expect(level).toHaveText('75%');
    await expect(zoomOut).toBeDisabled();
    await expect.poll(() => frame.evaluate(() => getComputedStyle(document.body).zoom)).toBe('0.75');
    await expect(text).toHaveValue('Do not restart my tool');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('zoom labels follow the host locale and preserve built-in browser magnification', async ({ page }) => {
  await page.goto('/id/json-tools/');
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', 'width=device-width, initial-scale=1');
  const controls = page.getByRole('group', { name: 'Perbesaran alat' });
  await expect(page.locator('iframe')).toBeVisible();
  await expect(controls.getByRole('button', { name: 'Perbesar tampilan alat' })).toBeVisible();
  await expect(controls.getByRole('button', { name: 'Kembalikan perbesaran alat ke 100%' })).toBeVisible();
});
