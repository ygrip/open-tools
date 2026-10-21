import { test, expect, devices } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

/**
 * Browser-observed mobile lab vitals, not inferred from compressed asset size.
 * Emulates a 4G phone on the CI preview build. This is NOT field/RUM data:
 * actual device and carrier populations require opt-in real-user telemetry.
 */
test('mobile Chrome records LCP, CLS, FCP and interaction timing on real rendered pages', async ({ browser }) => {
  test.setTimeout(120_000);
  const report: Array<Record<string, string | number | null>> = [];
  for (const route of ['/', '/hash-generator/']) {
    const context = await browser.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    try {
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false, latency: 150, downloadThroughput: 187_500, uploadThroughput: 93_750
      });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 });
      await page.addInitScript(() => {
        const state = { lcp: 0, cls: 0, inp: 0 };
        Object.defineProperty(window, '__trickVitals', { value: state });
        try {
          new PerformanceObserver(list => {
            for (const entry of list.getEntries()) state.lcp = Math.max(state.lcp, entry.startTime);
          }).observe({ type: 'largest-contentful-paint', buffered: true });
        } catch { /* browser does not expose LCP */ }
        try {
          new PerformanceObserver(list => {
            for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
              if (!entry.hadRecentInput) state.cls += entry.value ?? 0;
            }
          }).observe({ type: 'layout-shift', buffered: true });
        } catch { /* browser does not expose CLS */ }
        try {
          new PerformanceObserver(list => {
            for (const entry of list.getEntries()) state.inp = Math.max(state.inp, entry.duration);
          }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit & { durationThreshold: number });
        } catch { /* Event Timing is not exposed */ }
      });
      await page.goto(route, { waitUntil: 'load' });
      await expect(page.locator('main')).toBeVisible();
      // Allow image/font decoding and layout shifts to settle before taking the sample.
      await page.waitForTimeout(1_500);
      await page.locator('main').tap({ position: { x: 20, y: 20 }, force: true });
      await page.waitForTimeout(500);
      const values = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        const fcp = performance.getEntriesByName('first-contentful-paint')[0];
        const state = (window as unknown as Window & { __trickVitals: { lcp: number; cls: number; inp: number } }).__trickVitals;
        return { lcpMs: state.lcp, cls: state.cls, fcpMs: fcp?.startTime ?? 0,
          ttfbMs: nav?.responseStart ?? 0, observedInteractionMs: state.inp || null };
      });
      report.push({ route, device: 'Pixel 7 emulation', network: '4G CDP profile requested (local preview may bypass network throttling)', cpu: '2x slowdown', ...values });
      console.log('Mobile Web Vitals (lab):', JSON.stringify(report.at(-1)));
      // Persist even when a regression assertion fails, so the CI artifact
      // contains the offending browser measurements instead of disappearing.
      await mkdir('artifacts', { recursive: true });
      await writeFile('artifacts/mobile-vitals.json', JSON.stringify({ measuredAt: new Date().toISOString(), kind: 'synthetic mobile lab', report }, null, 2) + '\n');
      if (values.cls > 0.1 || (values.observedInteractionMs ?? 0) > 500) {
        console.warn(`Mobile interaction/layout needs attention on ${route}: CLS=${values.cls.toFixed(3)}, longest observed event=${values.observedInteractionMs}ms`);
      }
      expect(values.fcpMs, `${route}: FCP missing`).toBeGreaterThan(0);
      expect(values.lcpMs, `${route}: LCP missing`).toBeGreaterThan(0);
      expect(values.fcpMs, `${route}: FCP regression`).toBeLessThan(6_000);
      expect(values.lcpMs, `${route}: LCP regression`).toBeLessThan(10_000);
      expect(values.cls, `${route}: CLS regression`).toBeLessThanOrEqual(0.25);
    } finally { await context.close(); }
  }
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/mobile-vitals.json', JSON.stringify({ measuredAt: new Date().toISOString(), kind: 'synthetic mobile lab', report }, null, 2) + '\n');
});
