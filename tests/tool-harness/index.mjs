import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, transform } from 'esbuild';
import { compile, compileModule } from 'svelte/compiler';
import { languageCodes } from '../../src/lib/languages.js';
import { parseManifestBytes } from '../../scripts/lib/manifest.mjs';
import { MAX_BUNDLE_BYTES, verifyBundle } from '../../scripts/lib/bundle-artifact.mjs';
import { readLocalePacks } from '../../scripts/lib/locale-packs.mjs';

const hostRoot = fileURLToPath(new URL('../../', import.meta.url));
const publicRoot = resolve(hostRoot, 'static');
let compiled;

/**
 * @param {string} root
 * @param {string} path
 */
function inside(root, path) {
  const name = relative(root, path);
  return name !== '..' && !name.startsWith('..' + sep) && !isAbsolute(name);
}

/** Read only the owning repository's built artifact, never a catalog pin.
 * @param {string} toolRoot
 */
export async function readToolArtifact(toolRoot) {
  const root = await realpath(toolRoot);
  const tool = parseManifestBytes(await readFile(resolve(root, 'tool.manifest.json')));
  if (tool.schemaVersion !== 3 || tool.runtimeVersion !== 1 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tool.id ?? '') || typeof tool.bundle?.file !== 'string') {
    throw new Error('The tool harness requires a v3 manifest with a safe tool ID and HTML bundle.');
  }
  const candidate = resolve(root, tool.bundle.file);
  if (!inside(root, candidate)) throw new Error('Unsafe tool bundle path.');
  const path = await realpath(candidate);
  if (!inside(root, path)) throw new Error('Unsafe tool bundle symlink.');
  if (extname(path) !== '.html' || (await stat(path)).size > MAX_BUNDLE_BYTES) throw new Error('Invalid HTML bundle size or type.');
  const html = verifyBundle(await readFile(path), tool);
  const localePacks = await readLocalePacks(tool, async (file, maximum) => {
    const candidate = resolve(root, file);
    if (!inside(root, candidate)) throw new Error('Unsafe locale pack path.');
    const path = await realpath(candidate);
    if (!inside(root, path)) throw new Error('Unsafe locale pack symlink.');
    const info = await stat(path);
    if (!info.isFile() || extname(path) !== '.json' || info.size > maximum) throw new Error('Invalid locale pack file.');
    return readFile(path);
  });
  return { tool, html, localePacks };
}

/** Shared platform implementation only; no tool-specific UI or expectations. */
export function runtimeMountScript() {
  return compiled ??= build({
    stdin: {
      contents: `import { mount } from 'svelte';
        import Harness from './tests/tool-harness/LocaleHarness.svelte';
        async function boot() {
          const manifest = window.__toolTestTool ?? await (await fetch('/__test__/tool.json')).json();
          document.body.replaceChildren();
          mount(Harness, { target: document.body, props: { manifest, initialLocale: document.documentElement.lang } });
        }
        void boot();`,
      resolveDir: hostRoot
    },
    bundle: true, write: false, format: 'iife', platform: 'browser', conditions: ['browser'], mainFields: ['browser', 'module', 'main'],
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [{ name: 'tool-host-runtime', setup(builder) {
      builder.onResolve({ filter: /^\$app\/paths$/ }, () => ({ path: 'base', namespace: 'tool-host' }));
      builder.onLoad({ filter: /.*/, namespace: 'tool-host' }, () => ({ contents: "export const base = '';" }));
      builder.onResolve({ filter: /^\$lib\// }, args => builder.resolve(resolve(hostRoot, 'src/lib', args.path.slice(5)), { resolveDir: hostRoot, kind: args.kind }));
      builder.onLoad({ filter: /\.svelte\.ts$/ }, async ({ path }) => ({ contents: compileModule((await transform(await readFile(path, 'utf8'), { loader: 'ts' })).code, { filename: path, generate: 'client' }).js.code, loader: 'js', resolveDir: dirname(path) }));
      builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => ({ contents: compile(await readFile(path, 'utf8'), { filename: path, generate: 'client', css: 'injected' }).js.code, loader: 'js', resolveDir: dirname(path) }));
    } }]
  }).then(result => result.outputFiles[0].text);
}

/** Plain config avoids loading a second copy of Playwright from the host.
 * @param {{toolRoot: string, port?: number}} options
 */
export function toolHostConfig({ toolRoot, port = 4190 }) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid tool test port.');
  const baseURL = `http://127.0.0.1:${port}`;
  return {
    testDir: resolve(toolRoot, 'tests/host'), timeout: 45_000, workers: 1,
    use: { baseURL, serviceWorkers: 'block', launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : undefined },
    webServer: { command: 'node playwright.host.config.mjs --serve', cwd: toolRoot, url: `${baseURL}/__test__/health`, reuseExistingServer: false, timeout: 45_000 }
  };
}

/** Local test server: real host components, local tool bytes, no live services.
 * @param {{toolRoot: string, port?: number}} options
 */
export async function serveToolHost({ toolRoot, port = 4190 }) {
  toolHostConfig({ toolRoot, port });
  const { tool, html, localePacks } = await readToolArtifact(toolRoot);
  const [script, css, app] = await Promise.all([runtimeMountScript(), readFile(resolve(hostRoot, 'src/routes/app.css'), 'utf8'), readFile(resolve(hostRoot, 'src/app.html'), 'utf8')]);
  const head = app.match(/<head>([\s\S]*?)<\/head>/i)?.[1].replaceAll('%sveltekit.assets%', '').replace('%sveltekit.head%', '');
  if (!head || !/<meta\s+http-equiv="Content-Security-Policy"[^>]*>/i.test(head)) throw new Error('The host navigation CSP is missing.');
  const bundle = JSON.stringify({ id: tool.id, version: tool.version, sha256: tool.bundle.sha256, html });
  const route = tool.path || '/' + tool.id;
  const pages = new Map([['/', 'en']]);
  for (const locale of languageCodes) {
    let localizedRoute = route;
    if (locale !== 'en') localizedRoute = '/' + locale + route;
    pages.set(localizedRoute, locale);
    pages.set(localizedRoute + '/', locale);
  }
  /** @type {Record<string, string>} */
  const mime = { '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff' };
  const server = createServer(async (request, response) => {
    /**
     * @param {number} status
     * @param {string} type
     * @param {string | Uint8Array} body
     */
    const send = (status, type, body) => { response.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' }); response.end(body); };
    try {
      const path = new URL(request.url ?? '/', `http://127.0.0.1:${port}`).pathname;
      if (path === '/__test__/health') return send(200, 'text/plain', 'ready');
      if (path === '/__test__/runtime.js') return send(200, 'text/javascript; charset=utf-8', script);
      if (path === '/__test__/host.css') return send(200, 'text/css; charset=utf-8', css);
      if (path === '/__test__/tool.json') return send(200, 'application/json; charset=utf-8', JSON.stringify(tool));
      const pack = localePacks.get(path);
      if (pack) return send(200, 'application/json; charset=utf-8', pack);
      if (path === `/bundles/${tool.id}/${tool.bundle.sha256}.json`) return send(200, 'application/json; charset=utf-8', bundle);
      // Tests must mock protected endpoints; never proxy credentials or providers.
      if (path.startsWith('/api/')) return send(503, 'application/json', '{"error":"test-harness"}');
      if (/^\/(icons|fonts|brand)\//.test(path)) {
        const candidate = resolve(publicRoot, '.' + decodeURIComponent(path));
        if (!inside(publicRoot, candidate)) return send(404, 'text/plain', 'Not found');
        const file = await realpath(candidate);
        if (!inside(publicRoot, file)) return send(404, 'text/plain', 'Not found');
        return send(200, mime[extname(file)] ?? 'application/octet-stream', await readFile(file));
      }
      if (!pages.has(path)) return send(404, 'text/plain', 'Not found');
      const locale = pages.get(path);
      send(200, 'text/html; charset=utf-8', `<!doctype html><html lang="${locale}" dir="ltr" data-theme="light"><head>${head}<link rel="stylesheet" href="/__test__/host.css"><title>Tool runtime test harness</title></head><body><script src="/__test__/runtime.js"></script></body></html>`);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return send(404, 'text/plain', 'Not found');
      console.error('Tool host fixture failed:', error);
      send(500, 'text/plain', 'Tool host fixture failed');
    }
  });
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', () => { server.off('error', reject); accept(undefined); }); });
  console.log(`Tool host ready at http://127.0.0.1:${port}`);
  return server;
}
