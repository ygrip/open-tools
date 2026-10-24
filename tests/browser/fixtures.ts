import { test as base } from '@playwright/test';
import { mockAdvertising } from './mock-ads';

export { expect, devices } from '@playwright/test';
export type { Frame, Page } from '@playwright/test';

export const test = base.extend({
  context: async ({ context }, use) => {
    await mockAdvertising(context);
    await use(context);
  }
});
