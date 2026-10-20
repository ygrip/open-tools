import { expect, test } from '@playwright/test';
import { mountFixture } from './runtime-fixture';

test.use({ serviceWorkers: 'block' });

test('streams a 17 MiB export in acknowledged chunks without crossing the legacy 16 MiB limit', async ({ page }) => {
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
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find(item => item !== page.mainFrame())!;
  const result = frame.evaluate(async () => {
    const { trickIt } = window as unknown as {
      trickIt: { downloadStream(options: unknown): Promise<void> }
    };
    async function* chunks() {
      for (let i = 0; i < 17; i++) yield new Uint8Array(1024 * 1024).fill(i);
    }
    await trickIt.downloadStream({ filename: 'large.zip', mime: 'application/zip', size: 17 * 1024 * 1024, chunks: chunks() });
    return true;
  });
  await expect(page.getByRole('dialog', { name: 'Allow this tool action?' })).toContainText('large.zip');
  await page.getByRole('button', { name: 'Allow', exact: true }).click();
  expect(await result).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { __downloadBytes: number }).__downloadBytes)).toBe(17 * 1024 * 1024);
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
  expect(await page.evaluate(() => (window as unknown as { __downloadBytes: number }).__downloadBytes)).toBe(17 * 1024 * 1024 + 2);
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
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = page.frames().find(item => item !== page.mainFrame())!;
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
