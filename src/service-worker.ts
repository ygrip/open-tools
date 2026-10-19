/// <reference lib="webworker" />
import { build, files, prerendered, version, base } from '$service-worker';
import { makePrecachePlan } from './lib/pwa-precache.js';
import { cacheableRequest, cacheableResponse, bundlePath, immutablePath } from './lib/pwa-policy.js';

declare const self: ServiceWorkerGlobalScope;
const prefix = 'trick-it-shell-';
const name = `${prefix}${version}`;
const bundleCache = 'trick-it-bundles-v1';
const { publicPaths, precachePaths, requiredPaths } = makePrecachePlan(build, files, prerendered, base);
const offline = `${base}/offline/`;
const clientVersions = new Map<string, string>();

async function warnCache(detail?: { url: string; reason: string }) {
  for (const client of await self.clients.matchAll()) client.postMessage({ type: 'trick-it:cache-failed', ...detail });
}
// Names the asset that broke offline setup; the browser's own error never says which URL it was.
async function precache(cache: Cache, path: string, required = false) {
  try {
    const response = await fetch(path, { cache: 'reload', credentials: 'omit', redirect: 'error' });
    if (!cacheableResponse(response)) throw new Error(`HTTP ${response.status} (${response.type}); resource is not publicly cacheable`);
    await cache.put(path, response);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (!required) {
      // Optional pages/icons are best-effort: never invalidate the whole install.
      console.warn(`[trick-it sw] optional offline asset unavailable: ${path} — ${reason}`);
      return;
    }
    console.error(`[trick-it sw] essential offline asset failed: ${path} — ${reason}`);
    await warnCache({ url: path, reason });
    throw new Error(`Essential precache failed for ${path}: ${reason}`, { cause: error });
  }
}
async function cleanUnusedShells() {
  const clients = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).filter((client) => new URL(client.url).origin === self.location.origin);
  if (clients.some((client) => !clientVersions.has(client.id))) {
    for (const client of clients) if (!clientVersions.has(client.id)) client.postMessage({ type: 'trick-it:version-request' });
    return;
  }
  const retained = new Set([name, ...clients.map((client) => `${prefix}${clientVersions.get(client.id)}`)]);
  for (const key of await caches.keys()) if (key.startsWith(prefix) && !retained.has(key)) await caches.delete(key);
  for (const id of clientVersions.keys()) if (!clients.some((client) => client.id === id)) clientVersions.delete(id);
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(name);
    try {
      // Finish only when the runnable shell is present; a missing image or one
      // prerendered tool page must never leave the PWA stuck installing.
      for (const path of requiredPaths) await precache(cache, path, true);
      const optional = [...precachePaths].filter((path) => !requiredPaths.has(path));
      for (let i = 0; i < optional.length; i += 6) {
        await Promise.all(optional.slice(i, i + 6).map((path) => precache(cache, path)));
      }
    } catch (error) { await caches.delete(name); throw error; }
  })());
});

// A new worker waits. Neither activation nor a deployment reloads a running tool.
self.addEventListener('message', (event) => {
  const source = event.source;
  if (!source || !('url' in source) || !('id' in source) || new URL(source.url).origin !== self.location.origin) return;
  if (event.data?.type === 'trick-it:client-ready' && typeof event.data.appVersion === 'string' && /^[a-zA-Z0-9._-]{1,100}$/.test(event.data.appVersion)) {
    clientVersions.set(source.id, event.data.appVersion);
    event.waitUntil(cleanUnusedShells());
  }
  if (event.data?.type !== 'trick-it:activate' || event.data.version !== 1) return;
  event.waitUntil(self.clients.get(source.id).then((client) => client ? self.skipWaiting() : undefined));
});
self.addEventListener('activate', (event) => { event.waitUntil(cleanUnusedShells()); });

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('authorization')) return;
  const navigation = request.mode === 'navigate';
  const allowed = cacheableRequest(url, self.location.origin, publicPaths, request.method, false, base);
  if (!navigation && !allowed) return;
  event.respondWith((async () => {
    let cache: Cache | undefined;
    let cached: Response | undefined;
    try {
      cache = await caches.open(bundlePath(url, base) ? bundleCache : name);
      cached = allowed ? await cache.match(request) : undefined;
      if (!cached && immutablePath(url, base)) {
        for (const key of await caches.keys()) if (key.startsWith(prefix)) {
          cached = await (await caches.open(key)).match(request);
          if (cached) break;
        }
      }
    } catch { await warnCache(); }
    // Fixed shell/data belongs to this release, not a newer deployment waiting
    // for approval. Content-addressed bundles still revalidate their envelope.
    if (cached && !bundlePath(url, base)) return cached;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), navigation ? 4000 : 30_000);
    try {
      const response = await fetch(request, { signal: controller.signal });
      if (cache && !navigation && allowed && cacheableResponse(response)) {
        const target = cache;
        event.waitUntil((async () => {
          try {
            await target.put(request, response.clone());
            if (bundlePath(url, base)) {
              const keys = await target.keys();
              for (const key of keys.slice(0, Math.max(0, keys.length - 32))) await target.delete(key);
            }
          } catch { await warnCache(); }
        })());
      }
      return response;
    } catch {
      if (cached) return cached;
      if (navigation) {
        const fallback = await cache?.match(offline);
        const safeBase = base.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
        const html = fallback ? (await fallback.text()).replaceAll('href="../"', `href="${safeBase}/"`).replaceAll('href="../id/"', `href="${safeBase}/id/"`) : 'Offline. Open trick-it online first.';
        return new Response(html, { status: 503, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
      }
      return new Response('Offline resource unavailable', { status: 503, headers: { 'cache-control': 'no-store' } });
    } finally { clearTimeout(timeout); }
  })());
});
