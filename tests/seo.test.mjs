import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { siteOrigin, localePath, safeJsonLd, seoMetadata, SEO_LOCALES, SOCIAL_CARD_LOCALES } from '../src/lib/seo/metadata.js';
import { languageCodes } from '../src/lib/languages.js';
import { socialCardSvg, wrapText, sitemapXml, robotsText, generateSeo } from '../scripts/generate-seo.mjs';

const origin = 'https://tools.example';
const tool = { id: 'json-tools', path: '/json-tools', name: 'JSON Tools', description: 'Format JSON locally.', version: '0.3.0', category: 'data', seo: { title: 'Format JSON', description: 'A useful JSON formatter.', keywords: ['json'], robots: 'index' }, translations: { id: { name: 'Alat JSON', description: 'Rapikan JSON.', seo: { title: 'Rapikan JSON', description: 'Alat pemformat JSON.', keywords: ['json'], robots: 'index' } } } };

test('production origin is explicit HTTPS and never contains private query or credential data', () => {
  assert.equal(siteOrigin(''), '');
  assert.equal(siteOrigin(`${origin}/`), origin);
  for (const value of ['http://tools.example', 'https://user:secret@tools.example', `${origin}/app`, `${origin}/?token=secret`, `${origin}/#fragment`, 'not-a-url']) assert.throws(() => siteOrigin(value), /PUBLIC_SITE_URL/);
});

test('canonical URLs strip tracking parameters and retain locale, base and clean route', () => {
  assert.equal(localePath('/id/json-tools/?token=secret#editor', 'en'), '/json-tools/');
  assert.equal(localePath('/app/id/json-tools/', 'id', '/app'), '/app/id/json-tools/');
  for (const path of ['https://evil.example/', '//evil.example/', '/one/../two', '/bad\\path']) assert.throws(() => localePath(path), /SEO path/);
  const view = seoMetadata({ title: tool.seo.title, description: tool.description, path: '/id/json-tools/?private=input', origin, locale: 'id', tool });
  assert.equal(view.canonical, `${origin}/id/json-tools/`);
  assert.equal(view.defaultHref, `${origin}/json-tools/`);
  assert.equal(view.image, `${origin}/og/tools/json-tools-id.png`);
  assert.equal(view.locale, 'id_ID');
  assert.equal(view.robots, 'index,follow');
  assert.equal(view.schema['@type'], 'WebApplication');
  assert.equal(view.schema.softwareVersion, '0.3.0');
  assert.equal(view.schema.offers, undefined);
  assert.ok(!JSON.stringify(view).includes('private=input'));
});

test('configured mount prefixes are absolute and never use prerender-relative bases', () => {
  const base = '/apps/trick-it';
  for (const locale of ['en', 'id']) {
    const prefix = locale === 'id' ? '/id' : '';
    const view = seoMetadata({ title: tool.name, description: tool.description, path: `${base}/id/json-tools/?private=1#input`, base, origin, locale, tool });
    assert.equal(view.canonical, `${origin}${base}${prefix}/json-tools/`);
    assert.equal(view.image, `${origin}${base}/og/tools/json-tools-${locale}.png`);
    assert.equal(view.schema.url, view.canonical);
    assert.ok(view.alternates.every((alternate) => alternate.href.startsWith(`${origin}${base}/`)));
  }
  for (const base of ['..', '../..', '/app/', '//elsewhere', '/app/../other']) assert.throws(() => seoMetadata({ title: 'Tool', description: 'A tool.', path: '/', origin, base }), /SEO base/);
});

test('unconfigured previews and nonindexable tools cannot become searchable accidentally', () => {
  const preview = seoMetadata({ title: 'trick-it', description: 'Utilities.', path: '/' });
  assert.equal(preview.robots, 'noindex,nofollow');
  assert.equal(preview.canonical, '');
  assert.deepEqual(preview.alternates, []);
  assert.equal(preview.schema['@type'], 'WebSite');
  assert.equal(preview.schema.potentialAction, undefined);
  for (const locale of languageCodes) {
    assert.equal(seoMetadata({ title: tool.name, description: tool.description, path: tool.path, origin, locale, robots: 'noindex' }).robots, 'noindex,nofollow');
    assert.equal(seoMetadata({ title: tool.name, description: tool.description, path: tool.path, locale }).robots, 'noindex,nofollow');
  }
});

test('JSON-LD and host-authored social SVG escape hostile metadata and bound long copy', () => {
  const hostile = '</script><script>alert("private")</script>\u2028\u2029';
  const json = safeJsonLd({ description: hostile });
  assert.ok(!json.includes('<'));
  assert.ok(!json.includes('\u2028'));
  assert.deepEqual(JSON.parse(json), { description: hostile });
  const svg = socialCardSvg({ title: '</text><script>', description: '" onload="alert(1) & private', locale: 'id' });
  assert.ok(svg.includes('&lt;script&gt;'));
  assert.ok(svg.includes('&amp;'));
  assert.ok(!svg.includes('<script>'));
  assert.ok(!svg.includes(' onload="'));
  assert.equal(wrapText('A'.repeat(1000), 29, 3).length, 3);
  assert.ok(wrapText('A'.repeat(1000), 29, 3).at(-1).endsWith('…'));
});

test('sitemap and robots cover real locale routes and omit noindex tools without invented timestamps', () => {
  const hidden = { ...tool, id: 'hidden', path: '/hidden', seo: { ...tool.seo, robots: 'noindex' }, translations: {} };
  const xml = sitemapXml([tool, hidden], origin);
  assert.ok(xml.includes(`${origin}/json-tools/`));
  assert.ok(xml.includes(`${origin}/id/json-tools/`));
  assert.ok(xml.includes('xhtml:link rel="alternate" hreflang="id"'));
  assert.ok(!xml.includes('/hidden/'));
  assert.ok(!xml.includes('<lastmod>'));
  assert.ok(xml.includes(`hreflang="x-default" href="${origin}/json-tools/"`));
  const withImages = sitemapXml([tool], origin, '', { 'tools/json-tools-en': '/og/tools/json-tools-en.abc.png', 'home-id': '/og/home-id.def.png' });
  assert.ok(withImages.includes(`<image:loc>${origin}/og/tools/json-tools-en.abc.png</image:loc>`));
  assert.ok(withImages.includes(`<image:loc>${origin}/og/home-id.def.png</image:loc>`));
  assert.ok(withImages.includes('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'));
  assert.ok(!sitemapXml([tool], '').includes('<loc>'));
  assert.match(robotsText(''), /Disallow: \//);
  assert.ok(robotsText(origin).includes(`Sitemap: ${origin}/sitemap.xml`));
});

test('production catalog sitemap contains every host locale and indexable tool route', async () => {
  const tools = JSON.parse(await readFile(new URL('../src/lib/registry/generated.json', import.meta.url), 'utf8'));
  const xml = sitemapXml(tools, origin);
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(new Set(urls).size, urls.length);
  let indexableToolRoutes = 0;
  for (const locale of languageCodes) {
    for (const path of ['/', '/privacy/', '/terms/', '/policy/']) {
      assert.ok(urls.includes(`${origin}${localePath(path, locale)}`), `Missing ${locale} ${path}`);
    }
    for (const entry of tools) {
      const seo = entry.translations?.[locale]?.seo ?? entry.seo;
      const indexable = seo?.robots !== 'noindex';
      assert.equal(urls.includes(`${origin}${localePath(entry.path, locale)}`), indexable, `${locale} ${entry.path}`);
      if (indexable) indexableToolRoutes += 1;
    }
  }
  assert.equal(urls.length, languageCodes.length * 4 + indexableToolRoutes);
});

test('sitemap respects locale-specific noindex while retaining other translations', () => {
  const localized = { ...tool, translations: { ...tool.translations, zh: { seo: { ...tool.seo, robots: 'noindex' } } } };
  const xml = sitemapXml([localized], origin);
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.equal(urls.length, languageCodes.length * 5 - 1);
  assert.ok(!urls.includes(`${origin}/zh/json-tools/`));
  assert.ok(urls.includes(`${origin}/ja/json-tools/`));
});

test('generation writes cache-busted social cards and config, keeping a tool named home separate', async () => {
  const root = await mkdtemp(join(tmpdir(), 'trick-it-seo-'));
  try {
    await mkdir(join(root, 'src/lib/registry'), { recursive: true });
    await mkdir(join(root, 'messages'), { recursive: true });
    await writeFile(join(root, 'src/lib/registry/generated.json'), JSON.stringify([tool, { ...tool, id: 'home', path: '/home', name: 'Home tool' }]));
    for (const locale of languageCodes) await writeFile(join(root, `messages/${locale}.json`), JSON.stringify({ home_title: `trick-it ${locale}`, home_description: 'Local utilities.' }));
    // The production renderer is Resvg. This deterministic byte renderer keeps the
    // file/layout/cache-key test independent of native binaries and font setup.
    let renderedCards = 0;
    const renderer = (svg) => {
      renderedCards += 1;
      return Buffer.from(svg);
    };
    const result = await generateSeo({ root, origin, renderer });
    assert.equal(renderedCards, SOCIAL_CARD_LOCALES.length * 3);
    assert.equal(Object.keys(result.images).length, languageCodes.length * 3);
    assert.notEqual(result.images['home-en'], result.images['tools/home-en']);
    assert.match(result.images['tools/json-tools-id'], /^\/og\/tools\/json-tools-id\.[a-f0-9]{16}\.png$/);
    assert.ok((await readFile(join(root, 'static', result.images['home-en'].slice(1)))).length);
    assert.ok((await readFile(join(root, 'static/og/tools/home-en.png'))).length);
    const configuration = JSON.parse(await readFile(join(root, 'src/lib/seo/generated.json'), 'utf8'));
    assert.equal(configuration.origin, origin);
    assert.equal(configuration.base, '');
    assert.deepEqual(configuration.images, result.images);
    const sitemap = await readFile(join(root, 'static/sitemap.xml'), 'utf8');
    assert.equal([...sitemap.matchAll(/<loc>/g)].length, languageCodes.length * 6);
    for (const locale of languageCodes) {
      assert.ok(sitemap.includes(`${origin}${localePath('/home/', locale)}`));
      assert.ok(result.images[`home-${locale}`]);
      assert.ok(result.images[`tools/json-tools-${locale}`]);
      assert.ok(result.images[`tools/home-${locale}`]);
      if (!SOCIAL_CARD_LOCALES.includes(locale)) {
        assert.equal(result.images[`home-${locale}`], result.images['home-en']);
        assert.equal(result.images[`tools/json-tools-${locale}`], result.images['tools/json-tools-en']);
        assert.equal(result.images[`tools/home-${locale}`], result.images['tools/home-en']);
      }
    }
    assert.ok((await readFile(join(root, 'static/robots.txt'), 'utf8')).includes('Allow: /'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('all supported languages have indexed canonical routes, alternates and safe social cards', () => {
  assert.deepEqual(SEO_LOCALES, languageCodes);
  assert.equal(languageCodes.length, 12);
  for (const code of languageCodes.filter((language) => language !== 'en')) {
    assert.equal(localePath('/id/json-tools/', code), `/${code}/json-tools/`);
    assert.equal(localePath(`/${code}/privacy/`, 'en'), '/privacy/');
    const view = seoMetadata({ title: 'Tool', description: 'A tool.', path: '/json-tools/', origin, locale: code });
    assert.equal(view.path, `/${code}/json-tools/`);
    assert.equal(view.robots, 'index,follow');
    let cardLocale = 'en';
    if (SOCIAL_CARD_LOCALES.includes(code)) cardLocale = code;
    assert.equal(view.image, `${origin}/og/home-${cardLocale}.png`);
    assert.deepEqual(view.alternates.map(({ locale }) => locale), languageCodes);
    assert.ok(view.locale !== 'en_US');
  }
});
