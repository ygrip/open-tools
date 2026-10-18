import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rename, rm, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { localePath, siteOrigin, SEO_LOCALES } from '../src/lib/seo/metadata.js';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
export const escapeXml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);

/** Wrap copy, including long unbroken strings, without allowing SVG markup. */
export function wrapText(value, columns, maximumLines) {
  const words = String(value).replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const pieces = [];
    const characters = Array.from(word);
    while (characters.length) pieces.push(characters.splice(0, columns).join(''));
    for (const piece of pieces) {
      if (line && Array.from(`${line} ${piece}`).length > columns) { lines.push(line); line = ''; }
      line = line ? `${line} ${piece}` : piece;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maximumLines) {
    lines.length = maximumLines;
    lines[maximumLines - 1] = `${Array.from(lines[maximumLines - 1]).slice(0, columns - 1).join('').trimEnd()}…`;
  }
  return lines;
}

/** Clay tool art: the mascot slot shows the tool's own icon on a soft plate. */
function toolArtSvg(iconDataUri) {
  return `<ellipse cx="1004" cy="430" rx="118" ry="20" fill="#e7dcd0"/>
  <circle cx="1004" cy="298" r="140" fill="#f9ddcb"/>
  <circle cx="1004" cy="291" r="140" fill="#fdeadf"/>
  <image href="${iconDataUri}" x="884" y="171" width="240" height="240" preserveAspectRatio="xMidYMid meet"/>`;
}

const mascotSvg = `<path d="M995 247v-26a39 39 0 0 1 78 0v26" fill="none" stroke="#d9784e" stroke-width="15"/>
  <rect x="947" y="242" width="176" height="152" rx="43" fill="#ef946b"/>
  <circle cx="1004" cy="300" r="8" fill="#382f2b"/><circle cx="1067" cy="300" r="8" fill="#382f2b"/>
  <path d="M1019 333q17 21 34 0" fill="none" stroke="#382f2b" stroke-width="7" stroke-linecap="round"/>`;

export function socialCardSvg({ title, description, locale = 'en', version = '', iconDataUri = '' }) {
  if (iconDataUri && !/^data:image\/(?:png|svg\+xml);base64,[A-Za-z0-9+/]+=*$/.test(iconDataUri)) throw new Error('Social card icon must be an embedded PNG or SVG');
  const heading = wrapText(title, iconDataUri ? 24 : 29, 3);
  const details = wrapText(description, 64, heading.length >= 3 ? 2 : 3);
  const fit = (line, size) => {
    const width = Array.from(line).reduce((sum, character) => sum + (/[mwMW@#%]/.test(character) || character.codePointAt(0) > 255 ? .95 : /[il1.,'!:;| ]/.test(character) ? .3 : /[A-Z]/.test(character) ? .72 : .58) * size, 0);
    const maximum = iconDataUri ? 760 : 820;
    return width > maximum ? ` textLength="${maximum}" lengthAdjust="spacingAndGlyphs"` : '';
  };
  const headline = heading.map((line, index) => `<tspan x="86" y="${214 + index * 78}"${fit(line, 67)}>${escapeXml(line)}</tspan>`).join('');
  const textY = Math.max(336, 214 + heading.length * 78 + 12);
  const body = details.map((line, index) => `<tspan x="89" y="${textY + index * 32}"${fit(line, 24)}>${escapeXml(line)}</tspan>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
  <rect width="1200" height="630" fill="#f6f1e9"/>
  <rect x="34" y="38" width="1132" height="560" rx="38" fill="#e7dcd0"/>
  <rect x="34" y="30" width="1132" height="560" rx="38" fill="#fffcf6" stroke="#e7dcd0" stroke-width="2"/>
  <rect x="86" y="77" width="158" height="47" rx="19" fill="#f9ddcb"/>
  <text x="108" y="111" font-family="Nunito" font-size="31" font-weight="800" fill="#ad4527">trick-it</text>
  <text x="86" y="214" font-family="Nunito" font-size="67" font-weight="800" fill="#382f2b">${headline}</text>
  <text font-family="Nunito" font-size="24" font-weight="500" fill="#60534c">${body}</text>
  ${iconDataUri ? toolArtSvg(iconDataUri) : mascotSvg}
  <rect x="85" y="526" width="520" height="1" fill="#e7dcd0"/>
  <text x="88" y="559" font-family="Nunito" font-size="19" fill="#71645c">${escapeXml(locale === 'id' ? 'Alat kecil. Hasil berarti.' : 'Little tools. Lovely results.')}${version ? ` · v${escapeXml(String(version).length > 48 ? `${String(version).slice(0, 47)}…` : version)}` : ''}</text>
</svg>`;
}

function translated(tool, locale) {
  const translation = tool.translations?.[locale];
  return { ...tool, name: translation?.name ?? tool.name, description: translation?.description ?? tool.description, seo: translation?.seo ?? tool.seo };
}

/** Produce canonical URLs only for indexable, actually generated routes.
 * `images` (optional) maps `home-<locale>` / `tools/<id>-<locale>` to the social card path. */
export function sitemapXml(tools, origin, base = '', images = {}) {
  origin = siteOrigin(origin);
  const routes = [
    { path: '/', locales: SEO_LOCALES },
    ...['privacy', 'terms', 'policy'].map((id) => ({ path: `/${id}/`, locales: SEO_LOCALES })),
    ...tools.map((tool) => ({ path: `${tool.path}/`, image: `tools/${tool.id}`, locales: SEO_LOCALES.filter((locale) => translated(tool, locale).seo?.robots !== 'noindex') }))
  ].filter((route) => route.locales.length);
  routes[0].image = 'home';
  const entries = origin ? routes.flatMap((route) => route.locales.map((locale) => {
    const href = (language) => escapeXml(`${origin}${localePath(route.path, language, base)}`);
    const alternates = route.locales.map((alternate) => `<xhtml:link rel="alternate" hreflang="${alternate}" href="${href(alternate)}"/>`).join('') +
      `<xhtml:link rel="alternate" hreflang="x-default" href="${href(route.locales.includes('en') ? 'en' : route.locales[0])}"/>`;
    const image = route.image && images[`${route.image}-${locale}`];
    const imageXml = image ? `<image:image><image:loc>${escapeXml(`${origin}${image}`)}</image:loc></image:image>` : '';
    return `<url><loc>${href(locale)}</loc>${alternates}${imageXml}</url>`;
  })).join('\n') : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entries}\n</urlset>\n`;
}

export function robotsText(origin, base = '') {
  origin = siteOrigin(origin);
  return origin ? `User-agent: *\nAllow: /\nSitemap: ${origin}${base}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n';
}

/** Build from approved catalog metadata; never fetch a tool-supplied asset. */
export async function generateSeo({ root = defaultRoot, origin = process.env.PUBLIC_SITE_URL || '', base = '', renderer } = {}) {
  origin = siteOrigin(origin);
  const tools = JSON.parse(await readFile(join(root, 'src/lib/registry/generated.json'), 'utf8'));
  const staticRoot = join(root, 'static');
  const output = join(staticRoot, 'og');
  const font = join(root, 'scripts/assets/nunito.ttf');
  const boldFont = join(root, 'scripts/assets/nunito-bold.ttf');
  let render = renderer;
  if (!render) {
    await Promise.all([readFile(font), readFile(boldFont)]);
    const { Resvg } = await import('@resvg/resvg-js');
    render = (svg) => new Resvg(svg, { font: { fontFiles: [font, boldFont], loadSystemFonts: false, defaultFontFamily: 'Nunito' } }).render().asPng();
  }
  await mkdir(staticRoot, { recursive: true });
  // Host-owned clay art per tool: WebP for pages, PNG source for social cards.
  const icons = {};
  const iconSources = {};
  for (const tool of tools) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tool.id)) continue;
    if (await exists(join(staticRoot, 'icons/tools', `${tool.id}.webp`))) icons[tool.id] = `${base}/icons/tools/${tool.id}.webp`;
    const source = join(root, 'scripts/assets/tool-icons', `${tool.id}.png`);
    if (await exists(source)) iconSources[tool.id] = `data:image/png;base64,${(await readFile(source)).toString('base64')}`;
  }
  // The home card shows the real trick-it mascot, the same art as the header logo.
  const brandLogo = join(staticRoot, 'brand/logo.svg');
  const brandDataUri = await exists(brandLogo) ? `data:image/svg+xml;base64,${(await readFile(brandLogo)).toString('base64')}` : '';
  const staging = await mkdtemp(join(staticRoot, '.og-'));
  const images = {};
  try {
    for (const locale of SEO_LOCALES) {
      const messages = JSON.parse(await readFile(join(root, `messages/${locale}.json`), 'utf8'));
      const cards = [
        { id: 'home', kind: 'site', title: messages.home_title, description: messages.home_description, version: '', iconDataUri: brandDataUri },
        ...tools.map((tool) => {
          const view = translated(tool, locale);
          return { id: tool.id, kind: 'tool', title: view.seo?.title || view.name, description: view.seo?.description || view.description, version: tool.version, iconDataUri: iconSources[tool.id] || '' };
        })
      ];
      for (const card of cards) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(card.id)) throw new Error('Social card ID must be a safe catalog ID');
        const bytes = await render(socialCardSvg({ ...card, locale }));
        if (!bytes.length || bytes.length > 200_000) throw new Error(`Social image exceeds 200 kB budget: ${card.id}/${locale}`);
        const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
        const name = `${card.kind === 'tool' ? 'tools/' : ''}${card.id}-${locale}`;
        if (card.kind === 'tool') await mkdir(join(staging, 'tools'), { recursive: true });
        await writeFile(join(staging, `${name}.png`), bytes);
        await writeFile(join(staging, `${name}.${digest}.png`), bytes);
        images[name] = `${base}/og/${name}.${digest}.png`;
      }
    }
    await rm(output, { recursive: true, force: true });
    await rename(staging, output);
    await writeFile(join(staticRoot, 'robots.txt'), robotsText(origin, base));
    await writeFile(join(staticRoot, 'sitemap.xml'), sitemapXml(tools, origin, base, images));
    const generated = join(root, 'src/lib/seo');
    await mkdir(generated, { recursive: true });
    await writeFile(join(generated, 'generated.json'), `${JSON.stringify({ origin, base, images, icons }, null, 2)}\n`);
  } finally { await rm(staging, { recursive: true, force: true }); }
  return { origin, base, images, icons };
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

/** The deployed custom domain from wrangler.jsonc, so a production build is indexable by default. */
export async function productionOrigin(root = defaultRoot) {
  try {
    const config = JSON.parse((await readFile(join(root, 'wrangler.jsonc'), 'utf8')).replace(/^\s*\/\/.*$/gm, ''));
    const route = (config.routes ?? []).find((entry) => entry?.custom_domain && typeof entry.pattern === 'string' && /^[a-z0-9.-]+$/i.test(entry.pattern));
    return route ? `https://${route.pattern}` : '';
  } catch { return ''; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const config = (await import('../svelte.config.js')).default;
  // Unset PUBLIC_SITE_URL means production (the wrangler custom domain); set it to an
  // empty string for previews, which stay noindex with an empty sitemap.
  const origin = process.env.PUBLIC_SITE_URL ?? await productionOrigin();
  await generateSeo({ origin, base: config.kit?.paths?.base || '' });
  console.log(origin ? `Generated localized SEO, social images, robots.txt and sitemap.xml for ${origin}.` : 'Generated preview SEO (noindex). Set PUBLIC_SITE_URL to enable production canonicals and sitemap URLs.');
}
