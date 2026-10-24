import { expect, test } from '@playwright/test';
import { mountFixture } from './runtime-fixture';
import { sharedCopies } from '../../src/lib/registry/ui-copy';
import { runtimeCopies } from '../../src/lib/runtime/strings';

test.use({ serviceWorkers: 'block' });
const codes = Object.keys(sharedCopies);

for (const width of [320, 1280]) {
  test(`${width}px: shared controls translate all locales while preserving files, validation, table state and code`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mountFixture(page, { locales: codes });
    const tool = page.frameLocator('iframe');
    await expect(tool.getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
    await tool.locator('body').evaluate(() => {
      type Ui = {
        fileInput(target: Element, options: object): unknown;
        status(target: Element, options: object): unknown;
        loader(target: Element, options: object): unknown;
        codeBlock(target: Element, options: object): unknown;
        table(target: Element, options: object): unknown;
      };
      const ui = (window as unknown as { trickIt: { ui: Ui } }).trickIt.ui;
      function target(id: string) { const element = document.createElement('div'); element.id = id; document.body.append(element); return element; }
      ui.fileInput(target('locale-picker'), { accept: ['text/plain'], maxBytes: 4, preview: false });
      ui.status(target('locale-status'), { state: 'done', title: 'Saved fixture output' });
      ui.loader(target('locale-loader'), { phase: 'initializing', autoHide: false });
      ui.codeBlock(target('locale-code'), { code: 'const retained = "<img>";', language: 'auto', copy: true });
      ui.table(target('locale-table'), {
        columns: [{ key: 'name', label: 'Fixture name' }, { key: 'score', label: 'Fixture score' }],
        rows: Array.from({ length: 32 }, (_, index) => ({ name: 'record-' + (index + 1), score: index })), pageSize: 10
      });
    });
    const picker = tool.locator('#locale-picker');
    await picker.locator('input').setInputFiles({ name: 'kept.txt', mimeType: 'text/plain', buffer: Buffer.from('keep') });
    await picker.locator('input').setInputFiles({ name: 'blocked.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
    await expect(picker.locator('.ti-file')).toContainText('kept.txt');
    const grid = tool.locator('#locale-table');
    await grid.getByRole('searchbox').fill('record');
    await grid.getByLabel('Density', { exact: true }).selectOption('compact');
    await grid.getByRole('button', { name: 'Next page', exact: true }).click();
    await grid.locator('summary').click();
    await grid.getByRole('checkbox', { name: 'Fixture score', exact: true }).uncheck();
    // Column visibility changes reset the page by design. Return to page two.
    await grid.getByRole('button', { name: 'Next page', exact: true }).click();
    await grid.locator('summary').click();
    for (const locale of codes) {
      await page.getByLabel('Test host locale', { exact: true }).selectOption(locale);
      const text = sharedCopies[locale];
      await expect(tool.locator('html')).toHaveAttribute('lang', locale);
      await expect(picker.locator('.ti-drop-label')).toHaveText(text.file.label);
      await expect(picker.locator('.ti-drop-error')).toHaveText('blocked.json: ' + text.file.type);
      await expect(picker.locator('.ti-file')).toHaveCount(1);
      await expect(picker.locator('.ti-file')).toContainText('kept.txt');
      await expect(picker.locator('.ti-file button')).toHaveAttribute('aria-label', text.file.remove + ' kept.txt');
      await expect(tool.locator('#locale-status .ti-title')).toHaveText('Saved fixture output');
      await expect(tool.locator('#locale-status button')).toHaveAttribute('aria-label', text.close);
      await expect(tool.locator('#locale-loader .ti-title')).toHaveText(text.loader.initializing);
      await expect(tool.locator('#locale-code code')).toHaveText('const retained = "<img>";');
      await expect(tool.locator('#locale-code .ti-code-title')).toHaveText(text.code.title);
      await expect(tool.locator('#locale-code button')).toHaveAttribute('title', text.code.unavailable);
      await expect(tool.locator('#locale-code button')).toHaveText(text.code.copy);
      await expect(grid.getByRole('searchbox')).toHaveAttribute('placeholder', text.table.search);
      await expect(grid.getByRole('searchbox')).toHaveValue('record');
      await expect(grid.locator('.ti-grid')).toHaveAttribute('data-density', 'compact');
      await expect(grid.locator('th')).toHaveCount(1);
      await expect(grid.locator('tbody tr')).toHaveCount(10);
      await expect(grid.locator('tbody tr').first()).toContainText('record-11');
      expect(await tool.locator('body').evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

test('localized permission reasons update consent and action dialogs without restarting a tool', async ({ page }) => {
  const translations = Object.fromEntries(codes.map((locale) => [locale, {
    permissionReasons: { wasm: 'Fixture reason: ' + runtimeCopies[locale].labels.wasm, 'clipboard-write': 'Fixture reason: ' + runtimeCopies[locale].labels['clipboard-write'] }
  }]));
  await mountFixture(page, {
    locales: codes, translations,
    permissions: [
      { name: 'wasm', reason: 'Default fixture WASM reason.', required: false },
      { name: 'clipboard-write', reason: 'Default fixture clipboard reason.', required: false }
    ]
  });
  for (const locale of codes) {
    await page.getByLabel('Test host locale', { exact: true }).selectOption(locale);
    await expect(page.locator('.consent .permission')).toContainText(translations[locale].permissionReasons.wasm);
  }
  await page.locator('.consent input[value="wasm"]').uncheck();
  await page.locator('.consent button').click();
  const tool = page.frameLocator('iframe');
  await expect(tool.getByRole('textbox')).toBeVisible();
  await tool.getByRole('textbox').fill('retained permission workspace');
  for (const locale of codes) {
    await page.getByLabel('Test host locale', { exact: true }).selectOption(locale);
    await expect(tool.getByRole('textbox')).toHaveValue('retained permission workspace');
  }
  await tool.locator('body').evaluate(() => {
    const target = document.createElement('div'); document.body.append(target);
    const ui = (window as unknown as { trickIt: { ui: { codeBlock(target: Element, options: object): unknown } } }).trickIt.ui;
    ui.codeBlock(target, { code: 'fixture copy', copy: true });
  });
  await tool.locator('.ti-code button').click();
  const finalLocale = codes[codes.length - 1];
  await expect(page.locator('.operation-dialog')).toContainText(translations[finalLocale].permissionReasons['clipboard-write']);
  await page.getByRole('button', { name: runtimeCopies[finalLocale].deny, exact: true }).click();
});

test('code-copy failure remains translated after live locale changes', async ({ page }) => {
  await mountFixture(page, { locales: codes, permissions: [{ name: 'clipboard-write', reason: 'Test fixture clipboard permission.', required: false }] });
  const tool = page.frameLocator('iframe');
  await expect(tool.getByRole('heading', { name: 'Runtime fixture' })).toBeVisible();
  await tool.locator('body').evaluate(() => {
    const target = document.createElement('div'); document.body.append(target);
    const ui = (window as unknown as { trickIt: { ui: { codeBlock(target: Element, options: object): unknown } } }).trickIt.ui;
    ui.codeBlock(target, { code: 'keep this code', copy: true });
  });
  await tool.getByRole('button', { name: 'Copy code', exact: true }).click();
  await page.getByRole('button', { name: 'Don’t allow', exact: true }).click();
  for (const locale of codes) {
    await page.getByLabel('Test host locale', { exact: true }).selectOption(locale);
    await expect(tool.locator('.ti-code button')).toHaveText(sharedCopies[locale].code.error);
    await expect(tool.locator('.ti-code code')).toHaveText('keep this code');
  }
});
