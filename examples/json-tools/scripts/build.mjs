import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const result = await build({
  absWorkingDir: fileURLToPath(root),
  entryPoints: ['src/main.js'],
  bundle: true,
  write: false,
  minify: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  legalComments: 'inline'
});
const script = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const template = await readFile(new URL('src/index.html', root), 'utf8');
if (template.split('/* BUNDLE_SCRIPT */').length !== 2) throw new Error('Expected exactly one bundle script marker.');
const html = template.replace('/* BUNDLE_SCRIPT */', () => script);
await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/index.html', root), html);
const manifestUrl = new URL('tool.manifest.json', root);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
manifest.bundle.sha256 = createHash('sha256').update(html).digest('hex');
await writeFile(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built dist/index.html (${Buffer.byteLength(html)} bytes), SHA-256 ${manifest.bundle.sha256}`);
