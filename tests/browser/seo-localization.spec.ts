import { expect, test } from './fixtures';
import { readFile } from 'node:fs/promises';
import { languageCodes } from '../../src/lib/languages.js';
import { SOCIAL_CARD_LOCALES } from '../../src/lib/seo/metadata.js';

const config = JSON.parse(await readFile(new URL('../../src/lib/seo/generated.json', import.meta.url), 'utf8'));
const catalog = JSON.parse(await readFile(new URL('../../src/lib/registry/generated.json', import.meta.url), 'utf8'));
const jsonTool = catalog.find((tool: { id: string }) => tool.id === 'json-tools');

for (const locale of languageCodes) test(`${locale} platform and tool SEO is rendered with safe social cards`, async ({ page }) => {
  let prefix = '';
  if (locale !== 'en') prefix = `/${locale}`;
  await page.goto(`${prefix}/`);
  await expect(page).toHaveTitle(/trick-it/);
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute('content', 'trick-it');
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  const homeSchema = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(homeSchema['@type']).toBe('WebSite');
  expect(homeSchema.inLanguage).toBe(locale);
  await page.goto(`${prefix}/json-tools/`);
  const seo = jsonTool.translations?.[locale]?.seo ?? jsonTool.seo;
  await expect(page).toHaveTitle(`${seo.title} · trick-it`);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', seo.description);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', seo.description);
  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  let cardLocale = 'en';
  if (SOCIAL_CARD_LOCALES.includes(locale)) cardLocale = locale;
  expect(image).toMatch(new RegExp(`/og/tools/json-tools-${cardLocale}\\.[a-f0-9]+\\.png$`));
  const response = await page.request.get(new URL(image!, page.url()).pathname);
  expect(response.ok()).toBe(true);
  expect((await response.body()).subarray(1, 4).toString()).toBe('PNG');
  const schema = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(schema['@type']).toBe('WebApplication');
  expect(schema.softwareVersion).toBe(jsonTool.version);
  let runtimeLanguage = jsonTool.locales?.[0] ?? 'en';
  if (jsonTool.locales?.includes(locale)) runtimeLanguage = locale;
  expect(schema.inLanguage).toBe(runtimeLanguage);
  expect(await page.locator('title').count()).toBe(1);
  const initialHtml = await (await page.request.get(`${prefix}/json-tools/`)).text();
  if (config.origin) {
    expect(initialHtml).toContain(`rel="canonical" href="${config.origin}${prefix}/json-tools/"`);
    expect(initialHtml).not.toContain(`${config.origin}..`);
    const rawSchema = JSON.parse(initialHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
    expect(rawSchema.url).toBe(`${config.origin}${prefix}/json-tools/`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${config.origin}${prefix}/json-tools/`);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${config.origin}${prefix}/json-tools/`);
    await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute('href', `${config.origin}/json-tools/`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index,follow');
    for (const language of languageCodes) {
      let languagePrefix = '';
      if (language !== 'en') languagePrefix = `/${language}`;
      await expect(page.locator(`link[hreflang="${language}"]`)).toHaveAttribute('href', `${config.origin}${languagePrefix}/json-tools/`);
    }
  } else {
    expect(initialHtml).not.toContain('rel="canonical"');
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow');
  }
});

test('language links preserve query/hash and reach the isolated frame', async ({ page }) => {
  await page.goto('/id/json-tools/?keep=1#guide');
  await expect(page.frameLocator('.runtime-workspace > iframe').locator('html')).toHaveAttribute('lang', 'id');
  await page.getByRole('button', { name: 'Bahasa: Bahasa Indonesia' }).click();
  const english = page.getByRole('dialog', { name: 'Bahasa' }).getByRole('link', { name: /English/ });
  await expect(english).toHaveAttribute('href', '/json-tools/?keep=1#guide');
  await english.click();
  await expect(page).toHaveURL(/\/json-tools\/\?keep=1#guide$/);
  await expect(page.frameLocator('.runtime-workspace > iframe').locator('html')).toHaveAttribute('lang', 'en');
});

test('Chinese home uses the correct HTML language and a reviewed fallback social card', async ({ page }) => {
  await page.goto('/zh/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh');
  await expect(page.getByRole('heading', { name: '有什么可以帮你？' })).toBeVisible();
  let robots = 'noindex,nofollow';
  if (config.origin) robots = 'index,follow';
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', robots);
  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(image).toMatch(/\/og\/home-en\.[a-f0-9]+\.png$/);
});
