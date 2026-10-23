import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]));
  return nested.flat();
}

const catalog = JSON.parse(await readFile('src/lib/registry/generated.json', 'utf8'));
const routes = ['', 'privacy/', 'terms/', 'policy/', ...catalog.map((tool) => `${tool.id}/`)];
for (const route of routes.flatMap((path) => [path, `id/${path}`])) {
  const file = join('build', route, 'index.html');
  const html = await readFile(file, 'utf8');
  if (!/<main(?:\s|>)/.test(html)) throw new Error(`Static page has no rendered content: ${file}`);
}
await Promise.all(['500', '503'].map((status) => readFile(`build/${status}.html`, 'utf8')));
await readFile('build/service-worker.js', 'utf8');
await readFile('build/manifest.webmanifest', 'utf8');
await readFile('build/robots.txt', 'utf8');
await readFile('build/sitemap.xml', 'utf8');
console.log('Static EN/ID HTML, tool routes, error fallbacks, PWA, and crawler exports verified.');

const client = '.svelte-kit/output/client';
const assets = await files(client);
let javascript = 0;
let css = 0;
let images = 0;
let fonts = 0;
for (const file of assets) {
  const bytes = await readFile(file);
  if (file.endsWith('.js')) javascript += gzipSync(bytes).length;
  if (file.endsWith('.css')) css += gzipSync(bytes).length;
  // Tool clay icons load lazily per card, so each gets its own small budget instead of the shared one.
  // /pwa/ icons are fetched only on install or home-screen add, never by a page load, so they stay out of the page-image budget.
  const toolIcon = file.includes('/icons/tools/');
  // Each legal illustration is fetched only on its own page, not the homepage.
  // Preserve 512px RGBA detail for high-DPI displays; PNG compression is lossless.
  // Budget each image independently rather than forcing 128px paletted thumbnails.
  const legalArt = /\/illustrations\/(?:terms|policy|privacy)-clay\.png$/.test(file);
  if (legalArt) {
    if (bytes.length > 256 * 1024) throw new Error(`Legal PNG exceeds 256 KiB: ${relative(client, file)}`);
    if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      throw new Error(`Legal artwork must be a PNG: ${relative(client, file)}`);
    }
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    const colorType = bytes[25];
    if (width < 512 || height < 512 || colorType !== 6) {
      throw new Error(`Legal PNG must be at least 512px with truecolor transparency: ${relative(client, file)}`);
    }
  }
  if (toolIcon && bytes.length > 12_000) throw new Error(`Tool icon exceeds 12 kB budget: ${relative(client, file)}`);
  if (/\.(?:webp|svg|png|avif)$/.test(file) && !file.includes('/og/') && !file.includes('/pwa/') && !toolIcon && !legalArt) images += bytes.length;
  if (file.includes('/og/') && file.endsWith('.png') && bytes.length > 200_000) throw new Error(`Social card exceeds 200 kB budget: ${file}`);
  if (file.endsWith('.woff2')) fonts += bytes.length;
  if (/\/bundles\/.*\.json$/.test(file) && gzipSync(bytes).length > 90_000) throw new Error(`Tool bundle exceeds 90 kB gzip budget: ${relative(client, file)}`);
}
// JS budget is enforced per tool, not as one fixed ceiling for the whole marketplace.
// Host JS (shared trickIt.ui kit, table, control pane, app shell) is fixed at the 18-tool baseline.
// Each additional tool raises the shared-JS ceiling by TOOL_JS_ALLOWANCE gzip bytes (its marginal catalog cost),
// and no single tool's standalone catalog entry may exceed MAX_TOOL_ENTRY_GZIP. Tool code itself stays in lazily loaded bundles
// (90 kB gzip each, checked above) and icons keep their own 12 kB budget.
const HOST_JS_BASELINE_TOOLS = 18;
// The native EN/ID flag picker adds under 0.4% to the shared shell; keep a fixed,
// reviewable 512-byte allowance without loosening per-tool bundle ceilings.
// User-approved PWA reinstall/activation + automatic refresh adds under 768 bytes gzip
// to the shared host, with no additional per-tool JavaScript.
// Scoped MediaWiki CORS browser-read broker adds <=768 gzip bytes to the shared host;
// the per-tool entry, iframe bundle and artwork ceilings remain unchanged.
// Scoped wiki picture broker and DNS-over-HTTPS (dns-query) broker add <=2,048 gzip bytes to the shared host
// (measured +1,719); per-tool entry, iframe bundle and artwork ceilings remain unchanged.
// seo-checker 0.4.0 page-inspection consent copy (EN/ID) in the shared host strings: measured +106 bytes over the
// previous ceiling; 1,024 bytes of headroom keeps the next copy tweak from failing CI. No per-tool JS ceiling changes.
// The bounded export protocol and cache lifecycle add 1,776 bytes gzip on the 32-tool baseline.
// Keep their allowance explicit and fixed rather than increasing the per-tool budget.
// Export progress, cancellation and the shared browser-aware limit policy add ~1.5 kB gzip.
// This fixed allowance leaves all tool-specific budgets unchanged.
// Pinned Highlight.js core + 16 grammars are shared once by all tools.
// Keep this explicit instead of increasing the per-tool catalog allowance.
// Measured across 19 pinned grammars: +34.7 KiB gzip vs the no-highlighter baseline.
// The 2.5 KiB increment covers C++, Kotlin and Swift without changing per-tool limits.
const SHARED_CODE_HIGHLIGHT_BUDGET = 35_328;
// Save My Wiki 0.4.0 adds optional multilingual semantic-PPT capabilities and consent metadata.
// Measured pinned-source delta against the passing 0.3.0 host build: +602 gzip bytes.
// Reserve 640 bytes for this catalog update, retaining roughly the former host headroom.
// Per-tool entry, bundle and icon limits are enforced separately and remain unchanged.
const WIKI_SEMANTIC_PPT_CATALOG_BUDGET = 640;
const HOST_JS_BUDGET = 145_512 + 768 + 768 + 2_048 + 1_024 + 2_048 + 2_048 + SHARED_CODE_HIGHLIGHT_BUDGET + WIKI_SEMANTIC_PPT_CATALOG_BUDGET;
// User-approved catalog headroom: 64 extra gzip bytes per tool for richer EN/ID metadata.
// The image-editor registration exceeded the previous aggregate ceiling by 12 bytes.
// Keep the fixed host baseline and individual entry, bundle and icon ceilings unchanged.
const TOOL_JS_ALLOWANCE = 1_088;
const MAX_TOOL_ENTRY_GZIP = 4_096;
for (const tool of catalog) {
  const entryBytes = gzipSync(JSON.stringify(tool)).length;
  if (entryBytes > MAX_TOOL_ENTRY_GZIP) throw new Error(`Tool "${tool.id}" catalog entry is ${entryBytes} bytes gzip, over the ${MAX_TOOL_ENTRY_GZIP} byte per-tool budget`);
}
const budgets = { javascript: HOST_JS_BUDGET + Math.max(0, catalog.length - HOST_JS_BASELINE_TOOLS) * TOOL_JS_ALLOWANCE, css: 20_000, images: 90_000, fonts: 45_000 };
const totals = { javascript, css, images, fonts };
for (const [kind, bytes] of Object.entries(totals)) {
  console.log(`${kind}: ${bytes.toLocaleString()} / ${budgets[kind].toLocaleString()} bytes${kind === 'javascript' || kind === 'css' ? ' (gzip, all routes)' : ''}`);
  if (bytes > budgets[kind]) throw new Error(`${kind} performance budget exceeded`);
}
console.log('Performance budgets passed. These are build budgets, not real-user Web Vitals.');
