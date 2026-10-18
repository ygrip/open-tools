import { expect, test, type Frame, type Page } from '@playwright/test';
import { mountFixture } from './runtime-fixture';

async function start(page: Page) {
  await page.route('**/api/tools/runtime-fixture/audit/config?*', route => route.fulfill({ json: { sitekey: 'public-sitekey', action: 'svc_fixture', turnstile: true, rateLimit: { limit: 5, periodSeconds: 60 } } }));
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?*', route => route.fulfill({ contentType: 'application/javascript', body: `window.__turnstileCount=0;window.turnstile={render(container,options){window.__turnstileOptions=options;window.__turnstileContainer=container;const button=document.createElement('button');button.textContent='Verify test';button.onclick=()=>options.callback('test-token-'+(++window.__turnstileCount));container.append(button);return 'widget';},remove(){window.__turnstileContainer?.replaceChildren();},reset(){}};` }));
  await mountFixture(page, {
    permissions: [{ name: 'services', reason: 'Use the test service.', required: true }],
    services: [{ id: 'audit', handler: 'pagespeed-seo', rateLimit: { limit: 5, periodSeconds: 60 }, turnstile: true }]
  });
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  return page.frames().find(frame => frame !== page.mainFrame())!;
}

function request(frame: Frame) {
  return frame.evaluate(async () => {
    const sdk = (window as unknown as { trickIt: { request: (operation: string, payload: unknown) => Promise<unknown> } }).trickIt;
    try { return await sdk.request('services', { feature: 'audit', input: { url: 'https://example.com/', strategy: 'mobile', locale: 'en' } }); }
    catch (error) { return { error: (error as { code: string }).code }; }
  });
}

test('service consent sends the declared release and token only after verification', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/tools/runtime-fixture/audit', async route => {
    calls++;
    expect(route.request().postDataJSON()).toMatchObject({ version: '1.0.0', input: { url: 'https://example.com/', strategy: 'mobile', locale: 'en' }, turnstileToken: 'test-token-1' });
    await route.fulfill({ json: { result: 'provider response' } });
  });
  const frame = await start(page);
  const pending = request(frame);
  await expect(page.getByRole('dialog').getByText('https://example.com/', { exact: true })).toBeVisible();
  const allow = page.getByRole('button', { name: 'Allow', exact: true });
  await expect(allow).toBeDisabled();
  expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Verify test', exact: true }).click();
  await allow.click();
  expect(await pending).toEqual({ result: 'provider response' });
  expect(calls).toBe(1);
});

test('denial avoids the endpoint and provider quota becomes a broker error', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/tools/runtime-fixture/audit', async route => { calls++; await route.fulfill({ status: 429, json: { error: 'provider-quota' } }); });
  const frame = await start(page);
  const denied = request(frame);
  await page.getByRole('button', { name: 'Don’t allow', exact: true }).click();
  expect(await denied).toEqual({ error: 'denied' });
  expect(calls).toBe(0);
  const limited = request(frame);
  await page.getByRole('button', { name: 'Verify test', exact: true }).click();
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  expect(await limited).toEqual({ error: 'quota' });
});

test('Turnstile expiry blocks approval and retries require fresh tokens', async ({ page }) => {
  const tokens: string[] = [];
  await page.route('**/api/tools/runtime-fixture/audit', async route => { tokens.push(route.request().postDataJSON().turnstileToken); await route.fulfill({ json: {} }); });
  const frame = await start(page);
  const pending = request(frame);
  const allow = page.getByRole('button', { name: 'Allow', exact: true });
  await page.getByRole('button', { name: 'Verify test', exact: true }).click();
  await expect(allow).toBeEnabled();
  await page.evaluate(() => (window as unknown as { __turnstileOptions: Record<string, () => void> }).__turnstileOptions['expired-callback']());
  await expect(allow).toBeDisabled();
  await page.getByRole('button', { name: 'Verify test', exact: true }).click();
  await allow.click();
  await pending;
  const retry = request(frame);
  await expect(allow).toBeDisabled();
  await page.getByRole('button', { name: 'Verify test', exact: true }).click();
  await allow.click();
  await retry;
  expect(tokens).toHaveLength(2);
  expect(tokens[0]).not.toBe(tokens[1]);
});

test('local tools never load Turnstile', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', r => urls.push(r.url()));
  await mountFixture(page);
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  expect(urls.some(url => url.includes('challenges.cloudflare.com'))).toBe(false);
});

test('stale service config requires reload and keeps approval blocked', async ({ page }) => {
  const frame = await start(page);
  await page.route('**/api/tools/runtime-fixture/audit/config?*', route => route.fulfill({ status: 409, json: { error: 'stale-release' } }));
  const pending = request(frame);
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('This tool release is outdated');
  await expect(page.getByRole('button', { name: 'Allow', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Retry security check', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Don’t allow', exact: true }).click();
  expect(await pending).toEqual({ error: 'denied' });
});
