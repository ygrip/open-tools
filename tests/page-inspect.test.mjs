import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPage } from '../worker/page-extract.mjs';
import { detectTechnology } from '../worker/tech-detect.mjs';
import { analyzeRobots, analyzeLlmsTxt, isPathAllowed, parseRobots } from '../worker/robots-analysis.mjs';
import { fetchPublic, inspectPage, PAGE_LIMITS } from '../worker/page-inspect.mjs';
import { normalizeField, normalizeGroup, normalizePerformance } from '../worker/psi-categories.mjs';

const page = `<!doctype html><html lang="en-GB" dir="ltr"><head>
<meta charset="utf-8"><title>Fish &amp; Chips</title>
<meta name="description" content="Best chips">
<meta property="og:title" content="Fish"><meta property="og:image" content="https://example.com/a.png">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="canonical" href="/fish"><link rel="alternate" hreflang="id" href="/id/fish"><link rel="alternate" hreflang="x-default" href="/fish">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","sameAs":["x"]},{"@type":"Article","author":{"@type":"Person"},"datePublished":"2026-01-01"}]}</script>
<script type="application/ld+json">{broken</script>
<script src="/wp-content/plugins/wordpress-seo/js/a.js"></script></head>
<body><a href="#main">Skip</a><main id="main"><h1>Fish</h1><h3>Skipped level</h3><p>${'word '.repeat(60)}</p><img src="a.jpg"><img src="b.jpg" alt="">
<ul><li>x</li></ul><script>var ignored = "<h1>not content</h1>"</script></main></body></html>`;

test('extractPage returns bounded inert facts about metadata, structure and accessibility', () => {
  const facts = extractPage(page, 'https://example.com/fish');
  assert.equal(facts.title, 'Fish & Chips');
  assert.equal(facts.lang, 'en-GB');
  assert.deepEqual({ canonical: facts.links.canonical, hreflangs: facts.links.alternates.map(item => item.hreflang) }, { canonical: 'https://example.com/fish', hreflangs: ['id', 'x-default'] });
  assert.equal(facts.meta['og:title'], 'Fish');
  assert.deepEqual(facts.structuredData, { ...facts.structuredData, jsonLdBlocks: 2, jsonLdInvalid: 1, types: ['Organization', 'Article', 'Person'], hasSameAs: true, hasAuthor: true, hasDates: true });
  assert.equal(facts.content.headings.counts.h1, 1);
  assert.equal(facts.content.headings.skipsLevel, true);
  assert.equal(facts.content.images.withoutAlt, 1);
  assert.equal(facts.content.landmarks.main, true);
  assert.equal(facts.content.words >= 60, true);
  assert.equal(facts.accessibility.skipLink, true);
  assert.equal(facts.accessibility.blocksZoom, true);
  assert.equal(facts.emptyAppShell, false);
});

test('a script-only app shell is flagged because most AI crawlers do not run JavaScript', () => {
  const facts = extractPage('<html><body><div id="root"></div><script src="/app.js"></script></body></html>', 'https://example.com/');
  assert.equal(facts.emptyAppShell, true);
});

test('technology detection reports WordPress plugins and ignores absent signals', () => {
  const found = detectTechnology({ headers: { server: 'cloudflare', 'x-powered-by': 'PHP/8.2' }, meta: { generator: 'WordPress 6.5' }, urls: ['https://x.test/wp-content/plugins/wordpress-seo/a.js', 'https://x.test/wp-content/themes/astra/s.css'], html: '' });
  assert.deepEqual(found.map(item => item.name).sort(), ['Cloudflare', 'PHP', 'WordPress', 'Yoast SEO', 'astra']);
  assert.deepEqual(detectTechnology({}), []);
});

test('robots analysis uses longest-match rules, per-crawler groups and reports sitemaps', () => {
  const text = 'User-agent: *\nDisallow: /private/\nAllow: /private/open\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nAllow: /\nSitemap: https://example.com/sitemap.xml';
  const result = analyzeRobots({ status: 200, text, path: '/private/page' });
  assert.deepEqual({ gpt: result.crawlers.GPTBot, claude: result.crawlers.ClaudeBot, perplexity: result.crawlers.PerplexityBot, googlebot: result.pageAllowedForGooglebot, sitemaps: result.sitemaps }, { gpt: 'blocked', claude: 'allowed', perplexity: 'partial', googlebot: false, sitemaps: ['https://example.com/sitemap.xml'] });
  const { groups } = parseRobots(text);
  assert.equal(isPathAllowed(groups[0].rules, '/private/open/x'), true);
  assert.equal(analyzeRobots({ status: 404, text: '', path: '/' }).present, false);
});

test('llms.txt must be a non-HTML text file', () => {
  assert.deepEqual(analyzeLlmsTxt({ status: 200, contentType: 'text/html', text: '<html>' }), { present: false });
  assert.deepEqual(analyzeLlmsTxt({ status: 200, contentType: 'text/plain', text: '# Site\n\n## Docs\n- [A](https://example.com/a)' }), { present: true, bytes: 44, title: 'Site', sections: 1, links: 1 });
});

const html = (body, headers = {}) => new Response(body, { headers: { 'content-type': 'text/html', ...headers } });

test('redirects are followed manually and every hop is re-validated', async () => {
  const seen = [];
  const fetcher = async url => { seen.push(url); return url === 'https://example.com/' ? new Response(null, { status: 301, headers: { location: '/next' } }) : html('<title>ok</title>'); };
  const result = await fetchPublic('https://example.com/', fetcher, { maximum: 1000, accept: '*/*' });
  assert.deepEqual({ seen, final: result.url, chain: result.redirects.map(hop => hop.status) }, { seen: ['https://example.com/', 'https://example.com/next'], final: 'https://example.com/next', chain: [301] });
});

test('redirects to internal, credentialed or non-standard targets are blocked, loops are capped', async () => {
  for (const location of ['http://localhost/admin', 'https://user:pw@example.org/', 'http://169.254.169.254/latest', 'https://example.org:8443/', 'file:///etc/passwd']) {
    await assert.rejects(fetchPublic('https://example.com/', async () => new Response(null, { status: 302, headers: { location } }), { maximum: 1000, accept: '*/*' }), error => error.message === 'redirect-blocked');
  }
  await assert.rejects(fetchPublic('https://example.com/', async () => new Response(null, { status: 302, headers: { location: '/again' } }), { maximum: 1000, accept: '*/*' }), error => error.message === 'too-many-redirects');
});

test('oversized documents are truncated, only allow-listed headers are reported, cookies are counted not shown', async () => {
  const big = html('x'.repeat(PAGE_LIMITS.documentBytes + 5000), { 'x-robots-tag': 'noindex', authorization: 'secret', 'set-cookie': 'session=abc' });
  const result = await inspectPage('https://example.com/', async url => url.endsWith('/') ? big : new Response('', { status: 404 }));
  assert.deepEqual({ truncated: result.document.truncated, length: result.document.contentLength, robots: result.document.headers['x-robots-tag'], leaked: result.document.headers.authorization, cookies: result.document.headers['set-cookie-count'] }, { truncated: true, length: PAGE_LIMITS.documentBytes, robots: 'noindex', leaked: undefined, cookies: '1' });
});

test('non-HTML documents and unreachable pages produce an error instead of a failed audit', async () => {
  assert.equal((await inspectPage('https://example.com/a.pdf', async () => new Response('%PDF', { headers: { 'content-type': 'application/pdf' } }))).error, 'not-html');
  assert.equal((await inspectPage('https://example.com/', async () => { throw new Error('down'); })).error, 'page-unreachable');
  assert.equal((await inspectPage('https://localhost/', async () => html('x'))).error, 'invalid-url');
});

test('optional PageSpeed categories normalize to bounded values and tolerate absence', () => {
  assert.deepEqual([normalizePerformance({}), normalizeGroup({}, 'accessibility'), normalizeField({})], [null, null, null]);
  const lh = { categories: { performance: { score: 0.5, auditRefs: [{ id: 'unused-javascript', group: 'load-opportunities' }, { id: 'largest-contentful-paint' }] }, accessibility: { score: 0.9, auditRefs: [{ id: 'color-contrast' }, { id: 'aria-x' }] } }, audits: { 'largest-contentful-paint': { numericValue: 3100, score: 0.4, displayValue: '3.1 s' }, 'unused-javascript': { score: 0.2, title: 'Reduce unused JavaScript', scoreDisplayMode: 'metricSavings', details: { overallSavingsMs: 450, overallSavingsBytes: 9000 } }, 'color-contrast': { score: 0, title: 'Low contrast', scoreDisplayMode: 'binary', details: { items: [{ node: { snippet: '<p>' } }] } }, 'aria-x': { scoreDisplayMode: 'notApplicable', title: 'x', description: 'long' } } };
  const performance = normalizePerformance(lh);
  assert.equal(performance.score, 50);
  assert.deepEqual(performance.metrics.map(metric => metric.id), ['lcp']);
  assert.deepEqual(performance.opportunities.map(item => [item.id, item.savingsMs]), [['unused-javascript', 450]]);
  const accessibility = normalizeGroup(lh, 'accessibility');
  assert.equal(accessibility.score, 90);
  assert.deepEqual(accessibility.audits.map(audit => [audit.id, audit.mode, audit.description]), [['color-contrast', 'binary', ''], ['aria-x', 'notApplicable', '']]);
  const field = normalizeField({ loadingExperience: { overall_category: 'AVERAGE', origin_fallback: true, metrics: { CUMULATIVE_LAYOUT_SHIFT_SCORE: { percentile: 12, category: 'AVERAGE' }, LARGEST_CONTENTFUL_PAINT_MS: { percentile: 2300, category: 'FAST' } } } });
  assert.deepEqual(field, { overall: 'needs', originFallback: true, metrics: [{ id: 'lcp', value: 2300, rating: 'good' }, { id: 'cls', value: 0.12, rating: 'needs' }] });
});
