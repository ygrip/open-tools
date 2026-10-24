import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { mountFixture } from './runtime-fixture';
import { sharedCopies } from '../../src/lib/registry/ui-copy';

const languages = Object.keys(sharedCopies);
const messages: Record<string, Record<string, string>> = Object.fromEntries(await Promise.all(languages.map(async locale => [locale,
  JSON.parse(await readFile(new URL(`../../messages/${locale}.json`, import.meta.url), 'utf8'))
])));

for (const width of [320, 1280]) {
  test(`${width}px: native popup defaults, attribution and toast controls preserve the workspace`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mountFixture(page, { locales: languages });
    const tool = page.frameLocator('iframe');
    await tool.getByRole('textbox').fill('keep the workspace');
    await tool.locator('body').evaluate(() => {
      const ui = (window as unknown as { trickIt: { ui: {
        info(options: object): Promise<boolean>; confirm(options: object): Promise<boolean>; toast(message: string): Promise<void>;
      } } }).trickIt.ui;
      for (const action of ['info', 'confirm', 'toast']) {
        const button = document.createElement('button');
        button.id = 'fixture-' + action;
        button.textContent = 'Fixture ' + action;
        button.onclick = () => {
          if (action === 'toast') { void ui.toast('Fixture notice'); return; }
          void ui[action as 'info' | 'confirm']({ message: 'Fixture message' });
        };
        document.body.append(button);
      }
    });
    for (const locale of languages) {
      await page.getByLabel('Test host locale', { exact: true }).selectOption(locale);
      await tool.locator('#fixture-info').click();
      const dialog = page.locator('.host-dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('heading')).toHaveText(sharedCopies[locale].note);
      await expect(dialog.getByRole('button', { name: messages[locale].ui_got_it, exact: true })).toBeVisible();
      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      expect(Math.abs(box!.x + box!.width / 2 - width / 2)).toBeLessThan(2);
      expect(Math.abs(box!.y + box!.height / 2 - 450)).toBeLessThan(2);
      await expect(tool.locator('dialog')).toHaveCount(0);
      await dialog.getByRole('button', { name: messages[locale].ui_got_it, exact: true }).click();
      await expect(tool.locator('#fixture-info')).toBeFocused();
      await tool.locator('#fixture-confirm').click();
      await expect(dialog.getByRole('heading')).toHaveText(sharedCopies[locale].continueQuestion);
      await dialog.getByRole('button', { name: messages[locale].ui_cancel, exact: true }).click();
      await expect(tool.locator('#fixture-confirm')).toBeFocused();
      await tool.locator('#fixture-toast').click();
      const notices = page.getByRole('region', { name: messages[locale].ui_notifications, exact: true });
      await expect(notices).toContainText('Fixture notice');
      await notices.getByRole('button', { name: messages[locale].ui_dismiss, exact: true }).click();
      await expect(tool.getByRole('textbox')).toHaveValue('keep the workspace');
    }
  });
}
