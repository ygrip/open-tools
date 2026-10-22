import { expect, test } from '@playwright/test';
import { stateProbe } from './runtime-fixture';

test('support cards display each platform logo from local assets', async ({ page }) => {
  await page.goto('/');
  for (const platform of ['trakteer', 'kofi', 'patreon']) {
    const logo = page.locator(`.support-option .support-icon img[src$="/brand/support-${platform}.svg"]`);
    await expect(logo).toHaveCount(1);
    await expect(logo).toBeVisible();
    await expect.poll(() => logo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
});

test('host theme propagation preserves generic iframe state', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/json-tools');
  const input = await stateProbe(page);
  await input.fill('unsaved platform fixture state');
  const frame = page.frames().find((candidate) => candidate !== page.mainFrame())!;
  expect(await frame.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  expect(await frame.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ot-bg').trim())).toBe('#fff8f0');
  const lightBackground = await input.evaluate((element) => getComputedStyle(element).backgroundColor);
  await frame.evaluate(() => { (window as unknown as { themeMarker: number }).themeMarker = 42; });
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => frame.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  expect(await frame.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ot-bg').trim())).toBe('#242127');
  expect(await input.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe(lightBackground);
  expect(await frame.evaluate(() => (window as unknown as { themeMarker: number }).themeMarker)).toBe(42);
  await expect(input).toHaveValue('unsaved platform fixture state');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.frameLocator('iframe').locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('theme continues to work when storage is denied', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', { value() { throw new Error('Storage denied'); } });
    Object.defineProperty(Storage.prototype, 'setItem', { value() { throw new Error('Storage denied'); } });
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/json-tools');
  await expect(page.frameLocator('iframe').locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.frameLocator('iframe').locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('status')).toContainText('Theme changed for this visit');
});

test('quick search traps focus, closes with Escape, and restores the trigger', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Search tools', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Search tools' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('searchbox')).toBeFocused();
  await dialog.getByRole('searchbox').fill('XML');
  await expect(dialog.getByRole('link', { name: /JSON Tools/ })).toBeVisible();
  await dialog.getByRole('searchbox').fill('not a tool');
  await expect(dialog).toContainText('No helpers');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.keyboard.press('/');
  await expect(dialog).toBeVisible();
});

test('search popup scrolls results without moving its input or footer on small screens', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 480 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Search tools', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Search tools' });
  const results = dialog.locator('.search-results');
  await expect(results.locator('.search-result').first()).toBeVisible();
  // The whole modal scales during entry. Compare element positions only after
  // that transition settles, otherwise a moving dialog looks like a moving header.
  await expect(dialog).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');

  const measure = () => dialog.evaluate((element) => {
    const header = element.querySelector('.search-panel-header')!;
    const footer = element.querySelector('.search-tip')!;
    const list = element.querySelector('.search-results')!;
    return {
      dialogScroll: element.scrollTop,
      dialogOverflow: getComputedStyle(element).overflowY,
      listOverflow: getComputedStyle(list).overflowY,
      listScroll: list.scrollTop,
      listHeight: list.clientHeight,
      listContentHeight: list.scrollHeight,
      headerTop: header.getBoundingClientRect().top,
      footerTop: footer.getBoundingClientRect().top
    };
  });
  const before = await measure();
  expect(before.dialogOverflow).toBe('hidden');
  expect(before.listOverflow).toBe('auto');
  expect(before.listContentHeight).toBeGreaterThan(before.listHeight);
  await results.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const after = await measure();
  expect(after.listScroll).toBeGreaterThan(0);
  expect(after.dialogScroll).toBe(0);
  expect(after.headerTop).toBeCloseTo(before.headerTop, 0);
  expect(after.footerTop).toBeCloseTo(before.footerTop, 0);
  await expect(dialog.getByRole('searchbox')).toBeVisible();
});

for (const { path, label, defaultHint, animatedPrefix } of [
  { path: '/', label: 'Search tools', defaultHint: 'What would make today a little easier?', animatedPrefix: 'Search ' },
  { path: '/id/', label: 'Cari alat', defaultHint: 'Apa yang ingin kamu selesaikan?', animatedPrefix: 'Cari ' }
]) {
  test(`search placeholder is localized, animated when idle, and static for reduced motion: ${path}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(path);
    await page.getByRole('button', { name: label, exact: true }).click();
    const search = page.getByRole('dialog', { name: label }).getByRole('searchbox');
    await expect(search).toHaveAttribute('placeholder', defaultHint);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect.poll(async () => (await search.getAttribute('placeholder'))?.startsWith(animatedPrefix)).toBe(true);
    await search.fill('JSON');
    await expect(search).toHaveAttribute('placeholder', defaultHint);
    await search.fill('');
    await expect.poll(async () => (await search.getAttribute('placeholder'))?.startsWith(animatedPrefix)).toBe(true);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(search).toHaveAttribute('placeholder', defaultHint);
  });
}

test('catalog filters and empty state are usable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('searchbox', { name: 'Search the toolbox' }).fill('not-here');
  await expect(page.getByRole('heading', { name: 'No little helpers found. Yet.' })).toBeVisible();
  await page.getByRole('button', { name: 'Show all tools' }).click();
  await expect(page.getByRole('link', { name: /Open / }).first()).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search the toolbox' }).fill('JSON');
  await expect(page.getByRole('link', { name: /Open JSON Tools/ })).toBeVisible();
});

for (const theme of ['light', 'dark'] as const) {
  for (const width of [375, 1440]) {
    test(`${theme} clay layout stays within ${width}px viewport and respects reduced motion`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Small tools.');
      const image = page.getByRole('img', { name: /smiling orange clay toolbox/ });
      await expect(image).toBeVisible();
      expect(await image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.getByRole('link', { name: 'Explore the toolbox' }).evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');
      await page.screenshot({ path: `/tmp/open-tools-${theme}-${width}.png`, fullPage: true });
    });
  }
}

test('catalog cards have equal heights, two capability rows, and an accessible themed focus', async ({ page }) => {
  for (const width of [320, 375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.goto('/');
    const cards = page.locator('.tool-grid .tool-card');
    await expect(cards).toHaveCount(6);
    await page.evaluate(() => document.fonts.ready);
    const layout = await cards.evaluateAll((items) => items.map((card) => {
      const chips = card.querySelector('.tool-capabilities');
      if (!chips) throw new Error('No capability preview');
      const computed = getComputedStyle(chips);
      return { height: Math.round(card.getBoundingClientRect().height), previewHeight: chips.getBoundingClientRect().height, rows: computed.gridTemplateRows, overflow: computed.overflowX, mask: computed.maskImage, hue: getComputedStyle(card).getPropertyValue('--tool-hue') };
    }));
    expect(Math.max(...layout.map((x) => x.height)) - Math.min(...layout.map((x) => x.height))).toBeLessThanOrEqual(1);
    for (const card of layout) {
      expect(card.previewHeight).toBeLessThanOrEqual(59);
      expect(card.rows.split(' ').length).toBe(2);
      expect(card.overflow).toBe('hidden');
      expect(card.mask).toContain('linear-gradient');
    }
    expect(new Set(layout.map((x) => x.hue)).size).toBeGreaterThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const first = cards.first();
    const before = await first.evaluate((el) => getComputedStyle(el).backgroundColor);
    await page.keyboard.press('Tab');
    await first.focus();
    await expect(first).toBeFocused();
    const after = await first.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(after).not.toBe(before);
    await expect(first).toHaveCSS('outline-style', 'solid');
    await first.hover();
    await expect(first).toHaveCSS('transition-duration', /0s/);
  }
});
