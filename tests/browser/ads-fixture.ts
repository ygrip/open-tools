import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { compile } from 'svelte/compiler';
import { validateAdsConfig } from '../../src/lib/ads/config.js';

declare global {
  interface Window {
    __adRequests?: string[];
    __remountAd: () => Promise<void>;
    __hideToolAd: (kind: 'display' | 'visibility' | 'opacity') => void;
    __showToolAd: () => void;
    __removeToolAd: () => Promise<void>;
  }
}

const root = fileURLToPath(new URL('../../', import.meta.url));

/** Compile real components with test-only configuration, never enable production ads. */
export async function adsFixtureScript(overrides: Record<string, unknown> = {}) {
  const config = validateAdsConfig({
    enabled: true, client: 'ca-pub-1234567890123456', testMode: true,
    placements: { home: '1234567890', tool: '0987654321' },
    frameOrigins: ['https://googleads.g.doubleclick.net'], ...overrides
  });
  const result = await build({
    stdin: {
      contents: `import { mount, unmount } from 'svelte';
        import AdSlot from './src/lib/components/AdSlot.svelte';
        const home = document.createElement('div'), tool = document.createElement('div');
        document.body.append(home, tool);
        mount(AdSlot, { target: home, props: { placement: 'home' } });
        let current = mount(AdSlot, { target: tool, props: { placement: 'tool' } });
        window.__remountAd = async () => { await unmount(current); current = mount(AdSlot, { target: tool, props: { placement: 'tool' } }); };
        window.__hideToolAd = (kind) => {
          if (kind === 'display') tool.style.display = 'none';
          if (kind === 'visibility') tool.style.visibility = 'hidden';
          if (kind === 'opacity') tool.style.opacity = '0';
        };
        window.__showToolAd = () => { tool.style.display = ''; tool.style.visibility = ''; tool.style.opacity = ''; };
        window.__removeToolAd = () => unmount(current);`,
      resolveDir: root
    },
    bundle: true, write: false, format: 'iife', platform: 'browser', conditions: ['browser'],
    mainFields: ['browser', 'module', 'main'], define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'ads-fixture', setup(builder) {
      builder.onResolve({ filter: /^\$lib\/ads\/settings\.js$/ }, () => ({ path: 'config', namespace: 'ads-fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'ads-fixture' }, () => ({ contents: `export const adsConfig = ${JSON.stringify(config)};` }));
      builder.onResolve({ filter: /^\$lib\// }, args => builder.resolve(resolve(root, 'src/lib', args.path.slice(5)), { resolveDir: root, kind: args.kind }));
      builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => ({
        contents: compile(await readFile(path, 'utf8'), { filename: path, generate: 'client', css: 'injected' }).js.code,
        loader: 'js', resolveDir: dirname(path)
      }));
    } }]
  });
  return result.outputFiles[0].text;
}
