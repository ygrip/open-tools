// Pure HTML → facts. Input is untrusted: every value is bounded and returned as inert text.
// Regex scanning (no DOM) keeps this runnable in Workers and in Node tests.
const clip = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const decode = text => text.replace(/&(amp|lt|gt|quot|#39|apos);/g, (match, name) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'" })[name]);

export function parseAttributes(tag) {
  const attributes = {};
  const pattern = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  const inner = tag.replace(/^<\s*[^\s>\/]+/, '').replace(/\/?>$/, '');
  for (const match of inner.matchAll(pattern)) {
    const name = match[1].toLowerCase();
    if (name in attributes) continue;
    attributes[name] = decode(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

function tagsOf(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(match => parseAttributes(match[0]));
}

function absolute(href, base) {
  try { return new URL(href, base).href.slice(0, 300); } catch { return ''; }
}

function stripNonContent(html) {
  return html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|template|svg|iframe)\b[\s\S]*?<\/\1\s*>/gi, ' ');
}

function visibleText(html) {
  return decode(stripNonContent(html).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function collectMeta(html) {
  const meta = {};
  let count = 0;
  for (const attributes of tagsOf(html, 'meta')) {
    const key = (attributes.property ?? attributes.name ?? attributes['http-equiv'] ?? attributes.itemprop ?? '').toLowerCase();
    if (attributes.charset) meta.charset = clip(attributes.charset, 40);
    if (!key || !('content' in attributes) || key in meta || count >= 80) continue;
    meta[key.slice(0, 60)] = clip(attributes.content, 400);
    count++;
  }
  return meta;
}

function collectLinks(html, base) {
  const result = { canonical: '', alternates: [], icons: [], feeds: [], manifest: false, amp: false, prev: false, next: false, preconnect: 0, stylesheets: [] };
  for (const link of tagsOf(html, 'link')) {
    const rel = (link.rel ?? '').toLowerCase().split(/\s+/);
    const href = link.href ? absolute(link.href, base) : '';
    if (rel.includes('canonical') && !result.canonical) result.canonical = href;
    if (rel.includes('alternate') && link.hreflang && result.alternates.length < 40) result.alternates.push({ hreflang: clip(link.hreflang, 20), href });
    if (rel.includes('alternate') && /rss|atom/i.test(link.type ?? '') && result.feeds.length < 5) result.feeds.push(href);
    if (rel.includes('icon') && result.icons.length < 6) result.icons.push(href);
    if (rel.includes('manifest')) result.manifest = true;
    if (rel.includes('amphtml')) result.amp = true;
    if (rel.includes('prev')) result.prev = true;
    if (rel.includes('next')) result.next = true;
    if (rel.includes('preconnect')) result.preconnect++;
    if (rel.includes('stylesheet') && href && result.stylesheets.length < 40) result.stylesheets.push(href);
  }
  return result;
}

function collectTypes(node, types, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 6 || types.size >= 40) return;
  if (Array.isArray(node)) { for (const item of node.slice(0, 50)) collectTypes(item, types, depth + 1); return; }
  const type = node['@type'];
  for (const name of Array.isArray(type) ? type : [type]) if (typeof name === 'string') types.add(clip(name, 60));
  for (const value of Object.values(node)) collectTypes(value, types, depth + 1);
}

function collectStructuredData(html) {
  const result = { jsonLdBlocks: 0, jsonLdInvalid: 0, types: [], hasSameAs: false, hasAuthor: false, hasDates: false, microdata: 0, rdfa: 0 };
  const types = new Set();
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    if (result.jsonLdBlocks >= 20) break;
    result.jsonLdBlocks++;
    const raw = match[1].trim();
    if (raw.length > 200_000) { result.jsonLdInvalid++; continue; }
    try { collectTypes(JSON.parse(raw), types); } catch { result.jsonLdInvalid++; continue; }
    result.hasSameAs ||= /"sameAs"\s*:/.test(raw);
    result.hasAuthor ||= /"author"\s*:/.test(raw);
    result.hasDates ||= /"(?:datePublished|dateModified)"\s*:/.test(raw);
  }
  result.types = [...types];
  result.microdata = (html.match(/\bitemtype\s*=/gi) ?? []).length;
  result.rdfa = (html.match(/\btypeof\s*=/gi) ?? []).length;
  return result;
}

function collectHeadings(body) {
  const counts = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 };
  const outline = [];
  for (const match of body.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi)) {
    counts[`h${match[1]}`]++;
    const text = clip(decode(match[2].replace(/<[^>]*>/g, ' ')), 120);
    if (text && outline.length < 14 && Number(match[1]) <= 3) outline.push({ level: Number(match[1]), text });
  }
  const levels = [...body.matchAll(/<h([1-6])\b/gi)].map(match => Number(match[1]));
  const skipsLevel = levels.some((level, index) => index > 0 && level > levels[index - 1] + 1);
  return { counts, outline, skipsLevel };
}

function collectContent(html) {
  const body = stripNonContent(html);
  const images = tagsOf(body, 'img');
  const anchors = tagsOf(body, 'a');
  const text = visibleText(html);
  const words = text ? text.split(' ').length : 0;
  return {
    words,
    textSample: clip(text, 280),
    headings: collectHeadings(body),
    images: { total: images.length, withoutAlt: images.filter(image => !('alt' in image)).length, emptyAlt: images.filter(image => image.alt === '').length, lazy: images.filter(image => image.loading === 'lazy').length },
    links: { total: anchors.length, withHref: anchors.filter(anchor => anchor.href).length, nofollow: anchors.filter(anchor => /nofollow/i.test(anchor.rel ?? '')).length },
    lists: (body.match(/<(?:ul|ol|dl)\b/gi) ?? []).length,
    tables: (body.match(/<table\b/gi) ?? []).length,
    paragraphs: (body.match(/<p\b/gi) ?? []).length,
    landmarks: Object.fromEntries(['main', 'nav', 'header', 'footer', 'article', 'section', 'aside'].map(name => [name, new RegExp(`<${name}\\b`, 'i').test(body)])),
    timeElements: (body.match(/<time\b/gi) ?? []).length,
    forms: (body.match(/<form\b/gi) ?? []).length
  };
}

function collectAccessibility(html) {
  const body = stripNonContent(html);
  const roles = new Set([...body.matchAll(/\brole\s*=\s*["']?(banner|navigation|main|contentinfo|complementary|search|region|form)\b/gi)].map(match => match[1].toLowerCase()));
  const viewport = collectMeta(html).viewport ?? '';
  const maximumScale = /maximum-scale\s*=\s*([\d.]+)/i.exec(viewport);
  return {
    skipLink: /<a\b[^>]*href\s*=\s*["']#(?:main|content|maincontent|main-content|skip)[^"']*["']/i.test(body),
    ariaAttributes: (body.match(/\baria-[a-z]+\s*=/gi) ?? []).length,
    roles: [...roles],
    positiveTabindex: (body.match(/\btabindex\s*=\s*["']?[1-9]/gi) ?? []).length,
    blocksZoom: /user-scalable\s*=\s*(?:no|0)/i.test(viewport) || (maximumScale !== null && Number(maximumScale[1]) < 2),
    inputs: tagsOf(body, 'input').filter(input => !['hidden', 'submit', 'button', 'image', 'reset'].includes((input.type ?? '').toLowerCase())).length,
    labels: (body.match(/<label\b/gi) ?? []).length
  };
}

function rootShell(html) {
  return /<div\b[^>]*\bid\s*=\s*["'](?:root|app|__next|__nuxt|___gatsby)["'][^>]*>\s*<\/div>/i.test(html);
}

/** @returns {object} bounded facts about one HTML document. */
export function extractPage(html, baseUrl) {
  const head = html.split(/<\/head\s*>/i)[0].slice(0, 300_000);
  const rootTag = /<html\b[^>]*>/i.exec(html)?.[0] ?? '';
  const root = rootTag ? parseAttributes(rootTag) : {};
  const meta = collectMeta(head);
  const scripts = tagsOf(html, 'script').filter(script => script.src).map(script => absolute(script.src, baseUrl)).filter(Boolean);
  const content = collectContent(html);
  return {
    title: clip(decode(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(head)?.[1] ?? ''), 300),
    lang: clip(root.lang ?? root['xml:lang'] ?? '', 40),
    dir: clip(root.dir ?? '', 10),
    meta,
    links: collectLinks(head, baseUrl),
    structuredData: collectStructuredData(html),
    content,
    accessibility: collectAccessibility(html),
    scripts: scripts.slice(0, 60),
    inlineScripts: tagsOf(html, 'script').filter(script => !script.src).length,
    emptyAppShell: rootShell(html) && content.words < 50
  };
}
