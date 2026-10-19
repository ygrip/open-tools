import { expect, test } from '@playwright/test';
import { mountFixture } from './runtime-fixture';

test.use({ serviceWorkers: 'block' });

test('shared table controls search, sort, paginate, hide columns and copy without leaking data', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await mountFixture(page);
  const frame = page.frames().find(candidate => candidate !== page.mainFrame())!;
  await frame.evaluate(() => {
    const mount = document.createElement('div');
    mount.id = 'shared-table-fixture';
    document.body.append(mount);
    const sdk = (window as unknown as { trickIt: { ui: { table: (target: Element, options: object) => unknown } } }).trickIt;
    (window as unknown as { copied: string[]; sharedTable: unknown }).copied = [];
    const rows = Array.from({ length: 31 }, (_, i) => ({ name: 'Person ' + String(i + 1).padStart(2, '0'), score: i + 1, secret: '<img src=x onerror=alert(1)>' }));
    (window as unknown as { sharedTable: unknown }).sharedTable = sdk.ui.table(mount, {
      caption: 'Fixture rows', rows, columns: [{ key: 'name', label: 'Name' }, { key: 'score', label: 'Score' }, { key: 'secret', label: 'Raw value' }],
      pageSize: 10, onCopy: (value: unknown) => (window as unknown as { copied: string[] }).copied.push(String(value))
    });
  });
  const tool = page.frameLocator('iframe');
  await expect(tool.locator('.ti-grid tbody tr')).toHaveCount(10);
  await expect(tool.locator('.ti-grid-pages')).toContainText('Page 1 of 4');
  await tool.getByRole('button', { name: 'Next page' }).click();
  await expect(tool.locator('.ti-grid tbody tr').first()).toContainText('Person 11');
  await tool.getByRole('searchbox', { name: 'Search records' }).fill('Person 31');
  await expect(tool.locator('.ti-grid tbody tr')).toHaveCount(1);
  await expect(tool.locator('.ti-grid tbody tr')).toContainText('Person 31');
  await tool.getByRole('searchbox', { name: 'Search records' }).fill('');
  await tool.getByRole('button', { name: /Sort ascending: Score/ }).click();
  await tool.getByRole('button', { name: /Sort descending: Score/ }).click();
  await expect(tool.locator('.ti-grid tbody tr').first()).toContainText('31');
  await tool.locator('.ti-grid-columns summary').click();
  await tool.locator('.ti-grid-column-list').getByRole('checkbox', { name: 'Raw value' }).uncheck();
  await expect(tool.locator('.ti-grid-scroll th')).toHaveCount(2);
  await tool.locator('.ti-grid-columns summary').click();
  const copy = tool.locator('.ti-grid tbody tr').first().getByRole('button', { name: /Copy Score/ });
  await expect(copy).toHaveText('');
  await copy.click();
  expect(await frame.evaluate(() => (window as unknown as { copied: string[] }).copied)).toEqual(['31']);
  await tool.getByRole('combobox', { name: 'Rows' }).selectOption('25');
  await expect(tool.locator('.ti-grid tbody tr')).toHaveCount(25);
  await tool.getByRole('combobox', { name: 'Density' }).selectOption('compact');
  await expect(tool.locator('.ti-grid')).toHaveAttribute('data-density', 'compact');
  expect(await tool.locator('body').evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await frame.evaluate(() => {
    document.documentElement.lang = 'id'; document.documentElement.dataset.theme = 'dark';
    dispatchEvent(new CustomEvent('trick-it:localechange'));
  });
  await expect(tool.getByRole('searchbox', { name: 'Cari data' })).toBeVisible();
  await expect(tool.locator('.ti-grid tbody tr')).toHaveCount(25);
  await expect(tool.locator('.ti-grid')).toHaveAttribute('data-density', 'compact');
  await frame.evaluate(() => (window as unknown as { sharedTable: { remove(): void } }).sharedTable.remove());
  await expect(tool.locator('.ti-grid')).toHaveCount(0);
});

test('table escapes untrusted values and has useful empty and updated states', async ({ page }) => {
  await mountFixture(page);
  const frame = page.frames().find(candidate => candidate !== page.mainFrame())!;
  await frame.evaluate(() => {
    const mount = document.createElement('div'); mount.id = 'grid'; document.body.append(mount);
    const sdk = (window as unknown as { trickIt: { ui: { table: (target: Element, options: object) => unknown } } }).trickIt;
    (window as unknown as { grid: unknown }).grid = sdk.ui.table(mount, {
      columns: [{ key: 'value', label: 'Value' }], rows: [{ value: '<img src=x onerror=alert(1)>' }]
    });
  });
  const tool = page.frameLocator('iframe');
  await expect(tool.locator('.ti-grid tbody tr')).toContainText('<img src=x onerror=alert(1)>');
  await expect(tool.locator('.ti-grid img')).toHaveCount(0);
  await frame.evaluate(() => (window as unknown as { grid: { update(payload: object): void } }).grid.update({ rows: [] }));
  await expect(tool.locator('.ti-grid-empty')).toContainText('No matching rows');
  await frame.evaluate(() => (window as unknown as { grid: { update(payload: object): void } }).grid.update({ rows: [{ value: 'Updated' }] }));
  await expect(tool.locator('.ti-grid tbody tr')).toContainText('Updated');
});
