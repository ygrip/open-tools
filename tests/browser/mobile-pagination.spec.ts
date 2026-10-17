import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { catalogFixtureScript } from './catalog-fixture';

for (const width of [320, 375, 430]) test(`mobile header exposes navigation and controls at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 812 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  for (const name of ['Toolbox', 'How it works', 'GitHub']) {
    const link = nav.getByRole('link', { name, exact: true });
    await expect(link).toBeVisible();
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByRole('button', { name: 'Search tools', exact: true })).toBeVisible();
  // Language + theme live behind the gooey quick-settings disclosure on phones.
  const settings = page.getByRole('button', { name: 'Options', exact: true });
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: /Switch to .* theme/ })).toBeHidden();
  await settings.focus();
  await page.keyboard.press('ArrowDown');
  await expect(settings).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('link', { name: 'EN English' })).toBeFocused();
  for (const control of [page.getByRole('link', { name: 'EN English' }), page.getByRole('link', { name: 'ID Bahasa Indonesia' }), page.getByRole('button', { name: /Switch to .* theme/ })]) {
    await expect(control).toBeVisible();
    // Poll: the items spring in from 0.6 scale.
    await expect.poll(async () => { const box = (await control.boundingBox())!; return Math.min(box.width, box.height); }).toBeGreaterThanOrEqual(44);
  }
  await expect.poll(async () => (await new AxeBuilder({ page }).include('.topbar').analyze()).violations.map((v) => v.id)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
  await expect(settings).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await nav.getByRole('link', { name: 'How it works', exact: true }).click();
  await expect(page).toHaveURL(/#how-it-works$/);
  await nav.getByRole('link', { name: 'Toolbox', exact: true }).click();
  await expect(page).toHaveURL(/#tools$/);
});

test('mobile quick-settings menu is modal: outside taps only close it, Tab stays inside, share opens', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const settings = page.getByRole('button', { name: 'Options', exact: true });
  const howLink = page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'How it works', exact: true });
  await settings.click();
  await expect(settings).toHaveAttribute('aria-expanded', 'true');
  const box = (await howLink.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(settings).toHaveAttribute('aria-expanded', 'false');
  await expect(page).not.toHaveURL(/#how-it-works$/);
  await settings.click();
  for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('.quick-settings'))).toBe(true);
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('tool page header uses the round share + gooey quick-settings on phones', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/json-tools/');
  const header = page.locator('.tool-header');
  await expect(header.getByRole('link', { name: 'Toolbox', exact: true })).toBeVisible();
  await expect(header.getByRole('button', { name: 'Share', exact: true })).toBeVisible();
  await expect(header.locator(':scope > .tool-header-actions > .language-switcher')).toBeHidden();
  await header.getByRole('button', { name: 'Options', exact: true }).click();
  await expect(header.getByRole('button', { name: /Switch to .* theme/ })).toBeVisible();
  // Poll: contrast is measured mid fade-in otherwise.
  await expect.poll(async () => (await new AxeBuilder({ page }).include('.tool-header').analyze()).violations.map((v) => v.id)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [375, 1440]) test(`actual catalog paginates and resets filters at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.addScriptTag({ content: await catalogFixtureScript() });
  const pager = page.getByRole('navigation', { name: 'Tool list pages' });
  const cards = page.locator('.tool-card');
  await expect(cards).toHaveCount(6);
  await expect(pager).toContainText('Showing 1–6 of 14 tools');
  await expect(pager.getByRole('button', { name: 'Previous tool page' })).toBeDisabled();
  await pager.getByRole('button', { name: 'Next tool page' }).click();
  await expect(cards).toHaveCount(6);
  await expect(cards.first()).toContainText('Fixture 07');
  await expect(page.getByRole('heading', { name: 'What can we help with?' })).toBeFocused();
  await pager.getByRole('button', { name: 'Next tool page' }).click();
  await expect(cards).toHaveCount(2);
  await expect(pager).toContainText('Showing 13–14 of 14 tools');
  await expect(pager.getByRole('button', { name: 'Next tool page' })).toBeDisabled();
  await page.getByRole('button', { name: 'Data & formats', exact: true }).click();
  await expect(pager).toContainText('Showing 1–6 of 8 tools');
  await pager.getByRole('button', { name: 'Next tool page' }).click();
  await expect(cards).toHaveCount(2);
  await page.getByRole('searchbox', { name: 'Search the toolbox' }).fill('Fixture 01');
  await expect(cards).toHaveCount(1);
  await expect(pager).toContainText('Showing 1–1 of 1 tool');
  await page.getByRole('searchbox', { name: 'Search the toolbox' }).fill('absent');
  await expect(pager).toHaveCount(0);
  await page.getByRole('button', { name: 'Show all tools' }).click();
  await expect(cards).toHaveCount(6);
  await expect(pager).toContainText('Showing 1–6 of 14 tools');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
});

test('hero motion runs in the viewport and stops outside it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const image = page.locator('.hero-art img');
  await page.locator('.hero-art').scrollIntoViewIfNeeded();
  const state = () => image.evaluate((element) => element.getAnimations().map((animation) => animation.playState));
  await expect.poll(state).toEqual(expect.arrayContaining(['running']));
  await page.locator('.site-footer').scrollIntoViewIfNeeded();
  await expect.poll(state).not.toContain('running');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(state).toEqual([]);
});
