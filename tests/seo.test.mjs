import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { siteOrigin, localePath, safeJsonLd, seoMetadata } from '../src/lib/seo/metadata.js';
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
  assert.equal(seoMetadata({ title: tool.name, description: tool.description, path: tool.path, origin, robots: 'noindex' }).robots, 'noindex,nofollow');
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

test('generation writes cache-busted social cards and config, keeping a tool named home separate', async () => {
  const root = await mkdtemp(join(tmpdir(), 'trick-it-seo-'));
  try {
    await mkdir(join(root, 'src/lib/registry'), { recursive: true });
    await mkdir(join(root, 'messages'), { recursive: true });
    await writeFile(join(root, 'src/lib/registry/generated.json'), JSON.stringify([tool, { ...tool, id: 'home', path: '/home', name: 'Home tool' }]));
    for (const locale of ['en', 'id']) await writeFile(join(root, `messages/${locale}.json`), JSON.stringify({ home_title: `trick-it ${locale}`, home_description: 'Local utilities.' }));
    // The production renderer is Resvg. This deterministic byte renderer keeps the
    // file/layout/cache-key test independent of native binaries and font setup.
    const renderer = (svg) => Buffer.from(svg);
    const result = await generateSeo({ root, origin, renderer });
    assert.equal(Object.keys(result.images).length, 6);
    assert.notEqual(result.images['home-en'], result.images['tools/home-en']);
    assert.match(result.images['tools/json-tools-id'], /^\/og\/tools\/json-tools-id\.[a-f0-9]{16}\.png$/);
    assert.ok((await readFile(join(root, 'static', result.images['home-en'].slice(1)))).length);
    assert.ok((await readFile(join(root, 'static/og/tools/home-en.png'))).length);
    const configuration = JSON.parse(await readFile(join(root, 'src/lib/seo/generated.json'), 'utf8'));
    assert.equal(configuration.origin, origin);
    assert.equal(configuration.base, '');
    assert.deepEqual(configuration.images, result.images);
    assert.ok((await readFile(join(root, 'static/sitemap.xml'), 'utf8')).includes(`${origin}/id/home/`));
    assert.ok((await readFile(join(root, 'static/robots.txt'), 'utf8')).includes('Allow: /'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('additional languages have stable prefixed routes without falsely advertising indexed translations', () => {
  for (const code of ['ms', 'fil', 'th', 'vi', 'zh', 'my', 'km', 'lo', 'ja', 'hi']) {
    assert.equal(localePath('/id/json-tools/', code), `/${code}/json-tools/`);
    assert.equal(localePath(`/${code}/privacy/`, 'en'), '/privacy/');
    const view = seoMetadata({ title: 'Tool', description: 'A tool.', path: '/json-tools/', origin, locale: code });
    assert.equal(view.path, `/${code}/json-tools/`);
    assert.equal(view.robots, 'noindex,nofollow');
    assert.equal(view.image, `${origin}/og/home-en.png`);
    assert.ok(view.locale !== 'en_US');
  }
});
