import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { siteOrigin } from '../src/lib/seo/metadata.js';
import { sitemapXml, robotsText, productionOrigin } from './generate-seo.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

/** Check the *deployed artifact*, not only files produced before Vite runs. */
export async function verifySeoBuild({ root = projectRoot, requireProduction = false } = {}) {
  const read = (name) => readFile(join(root, name), 'utf8');
  const [metadata, tools, sitemap, robots] = await Promise.all([
    read('src/lib/seo/generated.json').then(JSON.parse),
    read('src/lib/registry/generated.json').then(JSON.parse),
    read('build/sitemap.xml'),
    read('build/robots.txt')
  ]);
  const origin = siteOrigin(metadata.origin);
  const base = metadata.base ?? '';

  if (requireProduction) {
    const deployedOrigin = await productionOrigin(root);
    assert.ok(deployedOrigin, 'Production SEO: no custom domain found in wrangler.jsonc');
    assert.equal(origin, deployedOrigin, 'Production SEO: PUBLIC_SITE_URL must match the configured custom domain');
  }

  assert.equal(sitemap, sitemapXml(tools, origin, base, metadata.images), 'Published sitemap does not match the verified registry');
  assert.equal(robots, robotsText(origin, base), 'Published robots.txt disagrees with sitemap / origin');

  if (!origin) {
    assert.ok(!sitemap.includes('<loc>'), 'Preview sitemap must not advertise indexable URLs');
    assert.match(robots, /^User-agent: \*\nDisallow: \/\n$/);
    return { origin: '', pages: 0 };
  }

  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert.ok(urls.length >= 8, 'Production sitemap must contain both languages of home and legal pages');
  assert.equal(new Set(urls).size, urls.length, 'Sitemap contains duplicate page URLs');

  // A URL is not indexable if the corresponding HTML never made it into the build.
  for (const url of urls) {
    const parsed = new URL(url);
    assert.equal(parsed.origin, origin, 'Sitemap contains a URL outside the production domain');
    assert.ok(parsed.pathname.startsWith(`${base}/`), 'Sitemap contains an unexpected mount path');
    const relative = parsed.pathname.slice(base.length).replace(/^\//, '');
    await access(join(root, 'build', relative, 'index.html'));
  }

  return { origin, pages: urls.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await verifySeoBuild({ requireProduction: process.env.SEO_EXPECT_PRODUCTION === 'true' });
  console.log(result.origin
    ? `Verified ${result.pages} sitemap URLs, robots.txt and prerendered pages for ${result.origin}.`
    : 'Verified nonindexable preview sitemap and robots.txt.');
}
