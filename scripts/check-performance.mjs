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
  if (toolIcon && bytes.length > 12_000) throw new Error(`Tool icon exceeds 12 kB budget: ${relative(client, file)}`);
  if (/\.(?:webp|svg|png|avif)$/.test(file) && !file.includes('/og/') && !file.includes('/pwa/') && !toolIcon) images += bytes.length;
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
const HOST_JS_BUDGET = 145_512;
const TOOL_JS_ALLOWANCE = 1_024;
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
