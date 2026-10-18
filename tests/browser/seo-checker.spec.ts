import { expect, test, type Page } from '@playwright/test';
const report = {
  score: 72, url: 'https://example.com/', fetchedAt: '2026-10-18T02:00:00Z', version: '13.0.0', strategy: 'mobile', warnings: 0,
  audits: [
    { id: 'document-title', score: 0, mode: 'binary', description: 'Add a descriptive title', evidence: ['<html onclick="window.__executed=true">'] },
    { id: 'meta-description', score: 1, mode: 'binary', evidence: [] },
    { id: 'structured-data', score: null, mode: 'manual', evidence: [] },
    { id: 'canonical', score: null, mode: 'error', evidence: [] }
  ]
};
async function protectionFixture(page: Page) {
  await page.route('**/api/tools/seo-checker/audit/config?*', route => route.fulfill({ json: { sitekey:'public-sitekey',action:'svc_audit',turnstile:true,rateLimit:{limit:5,periodSeconds:60} } }));
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?*', route => route.fulfill({ contentType:'application/javascript', body:`window.__turnstileCount=0;window.turnstile={render(container,options){window.__turnstileOptions=options;window.__turnstileContainer=container;const button=document.createElement('button');button.textContent='Verify test';button.onclick=()=>options.callback('test-token-'+(++window.__turnstileCount));container.append(button);return 'widget';},remove(){window.__turnstileContainer?.replaceChildren();},reset(){}};` }));
}
async function start(page: Page, locale = 'en') {
  await protectionFixture(page);
  await page.goto(locale === 'id' ? '/id/seo-checker/' : '/seo-checker/');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: locale === 'id' ? 'Mulai dengan izin terpilih' : 'Start with selected permissions' }).click();
  const tool = page.frameLocator('iframe');
  await expect(tool.getByLabel(locale === 'id' ? 'URL halaman' : 'Page URL')).toBeVisible();
  return tool;
}
for (const locale of ['en', 'id']) test(`SEO audit scores, recommendations and evidence are usable in ${locale}`, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  let calls = 0;
  await page.route('**/api/tools/seo-checker/audit', async route => {
    calls++;
    expect(route.request().postDataJSON()).toMatchObject({ version: '0.2.0', input: { url: 'https://example.com/', strategy: 'mobile', locale }, turnstileToken: 'test-token-1' });
    await route.fulfill({ json: report });
  });
  const tool = await start(page, locale);
  await tool.getByRole('textbox').fill('https://example.com/');
  await tool.getByRole('button', { name: locale === 'id' ? 'Periksa SEO' : 'Check SEO', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('https://example.com/', { exact: true })).toBeVisible();
  expect(calls).toBe(0);
  await expect(page.getByRole('button', { name: locale === 'id' ? 'Izinkan sekali' : 'Allow once', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Verify test', exact: true }).click();
  await page.getByRole('button', { name: locale === 'id' ? 'Izinkan sekali' : 'Allow once', exact: true }).click();
  await expect(tool.locator('.score')).toContainText('72');
  await expect(tool.getByRole('heading', { name: locale === 'id' ? 'Judul halaman' : 'Page title', exact: true })).toBeVisible();
  await expect(tool.getByRole('heading', { name: locale === 'id' ? 'Periksa secara manual (1)' : 'Check manually (1)' })).toBeVisible();
  await tool.getByText(locale === 'id' ? 'Bukti dari halaman' : 'Page evidence', { exact: true }).click();
  await expect(tool.locator('pre')).toContainText('<html onclick=');
  const frame = page.frames().find(frame => frame !== page.mainFrame())!;
  expect(await frame.evaluate(() => (window as unknown as { __executed?: boolean }).__executed)).toBeUndefined();
  expect(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
  await expect(tool.getByRole('textbox')).toHaveValue('https://example.com/');
  await expect(tool.locator('.score')).toContainText('72');
  // Exercise the actual one-way locale bridge in the live sandbox without reload.
  await page.evaluate(target => document.querySelector('iframe')!.contentWindow!.postMessage({ type: 'trick-it:locale', version: 1, locale: target }, '*'), locale === 'id' ? 'en' : 'id');
  await expect(tool.getByRole('button', { name: locale === 'id' ? 'Check SEO' : 'Periksa SEO', exact: true })).toBeVisible();
  await expect(tool.getByRole('textbox')).toHaveValue('https://example.com/');
  await expect(tool.locator('.score')).toContainText('72');
  expect(calls).toBe(1);
});
test('denial and quota failure preserve URL and never manufacture a score', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/tools/seo-checker/audit', async route => { calls++; await route.fulfill({ status: 429, json: { error: 'provider-quota' } }); });
  const tool = await start(page);
  await tool.getByRole('textbox').fill('https://example.com/');
  await tool.getByRole('button', { name: 'Check SEO', exact: true }).click();
  await page.getByRole('button', { name: 'Deny', exact: true }).click();
  await expect(tool.getByRole('alert')).toBeVisible();
  expect(calls).toBe(0);
  await tool.getByRole('button', { name: 'Check SEO', exact: true }).click();
  await page.getByRole('button', { name: 'Verify test', exact: true }).click();
  await page.getByRole('button', { name: 'Allow once', exact: true }).click();
  await expect(tool.getByRole('alert')).toContainText('audit limit');
  await expect(tool.getByRole('textbox')).toHaveValue('https://example.com/');
  await expect(tool.locator('.score')).toHaveCount(0);
});


test('Turnstile expiry blocks approval and each retry uses a fresh token', async ({ page }) => {
  const tokens: string[] = [];
  await page.route('**/api/tools/seo-checker/audit', async route => { tokens.push(route.request().postDataJSON().turnstileToken);await route.fulfill({json:report}); });
  const tool = await start(page);
  await tool.getByRole('textbox').fill('https://example.com/');
  await tool.getByRole('button',{name:'Check SEO',exact:true}).click();
  await page.getByRole('button',{name:'Verify test',exact:true}).click();
  const allow = page.getByRole('button',{name:'Allow once',exact:true});
  await expect(allow).toBeEnabled();
  await page.evaluate(()=>(window as unknown as {__turnstileOptions: Record<string,()=>void>}).__turnstileOptions['expired-callback']());
  await expect(allow).toBeDisabled();
  await page.getByRole('button',{name:'Verify test',exact:true}).click();
  await allow.click();
  await expect(tool.locator('.score')).toBeVisible();
  await tool.getByRole('button',{name:'Check SEO',exact:true}).click();
  await expect(allow).toBeDisabled();
  await page.getByRole('button',{name:'Verify test',exact:true}).click();
  await allow.click();
  await expect.poll(()=>tokens.length).toBe(2);
  expect(tokens[0]).not.toBe(tokens[1]);
});
test('local tools never load a Turnstile widget', async ({page})=>{
  const urls: string[]=[];page.on('request',r=>urls.push(r.url()));
  await page.goto('/id-generator/');
  await expect(page.frameLocator('iframe').getByRole('heading',{name:'ID Generator'})).toBeVisible();
  expect(urls.some(url=>url.includes('challenges.cloudflare.com'))).toBe(false);
});

test('outdated service metadata explains reload instead of an endless CAPTCHA retry', async ({page})=>{
  const tool=await start(page);
  await page.route('**/api/tools/seo-checker/audit/config?*',route=>route.fulfill({status:409,json:{error:'stale-release'}}));
  await tool.getByRole('textbox').fill('https://example.com/');
  await tool.getByRole('button',{name:'Check SEO',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('This tool release is outdated');
  await expect(page.getByRole('button',{name:'Allow once',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Retry security check',exact:true})).toHaveCount(0);
});
