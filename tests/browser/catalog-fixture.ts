import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { compile } from 'svelte/compiler';

const root = fileURLToPath(new URL('../../', import.meta.url));
let script: Promise<string> | undefined;

// Mount the actual homepage with a test-only catalog. Never register fake tools
// or add test routes/bundles to the production registry or static build.
export function catalogFixtureScript() {
  return script ??= (async () => {
    const catalog = JSON.parse(await readFile(resolve(root, 'src/lib/registry/generated.json'), 'utf8'));
    const tools = Array.from({ length: 14 }, (_, index) => ({
      ...catalog[0], id: `fixture-${index + 1}`, path: `/fixture-${index + 1}`,
      name: `Fixture ${String(index + 1).padStart(2, '0')}`,
      description: 'Test-only catalog entry.', category: index < 8 ? 'data' : 'developer', capabilities: ['fixture']
    }));
    const result = await build({
      stdin: { contents: "import { mount } from 'svelte'; import Page from './src/routes/+page.svelte'; document.body.replaceChildren(); mount(Page, { target: document.body });", resolveDir: root, loader: 'js' },
      bundle: true, write: false, format: 'iife', platform: 'browser', conditions: ['browser'],
      mainFields: ['browser', 'module', 'main'], target: 'es2022',
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [{
        name: 'homepage-test-fixture',
        setup(builder) {
          builder.onResolve({ filter: /^\$lib\/registry\/tools$/ }, () => ({ path: 'catalog', namespace: 'fixture' }));
          builder.onResolve({ filter: /^\$app\/paths$/ }, () => ({ path: 'paths', namespace: 'fixture' }));
          builder.onResolve({ filter: /^\$app\/state$/ }, () => ({ path: 'state', namespace: 'fixture' }));
          builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({
            contents: path === 'paths' ? "export const base = '';" : path === 'state' ? "export const page = { url: new URL(location.href) };" : `export const tools = ${JSON.stringify(tools)}; export const categories = ['data', 'developer'];`
          }));
          builder.onResolve({ filter: /^\$lib\// }, (args) => builder.resolve(resolve(root, 'src/lib', args.path.slice(5)), { resolveDir: root, kind: args.kind }));
          builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => ({
            contents: compile(await readFile(path, 'utf8'), { filename: path, generate: 'client', css: 'injected' }).js.code,
            loader: 'js', resolveDir: dirname(path)
          }));
        }
      }]
    });
    return result.outputFiles[0].text;
  })();
}
