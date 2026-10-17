import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]));
  return nested.flat();
}

const catalog = JSON.parse(await readFile('src/lib/registry/generated.json', 'utf8'));
for (const route of ['', 'privacy/', 'terms/', 'policy/', ...catalog.map((tool) => `${tool.id}/`)]) {
  const file = join('build', route, 'index.html');
  const html = await readFile(file, 'utf8');
  if (!/<main(?:\s|>)/.test(html)) throw new Error(`Static page has no rendered content: ${file}`);
}
await Promise.all(['500', '503'].map((status) => readFile(`build/${status}.html`, 'utf8')));
console.log('Static HTML exports verified (home, legal pages, tool routes, and server-error fallbacks).');

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
  if (/\.(?:webp|svg|png|avif)$/.test(file)) images += bytes.length;
  if (file.endsWith('.woff2')) fonts += bytes.length;
  if (/\/bundles\/.*\.json$/.test(file) && gzipSync(bytes).length > 90_000) throw new Error(`Tool bundle exceeds 90 kB gzip budget: ${relative(client, file)}`);
}
const budgets = { javascript: 130_000, css: 20_000, images: 90_000, fonts: 45_000 };
const totals = { javascript, css, images, fonts };
for (const [kind, bytes] of Object.entries(totals)) {
  console.log(`${kind}: ${bytes.toLocaleString()} / ${budgets[kind].toLocaleString()} bytes${kind === 'javascript' || kind === 'css' ? ' (gzip, all routes)' : ''}`);
  if (bytes > budgets[kind]) throw new Error(`${kind} performance budget exceeded`);
}
console.log('Performance budgets passed. These are build budgets, not real-user Web Vitals.');
