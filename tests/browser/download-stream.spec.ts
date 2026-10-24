import { expect, test } from './fixtures';
import { mountFixture, toolFrame } from './runtime-fixture';

type ExportWindow = Window & {
  trickIt: { request(operation: string, payload: unknown): Promise<unknown>; downloadStream(options: Record<string, unknown>): Promise<void> };
  resumeExport?: () => void; abortExport?: () => void; exportResult?: Promise<string>;
};

test.use({ serviceWorkers: 'block' });

test('streams a 200 MiB GIF-sized export with acknowledged progress and a fresh click for every file', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __downloadBytes: number; __closed: boolean }).__downloadBytes = 0;
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true, value: async () => ({
        createWritable: async () => ({
          write: async (bytes: Uint8Array) => { (window as unknown as { __downloadBytes: number }).__downloadBytes += bytes.byteLength; },
          close: async () => { (window as unknown as { __closed: boolean }).__closed = true; },
          abort: async () => {}
        })
      })
    });
  });
  await mountFixture(page, { permissions: [{ name: 'downloads', reason: 'Save an export.', required: false }] });
  await expect(page.frameLocator('.runtime-workspace > iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = await toolFrame(page);
  const result = frame.evaluate(async () => {
    const { trickIt } = window as unknown as {
      trickIt: { downloadStream(options: unknown): Promise<void> }
    };
    async function* chunks() {
      for (let i = 0; i < 200; i++) yield new Uint8Array(1024 * 1024).fill(i);
    }
    await trickIt.downloadStream({ filename: 'large.zip', mime: 'application/zip', size: 200 * 1024 * 1024, chunks: chunks() });
    return true;
  });
  await expect(page.getByRole('dialog', { name: 'Allow this tool action?' })).toContainText('large.zip');
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  expect(await result).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { __downloadBytes: number }).__downloadBytes)).toBe(200 * 1024 * 1024);
  await expect(page.locator('[data-download-progress]')).toContainText('200.0 MiB / 200.0 MiB · 100%');
  expect(await page.evaluate(() => (window as unknown as { __closed: boolean }).__closed)).toBe(true);

  // The grant is remembered, but the host must still present a trusted click
  // for Chrome's save-file picker on every subsequent export.
  const again = frame.evaluate(async () => {
    const { trickIt } = window as unknown as { trickIt: { downloadStream(options: unknown): Promise<void> } };
    async function* chunks() { yield new Uint8Array([5, 6]); }
    await trickIt.downloadStream({ filename: 'again.zip', mime: 'application/zip', size: 2, chunks: chunks() });
    return true;
  });
  await expect(page.getByRole('dialog', { name: 'Allow this tool action?' })).toContainText('again.zip');
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  expect(await again).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { __downloadBytes: number }).__downloadBytes)).toBe(200 * 1024 * 1024 + 2);
});

test('a short stream is rejected and aborts its pending writable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true, value: async () => ({
        createWritable: async () => ({
          write: async () => {},
          close: async () => {},
          abort: async () => { (window as unknown as { __aborted?: boolean }).__aborted = true; }
        })
      })
    });
  });
  await mountFixture(page, { permissions: [{ name: 'downloads', reason: 'Save an export.', required: false }] });
  await expect(page.frameLocator('.runtime-workspace > iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = await toolFrame(page);
  const task = frame.evaluate(async () => {
    const { trickIt } = window as unknown as { trickIt: { downloadStream(options: unknown): Promise<void> } };
    async function* chunks() { yield new Uint8Array([1, 2, 3]); }
    try { await trickIt.downloadStream({ filename: 'short.bin', mime: 'application/octet-stream', size: 8, chunks: chunks() }); return 'unexpected'; }
    catch { return 'rejected'; }
  });
  await page.getByRole('dialog', { name: 'Allow this tool action?' }).waitFor();
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  expect(await task).toBe('rejected');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __aborted?: boolean }).__aborted === true)).toBe(true);
});

test('a clipboard prompt cannot interrupt stream chunks or cancellation', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async () => ({ createWritable: async () => ({ write: async () => {}, close: async () => {}, abort: async () => {} }) }) });
  });
  await mountFixture(page, { permissions: [{ name: 'downloads', reason: 'Save an export.', required: false }, { name: 'clipboard-write', reason: 'Copy a result.', required: false }, { name: 'clipboard-read', reason: 'Paste input.', required: false }] });
  await expect(page.frameLocator('.runtime-workspace > iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = await toolFrame(page);
  await frame.evaluate(() => {
    const w = window as unknown as ExportWindow;
    async function* chunks() {
      yield new Uint8Array(1024 * 1024);
      await new Promise<void>(resolve => { w.resumeExport = resolve; });
      yield new Uint8Array(1024 * 1024);
    }
    w.exportResult = w.trickIt.downloadStream({ filename: 'concurrent.zip', mime: 'application/zip', size: 2 * 1024 * 1024, chunks: chunks() }).then(() => 'saved', () => 'failed');
  });
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  await expect(page.locator('[data-download-progress]')).toContainText('50%');
  await frame.evaluate(() => { void (window as unknown as ExportWindow).trickIt.request('clipboard-write', 'copy').catch(() => undefined); });
  await expect(page.getByRole('dialog', { name: 'Allow this tool action?' })).toBeVisible();
  await frame.evaluate(() => (window as unknown as ExportWindow).resumeExport!());
  expect(await frame.evaluate(() => (window as unknown as ExportWindow).exportResult)).toBe('saved');
  await page.getByRole('button', { name: 'Don’t allow', exact: true }).click();

  // Cleanup must also remain available while another capability prompt is open.
  await frame.evaluate(() => {
    const w = window as unknown as ExportWindow;
    const controller = new AbortController(); w.abortExport = () => controller.abort();
    async function* chunks() { yield new Uint8Array(1); await new Promise<void>(resolve => { w.resumeExport = resolve; }); yield new Uint8Array(1); }
    w.exportResult = w.trickIt.downloadStream({ filename: 'cancel.zip', mime: 'application/zip', size: 2, chunks: chunks(), signal: controller.signal }).then(() => 'saved', error => error.code);
  });
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  await expect(page.locator('[data-download-progress]')).toContainText('50%');
  await frame.evaluate(() => { void (window as unknown as ExportWindow).trickIt.request('clipboard-read', undefined).catch(() => undefined); });
  await expect(page.getByRole('dialog', { name: 'Allow this tool action?' })).toBeVisible();
  await frame.evaluate(() => (window as unknown as ExportWindow).abortExport!());
  await expect(page.locator('[data-download-progress]')).toHaveCount(0);
  await frame.evaluate(() => (window as unknown as ExportWindow).resumeExport!());
  expect(await frame.evaluate(() => (window as unknown as ExportWindow).exportResult)).toBe('aborted');
  await page.getByRole('button', { name: 'Don’t allow', exact: true }).click();
});

test('legacy exports above 16 MiB automatically use chunks on browsers without a native picker', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined }); });
  await mountFixture(page, { permissions: [{ name: 'downloads', reason: 'Save an export.', required: false }] });
  await expect(page.frameLocator('.runtime-workspace > iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = await toolFrame(page);
  const saved = frame.evaluate(() => (window as unknown as ExportWindow).trickIt.request('downloads', {
    filename: 'legacy.gif', mime: 'image/gif', bytes: new ArrayBuffer(17 * 1024 * 1024)
  }));
  await expect(page.getByRole('dialog')).toContainText('256.0 MiB');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('legacy.gif');
  await saved;
  await expect(page.locator('[data-download-progress]')).toContainText('100%');
});

test('host Cancel download immediately rejects a paused producer and releases the writable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async () => ({ createWritable: async () => ({ write: async () => {}, close: async () => {}, abort: async () => {} }) }) });
  });
  await mountFixture(page, { permissions: [{ name: 'downloads', reason: 'Save an export.', required: false }] });
  await expect(page.frameLocator('.runtime-workspace > iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = await toolFrame(page);
  await frame.evaluate(() => {
    const w = window as unknown as ExportWindow;
    async function* chunks() { await new Promise(() => {}); yield new Uint8Array(1); }
    w.exportResult = w.trickIt.downloadStream({ filename: 'paused.zip', mime: 'application/zip', size: 1, chunks: chunks() }).then(() => 'saved', error => error.code);
  });
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel download', exact: true }).click();
  expect(await frame.evaluate(() => (window as unknown as ExportWindow).exportResult)).toBe('aborted');
  await expect(page.locator('[data-download-progress]')).toHaveCount(0);
});

test('a sink write failure remains a download error rather than user cancellation', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async () => ({ createWritable: async () => ({ write: async () => { throw new Error('disk full'); }, close: async () => {}, abort: async () => {} }) }) });
  });
  await mountFixture(page, { permissions: [{ name: 'downloads', reason: 'Save an export.', required: false }] });
  await expect(page.frameLocator('.runtime-workspace > iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = await toolFrame(page);
  const result = frame.evaluate(async () => {
    const w = window as unknown as ExportWindow;
    async function* chunks() { yield new Uint8Array(1); }
    try { await w.trickIt.downloadStream({ filename: 'failed.zip', mime: 'application/zip', size: 1, chunks: chunks() }); return 'saved'; }
    catch (error) { return (error as { code: string }).code; }
  });
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  expect(await result).toBe('request');
});
