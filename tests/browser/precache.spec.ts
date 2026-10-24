import { expect, test } from './fixtures';

// Set DEPLOY_URL to run against a deployed site (see playwright.config.ts); otherwise runs against the local preview build.
test('every precached URL responds 200 without redirecting', async ({ page, request }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  const urls = await page.evaluate(async () => {
    const shell = (await caches.keys()).filter((key) => key.startsWith('trick-it-shell-'));
    const found: string[] = [];
    for (const key of shell) for (const entry of await (await caches.open(key)).keys()) found.push(entry.url);
    return [...new Set(found)];
  });
  expect(urls.length).toBeGreaterThan(0);
  expect(urls).toContain(new URL('/offline/', page.url()).href);
  expect(urls.some((url) => url.endsWith('/offline/index.html'))).toBe(false);
  const failures: string[] = [];
  for (const url of urls) {
    // The request fixture bypasses the service worker, so this hits the server itself.
    const response = await request.get(url, { maxRedirects: 0, failOnStatusCode: false });
    if (response.status() !== 200) failures.push(`${response.status()} ${url}${response.headers().location ? ` -> ${response.headers().location}` : ''}`);
  }
  expect(failures, `Precached URLs not returning a direct 200:\n${failures.join('\n')}`).toEqual([]);
});
