import { expect, test } from './fixtures';
import { mountFixture, toolFrame } from './runtime-fixture';

test.use({ serviceWorkers: 'block' });

test('shared Highlight.js code blocks escape markup and survive mobile theme changes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await mountFixture(page);
  await expect(page.frameLocator('.runtime-workspace > iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = await toolFrame(page);
  await frame.evaluate(() => {
    const mount = document.createElement('div'); mount.id = 'code-block-fixture'; document.body.append(mount);
    const ui = (window as unknown as { trickIt: { ui: { codeBlock(target: Element, options: object): { update(options: object): void; remove(): void } } } }).trickIt.ui;
    (window as unknown as { codeBlockFixture: unknown }).codeBlockFixture = ui.codeBlock(mount, {
      title: 'hello.js', language: 'javascript',
      code: 'const message = "<img src=x onerror=alert(1)>";\\nconsole.log(message);'
    });
  });
  const tool = page.frameLocator('.runtime-workspace > iframe');
  const block = tool.locator('.ti-code');
  await expect(block.locator('pre code')).toContainText('<img src=x onerror=alert(1)>');
  await expect(block.locator('img')).toHaveCount(0);
  await expect(block.locator('.hljs-keyword').first()).toContainText('const');
  await expect(block.locator('pre')).toHaveCSS('overflow-x', 'auto');
  expect(await tool.locator('body').evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const before = await block.locator('pre').evaluate(node => getComputedStyle(node).backgroundColor);
  await frame.evaluate(() => { document.documentElement.dataset.theme = 'dark'; document.documentElement.lang = 'id'; dispatchEvent(new CustomEvent('trick-it:localechange')); });
  const after = await block.locator('pre').evaluate(node => getComputedStyle(node).backgroundColor);
  expect(after).not.toBe(before);
  await frame.evaluate(() => (window as unknown as { codeBlockFixture: { update(options: object): void } }).codeBlockFixture.update({
    code: '<script>alert("unsafe")</script>\\n' + 'x'.repeat(180_000),
    language: 'unknown-language', wrap: true, copy: true
  }));
  await expect(block).toHaveAttribute('data-wrap', 'true');
  await expect(block.locator('script')).toHaveCount(0);
  await expect(block.locator('code')).toContainText('<script>alert("unsafe")</script>');
  await expect(block.getByRole('button', { name: 'Salin kode' })).toBeDisabled();
  expect(await tool.locator('body').evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await frame.evaluate(() => (window as unknown as { codeBlockFixture: { remove(): void } }).codeBlockFixture.remove());
  await expect(block).toHaveCount(0);
});

test('shared code block highlights JSON, updates output and keeps unsupported grammar literal', async ({ page }) => {
  await mountFixture(page);
  await expect(page.frameLocator('.runtime-workspace > iframe').getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  const frame = await toolFrame(page);
  await frame.evaluate(() => {
    const target = document.createElement('div'); document.body.append(target);
    const ui = (window as unknown as { trickIt: { ui: { codeBlock(target: Element, options: object): { update(options: object): void } } } }).trickIt.ui;
    (window as unknown as { sampleCode: unknown }).sampleCode = ui.codeBlock(target, { code: '{"ok":true}', language: 'json', title: 'result.json' });
  });
  const block = page.frameLocator('.runtime-workspace > iframe').locator('.ti-code');
  await expect(block.locator('.hljs-attr')).toContainText('ok');
  await expect(block.locator('button')).toBeHidden();
  await frame.evaluate(() => (window as unknown as { sampleCode: { update(options: object): void } }).sampleCode.update({ code: 'no <svg onload=alert(1)>', language: 'not-a-language' }));
  await expect(block.locator('code')).toHaveText('no <svg onload=alert(1)>');
  await expect(block.locator('svg')).toHaveCount(0);
});
