/**
 * Production-only visual documentation capture.
 * Run: npm ci && npx playwright install chromium && npm run screenshots:live
 * Captures the DEPLOYED site, not a local build.
 */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const LIVE_URL = 'https://tools.readynaz.com/';
const OUT = 'docs/screenshots/live';
const profiles = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
];
const themes = ['light', 'dark'];
const now = new Date().toISOString();

async function loadImages(page) {
  // Trigger native lazy loading in the same way a visitor scrolling the site would.
  const height = await page.evaluate(() => Math.min(document.documentElement.scrollHeight, 45000));
  const step = Math.max(500, page.viewportSize().height - 150);
  for (let top = 0; top < height; top += step) {
    await page.evaluate((y) => window.scrollTo(0, y), top);
    await page.waitForTimeout(90);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(750);
  await page.evaluate(() => document.fonts.ready);
}

async function run() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const records = [];

  try {
    for (const profile of profiles) {
      for (const theme of themes) {
        const context = await browser.newContext({
          viewport: profile.viewport,
          deviceScaleFactor: 1,
          isMobile: profile.isMobile,
          hasTouch: profile.hasTouch,
          colorScheme: theme,
          reducedMotion: 'reduce',
          locale: 'en-US',
          serviceWorkers: 'block'
        });
        await context.addInitScript((value) => {
          try { localStorage.setItem('open-tools-theme', value); } catch {}
        }, theme);
        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 200)));

        try {
          const response = await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
          if (!response || response.status() !== 200 || new URL(page.url()).hostname !== 'tools.readynaz.com') {
            throw new Error(`Unexpected production response: ${response?.status()} at ${page.url()}`);
          }
          await page.locator('#hero-title').waitFor({ state: 'visible', timeout: 20000 });
          await page.waitForFunction((value) => document.documentElement.dataset.theme === value, theme);
          await loadImages(page);

          const snapshot = await page.evaluate(() => ({
            title: document.title,
            h1: document.querySelector('h1')?.textContent?.trim().replace(/\\s+/g, ' '),
            theme: document.documentElement.dataset.theme,
            language: document.documentElement.lang,
            horizontalOverflowPixels: Math.max(0, document.documentElement.scrollWidth - innerWidth),
            pageHeight: document.documentElement.scrollHeight
          }));
          if (snapshot.theme !== theme || !snapshot.h1) {
            throw new Error(`Capture assertions failed: ${JSON.stringify(snapshot)}`);
          }

          const filename = `trick-it-${profile.name}-${theme}.png`;
          const filepath = path.join(OUT, filename);
          await page.screenshot({
            path: filepath,
            type: 'png',
            fullPage: true,
            animations: 'disabled',
            caret: 'hide',
            timeout: 45000
          });
          const file = await readFile(filepath);
          const pngWidth = file.readUInt32BE(16);
          const pngHeight = file.readUInt32BE(20);
          if (file.subarray(1, 4).toString() !== 'PNG' || pngWidth !== profile.viewport.width || pngHeight < profile.viewport.height) {
            throw new Error(`Invalid screenshot dimensions: ${filename} ${pngWidth}x${pngHeight}`);
          }

          const record = {
            profile: profile.name,
            theme,
            viewport: profile.viewport,
            screenshot: filename,
            image: { width: pngWidth, height: pngHeight, bytes: file.length },
            url: page.url(),
            httpStatus: response.status(),
            ...snapshot,
            pageErrors
          };
          records.push(record);
          console.log(`Captured ${filename}: ${pngWidth}x${pngHeight}, ${file.length} bytes; overflow=${snapshot.horizontalOverflowPixels}px`);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  if (records.length !== 4) throw new Error(`Expected four production screenshots, got ${records.length}`);
  await writeFile(path.join(OUT, 'capture.json'), JSON.stringify({
    source: LIVE_URL,
    capturedAt: now,
    browser: 'Chromium (Playwright)',
    commitAtCapture: process.env.GITHUB_SHA || null,
    generatedBy: 'scripts/capture-live-screenshots.mjs',
    captures: records
  }, null, 2) + '\n');

  console.log('Production screenshot matrix complete.');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
