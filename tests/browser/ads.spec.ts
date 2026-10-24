import { expect, test } from './fixtures';
import { mockAdSenseSdk as mockSdk } from './mock-ads';
import { mountFixture } from './runtime-fixture';
import { adsFixtureScript } from './ads-fixture';
import { readFile } from 'node:fs/promises';
import { validateAdsConfig, hostFramePolicy } from '../../src/lib/ads/config.js';

const deployment = validateAdsConfig(JSON.parse(await readFile(new URL('../../config/ads.json', import.meta.url), 'utf8')));

test.use({ serviceWorkers: 'block' });

test('site configuration controls automatic advertising and the frame policy', async ({ page }) => {
  const adRequests: string[] = [];
  await page.route('https://pagead2.googlesyndication.com/**', route => route.fulfill({ contentType: 'text/javascript', body: mockSdk }));
  page.on('request', request => { if (/googlesyndication|doubleclick/.test(request.url())) adRequests.push(request.url()); });
  const slots = new Map([['/', deployment.placements.home], ['/json-tools/', deployment.placements.tool]]);
  let expectedLoads = 0;
  for (const path of ['/', '/json-tools/', '/privacy/', '/terms/', '/policy/']) {
    let expectedAds = 0;
    if (deployment.enabled && slots.get(path)) expectedAds = 1;
    expectedLoads += expectedAds;
    await page.goto(path, { waitUntil: 'networkidle' });
    await expect(page.locator('.ad-placement')).toHaveCount(expectedAds);
    await expect(page.locator('#trick-it-adsense')).toHaveCount(expectedAds);
    expect(await page.evaluate(() => 'trickItAds' in window)).toBe(false);
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute('content', hostFramePolicy(deployment));
  }
  expect(adRequests).toHaveLength(expectedLoads);
});

test('tool and mock ad frames coexist without contacting the provider', async ({ page }) => {
  await mountFixture(page);
  await page.addScriptTag({ content: await adsFixtureScript({ placements: { home: '', tool: '1234567890' } }) });
  await expect.poll(() => page.locator('.ad-placement iframe[title="Advertisement"]').count()).toBeGreaterThan(0);
  await expect(page.frameLocator('.runtime-workspace > iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  await expect(page.locator('.runtime-workspace > iframe')).toHaveAttribute('sandbox', 'allow-scripts');
  const providerUrl = 'https://googleads.g.doubleclick.net/test-network-isolation';
  const blockedRequest = page.waitForEvent('requestfailed', request => request.url() === providerUrl);
  const provider = await page.evaluate(async (url) => {
    try {
      await fetch(url);
      return 'unexpected network access';
    } catch {
      return 'blocked';
    }
  }, providerUrl);
  expect(provider).toBe('blocked');
  expect((await blockedRequest).failure()?.errorText).toContain('net::ERR_BLOCKED_BY_CLIENT');
});

test('disabled advertising never renders slots or loads the SDK', async ({ page }) => {
  const requests: string[] = [];
  await page.route('https://pagead2.googlesyndication.com/**', route => {
    requests.push(route.request().url());
    return route.abort();
  });
  await page.goto('/privacy/');
  await page.addScriptTag({ content: await adsFixtureScript({ enabled: false }) });
  await expect(page.locator('.ad-placement, ins.adsbygoogle, #trick-it-adsense')).toHaveCount(0);
  expect(requests).toEqual([]);
});

test('enabled slots automatically load one host library and request once per new element', async ({ page }) => {
  let loads = 0;
  await page.route('https://pagead2.googlesyndication.com/**', route => {
    loads++;
    return route.fulfill({ contentType: 'text/javascript', body: mockSdk });
  });
  await page.goto('/privacy/');
  await page.addScriptTag({ content: await adsFixtureScript() });
  expect(await page.evaluate(() => 'trickItAds' in window)).toBe(false);
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
  await page.goto('/id/privacy/');
  await page.addScriptTag({ content: await adsFixtureScript({ placements: { home: '', tool: '1234567890' }, testMode: false }) });
  await expect(page.locator('[data-ad-placement="home"]')).toHaveCount(0);
  await expect(page.locator('ins.adsbygoogle')).not.toHaveAttribute('data-adtest');
  await expect(page.getByRole('complementary', { name: 'Iklan' })).toBeVisible();
});

test('blocked advertising does not break the host or produce uncaught page errors', async ({ page }) => {
  const errors: string[] = [];
  let attempted = false;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://pagead2.googlesyndication.com/**', route => {
    attempted = true;
    return route.abort();
  });
  await page.goto('/privacy/');
  await page.addScriptTag({ content: await adsFixtureScript() });
  await expect.poll(() => attempted).toBe(true);
  await expect(page.locator('#trick-it-adsense')).toHaveCount(0);
  await page.locator('.legal-back').click();
  await expect(page).toHaveURL('/');
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
  await page.goto('/privacy/');
  await page.addScriptTag({ content: await adsFixtureScript({ placements: { home: '', tool: '1234567890' } }) });
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
  await page.goto('/privacy/');
  await page.addScriptTag({ content: await adsFixtureScript({ placements: { home: '', tool: '1234567890' } }) });
  await page.evaluate(kind => window.__hideToolAd(kind), hiding);
  release();
  await expect.poll(() => page.evaluate(() => window.__adRequests?.length)).toBe(0);
  await page.evaluate(() => window.__showToolAd());
  await expect.poll(() => page.evaluate(() => window.__adRequests?.length)).toBe(1);
});
