import { expect, test } from '@playwright/test';

/**
 * Regression test for the actual pinned Who Track Me bundle, not a synthetic
 * service fixture. This catches a deployed pin that leaves Analyze inert.
 */
test('Who Track Me URL Analyze opens permission, runs protected audit, and renders evidence', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/tools/who-track-me/audit/config?*', route =>
    route.fulfill({ json: { sitekey: 'public-sitekey', action: 'svc_test_whotrackme', turnstile: true, rateLimit: { limit: 4, periodSeconds: 60 } } }));
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?*', route =>
    route.fulfill({ contentType: 'application/javascript', body:
      "window.turnstile={render(el,options){const button=document.createElement('button');button.textContent='Verify test';button.onclick=()=>options.callback('test-token');el.append(button);return 'mock';},remove(){},reset(){}};"
    }));
  await page.route('**/api/tools/who-track-me/audit', route => {
    calls++;
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({
      version: '0.2.1', input: { url: 'https://example.org/', strategy: 'mobile', locale: 'en' },
      turnstileToken: 'test-token'
    });
    return route.fulfill({ json: {
      source: 'automatic', page: 'https://example.org/', at: '2026-10-20T00:00:00Z',
      scripts: [], resources: [
        { url: 'https://www.google-analytics.com/collect', initiator: 'Lighthouse request' }
      ], cookies: [], events: [], gtm: ['GTM-TEST01'], flags: ['dataLayer referenced'],
      storage: { local: [], session: [] }, coverage: {
        html: true, network: true, cookies: true, dataLayer: 'source-references-only',
        storage: 'not-accessible', rendered: true
      }, notes: [], evidence: []
    } });
  });
  await page.goto('/who-track-me/');
  const tool = page.frameLocator('iframe');
  await expect(tool.getByRole('heading', { name: 'Who Track Me' })).toBeVisible();
  await expect(tool.locator('form')).toHaveCount(0);
  const analyze = tool.getByRole('button', { name: /Analyze website/i });
  await expect(analyze).toHaveAttribute('type', 'button');
  await tool.locator('#website').fill('https://example.org');
  await analyze.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('https://example.org/', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Verify test' }).click();
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  await expect(tool.locator('#results')).toBeVisible();
  await expect(tool.locator('#n-trackers')).toHaveText('1');
  await expect(tool.locator('#target-label')).toHaveText('https://example.org/');
  expect(calls).toBe(1);
});
