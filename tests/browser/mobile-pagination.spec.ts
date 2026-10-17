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
  await expect(page.getByRole('button', { name: /Switch to .* theme/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await nav.getByRole('link', { name: 'How it works', exact: true }).click();
  await expect(page).toHaveURL(/#how-it-works$/);
  await nav.getByRole('link', { name: 'Toolbox', exact: true }).click();
  await expect(page).toHaveURL(/#tools$/);
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

test('hero motion can pause, resumes, and stops outside the viewport', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const image = page.locator('.hero-art img');
  await page.locator('.hero-art').scrollIntoViewIfNeeded();
  const state = () => image.evaluate((element) => element.getAnimations().map((animation) => animation.playState));
  await expect.poll(state).toEqual(['running']);
  await page.getByRole('button', { name: 'Pause hero animation' }).click();
  await expect.poll(state).toEqual(['paused']);
  await page.getByRole('button', { name: 'Play hero animation' }).click();
  await expect.poll(state).toEqual(['running']);
  await page.locator('.site-footer').scrollIntoViewIfNeeded();
  await expect.poll(state).toEqual(['paused']);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(state).toEqual([]);
  await expect(page.getByRole('button', { name: 'Pause hero animation' })).toBeHidden();
});
