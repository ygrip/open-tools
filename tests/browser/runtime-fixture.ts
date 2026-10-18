import { type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { build, transform } from 'esbuild';
import { compile, compileModule } from 'svelte/compiler';

const root = fileURLToPath(new URL('../../', import.meta.url));
export const html = '<!doctype html><html><head><title>Runtime fixture</title></head><body><h1>Runtime fixture</h1><label>Remember me<textarea>keep this text</textarea></label></body></html>';
const hash = createHash('sha256').update(html).digest('hex');
const fixture = { schemaVersion: 3, id: 'runtime-fixture', name: 'Runtime fixture', version: '1.0.0', bundle: { sha256: hash }, guide: { summary: 'Test-only tool, never registered.', steps: ['Choose a permission.'] }, permissions: [], assets: [] };
let mountScript: Promise<string> | undefined;
function script() {
  return mountScript ??= build({
    stdin: { contents: "import { mount } from 'svelte'; import Runtime from './src/lib/components/ToolRuntime.svelte'; import HostUi from './src/lib/components/HostUi.svelte'; document.body.replaceChildren(); mount(Runtime, { target: document.body, props: { tool: window.__runtimeFixture, locale: 'en' } }); mount(HostUi, { target: document.body });", resolveDir: root },
    bundle: true, write: false, format: 'iife', platform: 'browser', conditions: ['browser'], mainFields: ['browser', 'module', 'main'],
    define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'runtime-fixture', setup(builder) {
      builder.onResolve({ filter: /^\$app\/paths$/ }, () => ({ path: 'base', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: "export const base = '';" }));
      builder.onResolve({ filter: /^\$lib\// }, (args) => builder.resolve(resolve(root, 'src/lib', args.path.slice(5)), { resolveDir: root, kind: args.kind }));
      // Rune modules (*.svelte.ts) need TypeScript stripped, then the Svelte module compiler.
      builder.onLoad({ filter: /\.svelte\.ts$/ }, async ({ path }) => ({ contents: compileModule((await transform(await readFile(path, 'utf8'), { loader: 'ts' })).code, { filename: path, generate: 'client' }).js.code, loader: 'js', resolveDir: dirname(path) }));
      builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => ({ contents: compile(await readFile(path, 'utf8'), { filename: path, generate: 'client', css: 'injected' }).js.code, loader: 'js', resolveDir: dirname(path) }));
    } }]
  }).then((result) => result.outputFiles[0].text);
}
export async function mountFixture(page: Page, changes: Record<string, unknown> = {}) {
  const tool = { ...fixture, ...changes };
  await page.route('**/bundles/runtime-fixture/**', (route) => route.fulfill({ json: { id: fixture.id, version: fixture.version, sha256: hash, html } }));
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.evaluate((value) => { (window as unknown as { __runtimeFixture: unknown }).__runtimeFixture = value; }, tool);
  await page.addScriptTag({ content: await script() });
}
