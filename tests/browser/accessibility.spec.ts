import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  for (const route of ['/', '/json-tools']) {
    test(`${route} has no automated WCAG A/AA violations in ${theme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.goto(route);
      if (route === '/json-tools') await expect(page.locator('iframe')).toHaveAttribute('sandbox', 'allow-scripts');
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(result.violations).toEqual([]);
    });
  }
}

test('the open search dialog has no automated WCAG A/AA violations', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search tools', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Search tools' })).toBeVisible();
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
});
