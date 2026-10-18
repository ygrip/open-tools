// Renders the PWA/apple-touch icons from the brand clay toolbox (static/brand/logo.svg).
// Usage: node scripts/generate-pwa-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const logo = readFileSync(new URL('../static/brand/logo.svg', import.meta.url), 'utf8');
const inner = logo.replace(/<svg[^>]*>/, '').replace('</svg>', '').replace(/<title[^>]*>.*?<\/title>/, '').replaceAll('ot-logo-', 'pwa-');
// Logo art spans roughly x 12-84, y 10-85 of its 96 box (centre 48, 47.5).
const compose = (size, fill) => {
  const scale = (size * fill) / 75;
  const tx = size / 2 - 48 * scale, ty = size / 2 - 47.5 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#f6f1e9"/></radialGradient></defs><rect width="${size}" height="${size}" fill="url(#bg)"/><g fill="none" transform="translate(${tx} ${ty}) scale(${scale})">${inner}</g></svg>`;
};
// `any` icons use ~68% of the canvas; maskable keeps all art inside the 80% safe circle (~52%).
const targets = [
  ['static/pwa/icon-192.png', 192, 0.68],
  ['static/pwa/icon-512.png', 512, 0.68],
  ['static/pwa/icon-maskable-512.png', 512, 0.52],
  ['static/pwa/apple-touch-icon.png', 180, 0.7]
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, fill] of targets) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0}</style>${compose(size, fill)}`);
  writeFileSync(new URL(`../${file}`, import.meta.url), await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: size, height: size } }));
}
writeFileSync(new URL('../static/pwa/icon.svg', import.meta.url), compose(512, 0.68));
await browser.close();
console.log('PWA icons written');
