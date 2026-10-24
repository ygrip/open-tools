import { expect, test } from './fixtures';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const catalog = JSON.parse(readFileSync(new URL('../../src/lib/registry/generated.json', import.meta.url), 'utf8')) as Array<{
  id: string; name: string; version: string; bundle: { sha256: string };
  permissions: { name: string }[]; translations?: { en?: { name: string } };
}>;

/**
 * A consumer-contract suite for every published pin, not tool-specific UI tests.
 * Standalone tools still own their domain behavior and detailed E2E checks.
 */
for (const tool of catalog) {
  test(`published ${tool.id} matches its manifest, bundle and host contract`, async ({ page, request }) => {
    const url = `/bundles/${tool.id}/${tool.bundle.sha256}.json?version=${encodeURIComponent(tool.version)}`;
    const response = await request.get(url);
    expect(response.ok(), `missing published bundle: ${tool.id}`).toBe(true);
    const envelope = await response.json();
    expect(envelope).toMatchObject({ id: tool.id, version: tool.version, sha256: tool.bundle.sha256 });
    expect(createHash('sha256').update(envelope.html, 'utf8').digest('hex')).toBe(tool.bundle.sha256);

    await page.goto(`/${tool.id}/`);
    await expect(page.getByRole('heading', { name: tool.translations?.en?.name ?? tool.name, level: 1 })).toBeVisible();
    const startup = (tool.permissions ?? []).filter(p => ['external-assets', 'wasm', 'workers'].includes(p.name));
    if (startup.length) {
      // Never silently approve external engines during CI. Verify the host
      // presents consent and does not start an unapproved sandbox.
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.locator('.runtime-workspace > iframe')).toHaveCount(0);
      return;
    }
    const frame = page.locator('.runtime-workspace > iframe');
    await expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
    await expect.poll(() => page.frameLocator('.runtime-workspace > iframe').locator('html').evaluate(() =>
      (window as Window & { trickIt?: { version: number } }).trickIt?.version ?? 0
    )).toBe(1);
  });
}
