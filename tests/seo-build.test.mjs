import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { verifySeoBuild } from '../scripts/verify-seo.mjs';
import { sitemapXml, robotsText } from '../scripts/generate-seo.mjs';
import { languageCodes } from '../src/lib/languages.js';

const origin = 'https://tools.example';

async function fixture(site = origin) {
  const root = await mkdtemp(join(tmpdir(), 'trick-it-seo-build-'));
  const save = async (name, value) => {
    const path = join(root, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, value);
  };
  const tools = [];
  await save('wrangler.jsonc', JSON.stringify({ routes: [{ pattern: 'tools.example', custom_domain: true }] }));
  await save('src/lib/registry/generated.json', JSON.stringify(tools));
  await save('src/lib/seo/generated.json', JSON.stringify({ origin: site, base: '', images: {} }));
  await save('build/sitemap.xml', sitemapXml(tools, site));
  await save('build/robots.txt', robotsText(site));

  if (site) {
    for (const url of sitemapXml(tools, site).matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const pathname = new URL(url[1]).pathname.replace(/^\//, '');
      await save(join('build', pathname, 'index.html'), '<html>Published page</html>');
    }
  }
  return { root, save };
}

test('production build requires canonical, nonempty sitemap and real localized HTML files', async () => {
  const { root } = await fixture();
  try {
    assert.deepEqual(await verifySeoBuild({ root, requireProduction: true }), { origin, pages: languageCodes.length * 4 });
    await unlink(join(root, 'build/id/privacy/index.html'));
    await assert.rejects(verifySeoBuild({ root, requireProduction: true }), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('a tampered or truncated sitemap fails validation before deployment', async () => {
  const { root, save } = await fixture();
  try {
    await save('build/sitemap.xml', '<urlset></urlset>');
    await assert.rejects(verifySeoBuild({ root }), /Published sitemap does not match/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('preview builds remain noindex and can never pass the production gate', async () => {
  const { root } = await fixture('');
  try {
    assert.deepEqual(await verifySeoBuild({ root }), { origin: '', pages: 0 });
    await assert.rejects(verifySeoBuild({ root, requireProduction: true }), /Production SEO: PUBLIC_SITE_URL/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
