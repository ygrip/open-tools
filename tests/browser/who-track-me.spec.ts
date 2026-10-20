import { expect, test, type Page } from '@playwright/test';

// Regression: tool iframes intentionally lack sandbox="allow-forms".
// A submit-based Analyze button silently does nothing in Chromium.
// Exercise the actual pinned tool, SDK, permission broker and result table.
test.use({ serviceWorkers: 'block' });

async function stubAudit(page: Page) {
  let requests = 0;
  await page.route('**/api/tools/who-track-me/audit/config?*', route => route.fulfill({
    json: { sitekey: 'test-sitekey', action: 'svc_whotrackme_test', turnstile: true, rateLimit: { limit: 4, periodSeconds: 60 } }
  }));
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?*', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'window.turnstile={render(container,options){const button=document.createElement("button");button.textContent="Verify test";button.type="button";button.onclick=()=>options.callback("test-token");container.append(button);return "widget";},remove(){},reset(){}};'
  }));
  await page.route('**/api/tools/who-track-me/audit', async route => {
    requests++;
    expect(route.request().postDataJSON()).toMatchObject({
      input: { url: 'https://example.org/', strategy: 'mobile', locale: 'en' },
      turnstileToken: 'test-token'
    });
    await route.fulfill({ json: {
      source: 'automatic', page: 'https://example.org/', at: '2026-10-20T00:00:00Z',
      scripts: [], resources: [{ url: 'https://www.google-analytics.com/g/collect', initiator: 'Lighthouse request' }],
      cookies: [{ name: '_ga', type: 'Google Analytics / Ads', risk: 'medium', sameSite: 'Lax', httpOnly: false, secure: true }],
      events: [], gtm: ['GTM-EXAMPLE1'], flags: ['dataLayer referenced'],
      storage: { local: [], session: [] }, coverage: { html: true, network: true, cookies: true },
      notes: ['Test fixture only']
    } });
  });
  return () => requests;
}

test('Analyze button opens protected audit and renders evidence, without form submission', async ({ page }) => {
  const count = await stubAudit(page);
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error' && message.text().includes('form')) errors.push(message.text()); });
  await page.goto('/who-track-me/');
  const tool = page.frameLocator('iframe');
  await expect(tool.getByRole('button', { name: /Analyze website/ })).toBeVisible();
  await tool.locator('#website').fill('https://example.org/');
  expect(await tool.locator('#run-audit').getAttribute('type')).toBe('button');
  await tool.locator('#run-audit').click();

  const consent = page.getByRole('dialog', { name: 'Allow this tool action?' });
  await expect(consent).toBeVisible();
  await expect(consent).toContainText('https://example.org/');
  await expect(tool.locator('#run-audit')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Allow', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Verify test', exact: true }).click();
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  await expect(tool.locator('#results')).toBeVisible();
  await expect(tool.locator('#n-trackers')).toHaveText('1');
  await expect(tool.locator('.ti-grid tbody tr').first()).toContainText('Google Analytics');
  await expect(tool.locator('#run-audit')).toBeEnabled();
  expect(count()).toBe(1);
  expect(errors).toEqual([]);
});

test('pressing Enter in the URL field starts the same audit, with bare domains supported', async ({ page }) => {
  let requestedUrl = '';
  await page.route('**/api/tools/who-track-me/audit/config?*', route => route.fulfill({
    json: { sitekey: 'test-sitekey', action: 'svc_whotrackme_test', turnstile: true, rateLimit: { limit: 4, periodSeconds: 60 } }
  }));
  await page.goto('/who-track-me/');
  const tool = page.frameLocator('iframe');
  await tool.locator('#website').fill('example.org');
  await tool.locator('#website').press('Enter');
  const consent = page.getByRole('dialog', { name: 'Allow this tool action?' });
  await expect(consent).toBeVisible();
  await expect(consent).toContainText('https://example.org/');
  await expect(tool.locator('#website')).toHaveValue('example.org');
  await page.getByRole('button', { name: 'Don’t allow', exact: true }).click();
  await expect(tool.locator('#run-audit')).toBeEnabled();
  expect(requestedUrl).toBe('');
});


test('Indonesian copy covers a finished scan and switches language without losing results', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/tools/who-track-me/audit/config?*', route => route.fulfill({
    json: { sitekey: 'test-sitekey', action: 'svc_whotrackme_test', turnstile: true, rateLimit: { limit: 4, periodSeconds: 60 } }
  }));
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?*', route => route.fulfill({
    contentType: 'application/javascript',
    body: 'window.turnstile={render(container,options){const button=document.createElement("button");button.textContent="Verify test";button.type="button";button.onclick=()=>options.callback("test-token");container.append(button);return "widget";},remove(){},reset(){}};'
  }));
  await page.route('**/api/tools/who-track-me/audit', async route => {
    requests++;
    expect(route.request().postDataJSON().input.locale).toBe('id');
    await route.fulfill({ json: {
      source:'automatic',page:'https://example.org/',at:'2026-10-20T00:00:00Z',
      scripts:[],resources:[{url:'https://www.google-analytics.com/g/collect',initiator:'Lighthouse request'}],
      cookies:[{name:'_ga',type:'Google Analytics / Ads',risk:'medium',sameSite:'Lax',httpOnly:false,secure:true}],
      events:[],gtm:['GTM-EXAMPLE1'],flags:['dataLayer referenced'],storage:{local:[],session:[]},
      coverage:{html:true,network:true,cookies:true},notes:[]
    }});
  });
  await page.goto('/id/who-track-me/');
  const tool = page.frameLocator('iframe');
  await expect(tool.locator('#run-audit')).toHaveText('Periksa situs →');
  await expect(tool.getByText('Situs mana yang ingin diperiksa?')).toBeVisible();
  await tool.locator('#website').fill('example.org');
  await tool.locator('#run-audit').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Verify test', exact: true }).click();
  await page.getByRole('button', { name: 'Izinkan', exact: true }).click();
  await expect(tool.locator('#results')).toBeVisible();
  await expect(tool.locator('#n-trackers')).toHaveText('1');
  await expect(tool.locator('#table-title')).toHaveText('Domain dan pelacak teridentifikasi');
  await expect(tool.locator('#findings-note')).toContainText('Nol temuan bukan bukti');
  await page.evaluate(() => {
    document.querySelector('iframe')?.contentWindow?.postMessage(
      { type: 'trick-it:locale', version: 1, locale: 'en' }, '*'
    );
  });
  await expect(tool.locator('#run-audit')).toHaveText('Analyze website →');
  await expect(tool.locator('#table-title')).toHaveText('Identified hosts and trackers');
  await expect(tool.locator('#n-trackers')).toHaveText('1');
  await expect(tool.locator('#website')).toHaveValue('example.org');
  await page.evaluate(() => {
    document.querySelector('iframe')?.contentWindow?.postMessage(
      { type: 'trick-it:locale', version: 1, locale: 'id' }, '*'
    );
  });
  await expect(tool.locator('#run-audit')).toHaveText('Periksa situs →');
  await expect(tool.locator('#table-title')).toHaveText('Domain dan pelacak teridentifikasi');
  expect(requests).toBe(1);
});
