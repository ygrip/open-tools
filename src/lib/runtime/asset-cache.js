/**
 * Local, best-effort quota management for SHA-verified model and WASM caches.
 * Never touches shell/bundle caches or the active tool release.
 */
const PREFIX = 'trick-it-assets-';
const KEY = 'trick-it:asset-cache-usage:v1';
const DEFAULT_BUDGET = 192 * 1024 * 1024;
const GRACE_MS = 30 * 60 * 1000;
const MAX_UNKNOWN_BYTES = 64 * 1024 * 1024;
const recent = new Map();

/** @param {Storage | null | undefined} storage */
function metadata(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}
/** @param {Record<string, number>} data @param {Storage | null | undefined} storage */
function save(data, storage) {
  try { storage?.setItem(KEY, JSON.stringify(data)); } catch { /* Private browsing */ }
}
function localStore() {
  try { return globalThis.localStorage; } catch { return undefined; }
}

/** @param {string} name @param {number} now @param {Storage | null | undefined} storage */
export function touchAssetCache(name, now = Date.now(), storage = localStore()) {
  if (!name.startsWith(PREFIX)) return;
  recent.set(name, now);
  const data = metadata(storage);
  data[name] = now;
  save(data, storage);
}

/**
 * Evict old release caches, never active or recently used ones.
 * Header-only byte accounting avoids reading multi-megabyte model bodies.
 * Legacy entries with no byte header are conservatively counted at 64 MiB.
 */
/**
 * @param {CacheStorage} cacheStorage
 * @param {string} active
 * @param {{ now?: number, metadataStore?: Storage | null, budgetBytes?: number, estimate?: { quota?: number, usage?: number } }} options
 */
export async function pruneAssetCaches(cacheStorage, active, options = {}) {
  const now = options.now ?? Date.now();
  const store = options.metadataStore === undefined ? localStore() : options.metadataStore;
  const budget = options.budgetBytes ?? DEFAULT_BUDGET;
  let limit = budget;
  try {
    const estimate = options.estimate || (globalThis.navigator?.storage?.estimate ? await globalThis.navigator.storage.estimate() : undefined);
    if (estimate?.quota > 0) {
      limit = Math.min(limit, Math.floor(estimate.quota * ((estimate.usage ?? 0) / estimate.quota > .75 ? .10 : .20)));
    }
  } catch { /* Storage estimates are advisory. */ }

  const all = await cacheStorage.keys();
  const names = all.filter(name => name.startsWith(PREFIX));
  if (!names.length) return { deleted: [], bytes: 0 };
  const data = metadata(store);
  const items = [];
  for (const name of names) {
    const cache = await cacheStorage.open(name);
    const requests = await cache.keys();
    let bytes = 0;
    for (const request of requests) {
      const response = await cache.match(request);
      if (!response) continue;
      const declared = Number(response.headers.get('x-trick-it-asset-bytes'));
      bytes += Number.isSafeInteger(declared) && declared > 0 && declared <= MAX_UNKNOWN_BYTES ? declared : MAX_UNKNOWN_BYTES;
    }
    items.push({ name, bytes, last: Math.max(Number(data[name]) || 0, recent.get(name) || 0) });
  }
  let total = items.reduce((sum, item) => sum + item.bytes, 0);
  const deleted = [];
  for (const item of items.sort((a, b) => a.last - b.last)) {
    if (total <= limit) break;
    if (item.name === active || now - item.last < GRACE_MS) continue;
    if (await cacheStorage.delete(item.name)) {
      total -= item.bytes;
      deleted.push(item.name);
      delete data[item.name];
      recent.delete(item.name);
    }
  }
  for (const name of Object.keys(data)) if (name.startsWith(PREFIX) && !names.includes(name)) delete data[name];
  save(data, store);
  return { deleted, bytes: total, limit };
}
