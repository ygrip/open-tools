import { precachePath } from './precache.js';

/**
 * Keep installation bounded to the runnable offline shell. Tool pages, legal
 * pages, illustrations and app icons remain eligible for caching on first
 * visit, but are never a prerequisite for activating an update.
 *
 * @param {string[]} build Content-hashed app assets from SvelteKit
 * @param {string[]} files Public static files
 * @param {string[]} prerendered Prerendered route URLs
 * @param {string} base
 */
export function makePrecachePlan(build, files, prerendered, base = '') {
  const staticFiles = files.map(precachePath).filter((path) =>
    !/\/(?:_headers|_redirects)$/.test(path) &&
    !path.includes('/bundles/') &&
    !path.includes('/og/') &&
    !/\/(?:robots\.txt|sitemap\.xml)$/.test(path) &&
    !/\/(?:404|500|503)\.html$/.test(path)
  );
  const publicPaths = new Set([...build, ...staticFiles, ...prerendered]);
  // Cache both landing-page locales and the generic offline fallback.
  // Retain all build chunks so already-opened tools remain runnable offline
  // even if their shell imports lazy chunks later.
  const requiredPaths = new Set([...build, `${base}/`, `${base}/id/`, `${base}/offline/`]);
  const precachePaths = new Set(requiredPaths);
  return { publicPaths, precachePaths, requiredPaths };
}

/**
 * Limit concurrent fetch + CacheStorage writes, and let in-flight operations
 * settle before reporting an error so a failed install cannot repopulate a
 * shell cache after it has been deleted.
 *
 * @template T
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T) => Promise<void>} task
 */
export async function runBounded(items, concurrency, task) {
  let next = 0;
  let firstFailure;
  const worker = async () => {
    while (!firstFailure && next < items.length) {
      const item = items[next++];
      try { await task(item); }
      catch (error) { firstFailure ??= error; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(items.length, Math.max(1, Math.floor(concurrency) || 1)) }, worker));
  if (firstFailure) throw firstFailure;
}
