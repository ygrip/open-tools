import { expect, test } from '@playwright/test';
import { adsFixtureScript } from './ads-fixture';
import { readFile } from 'node:fs/promises';
import { validateAdsConfig, hostFramePolicy } from '../../src/lib/ads/config.js';

const deployment = validateAdsConfig(JSON.parse(await readFile(new URL('../../config/ads.json', import.meta.url), 'utf8')));

test.use({ serviceWorkers: 'block' });

const mockSdk = `window.__adRequests = [];
window.adsbygoogle = { push() {
  const ad = document.querySelector('ins.adsbygoogle:not([data-adsbygoogle-status])');
  if (!ad) throw new Error('Duplicate ad request');
  ad.setAttribute('data-adsbygoogle-status', 'done');
  window.__adRequests.push(ad.getAttribute('data-ad-slot'));
} };`;

test('deployment makes no ad requests before consent and uses its configured frame policy', async ({ page }) => {
  const adRequests: string[] = [];
  page.on('request', request => { if (/googlesyndication|doubleclick/.test(request.url())) adRequests.push(request.url()); });
  for (const path of ['/', '/json-tools/', '/privacy/', '/policy/']) {
    await page.goto(path, { waitUntil: 'networkidle' });
    await expect(page.locator('.ad-placement, ins.adsbygoogle, #trick-it-adsense')).toHaveCount(0);
    expect(await page.evaluate(() => Boolean(window.trickItAds))).toBe(deployment.enabled);
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', hostFramePolicy(deployment));
  }
  expect(adRequests).toEqual([]);
});

test('configured slots load one host library and request once per new ad element', async ({ page }) => {
  let loads = 0;
  await page.route('https://pagead2.googlesyndication.com/**', route => {
    loads++;
    return route.fulfill({ contentType: 'text/javascript', body: mockSdk });
  });
  await page.goto('/');
  await page.addScriptTag({ content: await adsFixtureScript() });
  await expect(page.locator('.ad-placement')).toHaveCount(0);
  expect(loads).toBe(0);
  await page.evaluate(() => window.trickItAds!.setConsent(true));
  await expect(page.locator('.ad-placement')).toHaveCount(2);
  await expect(page.locator('ins[data-adtest="on"]')).toHaveCount(2);
  await expect.poll(() => page.evaluate(() => window.__adRequests?.length)).toBe(2);
  expect(loads).toBe(1);
  expect(await page.locator('#trick-it-adsense').evaluate(el => el.parentElement?.tagName)).toBe('HEAD');
  await page.evaluate(() => window.__remountAd());
  await expect.poll(() => page.evaluate(() => window.__adRequests?.length)).toBe(3);
  expect(loads).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('empty placement stays absent and live mode omits the test attribute', async ({ page }) => {
  await page.route('https://pagead2.googlesyndication.com/**', route => route.fulfill({ contentType: 'text/javascript', body: mockSdk }));
  await page.goto('/id/');
  await page.addScriptTag({ content: await adsFixtureScript({ placements: { home: '', tool: '1234567890' }, testMode: false }) });
  await page.evaluate(() => window.trickItAds!.setConsent(true));
  await expect(page.locator('[data-ad-placement="home"]')).toHaveCount(0);
  await expect(page.locator('ins.adsbygoogle')).not.toHaveAttribute('data-adtest');
  await expect(page.getByRole('complementary', { name: 'Iklan' })).toBeVisible();
  await page.evaluate(() => window.trickItAds!.setConsent(false));
  await expect(page.locator('.ad-placement')).toHaveCount(0);
});

test('blocked advertising does not break the host or produce uncaught page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://pagead2.googlesyndication.com/**', route => route.abort());
  await page.goto('/');
  await page.addScriptTag({ content: await adsFixtureScript() });
  await page.evaluate(() => window.trickItAds!.setConsent(true));
  await expect(page.locator('#trick-it-adsense')).toHaveCount(0);
  await page.locator('.theme-toggle:visible').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
});

test('an ad removed while the library loads is never requested', async ({ page }) => {
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('https://pagead2.googlesyndication.com/**', async route => {
    await gate;
    await route.fulfill({ contentType: 'text/javascript', body: mockSdk });
  });
  await page.goto('/');
  await page.addScriptTag({ content: await adsFixtureScript({ placements: { home: '', tool: '1234567890' } }) });
  await page.evaluate(() => window.trickItAds!.setConsent(true));
  await page.evaluate(() => window.__removeToolAd());
  release();
  await expect(page.locator('ins.adsbygoogle')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__adRequests?.length)).toBe(0);
});

for (const hiding of ['display', 'visibility', 'opacity'] as const) test(`a slot hidden with ${hiding} waits until visible before requesting`, async ({ page }) => {
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('https://pagead2.googlesyndication.com/**', async route => {
    await gate;
    await route.fulfill({ contentType: 'text/javascript', body: mockSdk });
  });
  await page.goto('/');
  await page.addScriptTag({ content: await adsFixtureScript({ placements: { home: '', tool: '1234567890' } }) });
  await page.evaluate(() => window.trickItAds!.setConsent(true));
  await page.evaluate(kind => window.__hideToolAd(kind), hiding);
  release();
  await expect.poll(() => page.evaluate(() => window.__adRequests?.length)).toBe(0);
  await page.evaluate(() => window.__showToolAd());
  await expect.poll(() => page.evaluate(() => window.__adRequests?.length)).toBe(1);
});
