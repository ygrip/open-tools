import { type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { runtimeMountScript } from '../tool-harness/index.mjs';

export const html = '<!doctype html><html><head><title>Runtime fixture</title></head><body><h1>Runtime fixture</h1><label>Remember me<textarea>keep this text</textarea></label></body></html>';
const hash = createHash('sha256').update(html).digest('hex');
const fixture = { schemaVersion: 3, id: 'runtime-fixture', name: 'Runtime fixture', version: '1.0.0', bundle: { sha256: hash }, guide: { summary: 'Test-only tool, never registered.', steps: ['Choose a permission.'] }, permissions: [], assets: [] };

export async function toolFrame(page: Page) {
  const iframe = page.locator('.runtime-workspace > iframe');
  const handle = await iframe.elementHandle();
  if (!handle) throw new Error('Tool iframe in .runtime-workspace was not mounted');
  const frame = await handle.contentFrame();
  if (!frame) throw new Error('Tool iframe has no browsing context');
  return frame;
}

export async function mountFixture(page: Page, changes: Record<string, unknown> = {}) {
  const tool = { ...fixture, ...changes };
  await page.route('**/bundles/runtime-fixture/**', route => route.fulfill({ json: { id: fixture.id, version: fixture.version, sha256: hash, html } }));
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate(value => { (window as unknown as { __toolTestTool: unknown }).__toolTestTool = value; }, tool);
  await page.addScriptTag({ content: await runtimeMountScript() });
}

/** Neutral state used by site theme/PWA tests, not a tool's editor or output. */
export async function stateProbe(page: Page) {
  const tool = page.frameLocator('.runtime-workspace > iframe');
  await tool.locator('body').evaluate(async () => {
    if (document.readyState !== 'complete') await new Promise<void>(resolve => addEventListener('load', () => resolve(), { once: true }));
    if (document.getElementById('platform-state-probe')) return;
    const label = document.createElement('label'); label.textContent = 'Platform state fixture';
    const input = document.createElement('textarea'); input.id = 'platform-state-probe';
    input.style.cssText = 'max-width:100%;background:var(--ot-bg)';
    label.append(input); document.body.append(label);
  });
  return tool.getByRole('textbox', { name: 'Platform state fixture', exact: true });
}
