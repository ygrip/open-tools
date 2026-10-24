import { expect, test } from './fixtures';
import { scaffoldFiles } from '../scaffold-recipe.mjs';
import { sandboxDocument } from '../../src/lib/registry/sandbox';

test('copyable scaffold works in the actual opaque sandbox and preserves text across themes', async ({ page }) => {
  const html = (await scaffoldFiles()).get('src/index.html');
  if (!html) throw new Error('Missing documented tool HTML');
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.setContent('<iframe title="Text counter example" sandbox="allow-scripts"></iframe>');
  await page.locator('iframe').evaluate((element, document) => { (element as HTMLIFrameElement).srcdoc = document; }, sandboxDocument(html));
  const frame = page.frameLocator('iframe');
  const input = frame.getByRole('textbox', { name: 'Your text' });
  await input.fill('hello');
  await expect(frame.locator('#count')).toHaveText('5 Unicode code points');
  await input.fill('🚀a');
  await expect(frame.locator('#count')).toHaveText('2 Unicode code points');
  const background = await input.evaluate((element) => getComputedStyle(element).backgroundColor);
  await page.locator('iframe').evaluate((element) => (element as HTMLIFrameElement).contentWindow!.postMessage({ type: 'open-tools:theme', version: 1, theme: 'dark' }, '*'));
  await expect(frame.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(input).toHaveValue('🚀a');
  expect(await input.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(background);
  await frame.getByRole('button', { name: 'Clear text' }).click();
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  await expect(frame.locator('#count')).toHaveText('0 Unicode code points');
  // Clearing must consume the injected shared kit, not a custom notice.
  await expect(frame.locator('.ti-toast')).toHaveText('Text cleared');
  expect(requests.filter((url) => /^https?:/.test(url))).toEqual([]);
});
