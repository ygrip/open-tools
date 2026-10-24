/** @param {URL} url @param {string} base */
export function appPath(url, base = '') {
  return base ? (url.pathname.startsWith(`${base}/`) ? url.pathname.slice(base.length) : '') : url.pathname;
}
/** @param {URL} url @param {string} base */
export function bundlePath(url, base = '') { return /^\/bundles\/[a-z0-9-]+\/[a-f0-9]{64}\.json$/.test(appPath(url, base)); }
/** Only these resources can safely be shared across app releases. @param {URL} url @param {string} base */
export function immutablePath(url, base = '') {
  const path = appPath(url, base);
  return /^\/_app\/immutable\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:js|css|woff2?|png|svg|webp|avif)$/.test(path) ||
    /^\/bundles\/[a-z0-9]+(?:-[a-z0-9]+)*\/locales\/[a-f0-9]{64}\.json$/.test(path);
}
/** Version discovery must never be answered from a release-pinned offline cache. @param {URL} url @param {string} base */
export function mutableReleasePath(url, base = '') {
  const path = appPath(url, base);
  return path === '/_app/version.json' || path === '/service-worker.js';
}
/** @param {URL} url @param {string} origin @param {Set<string>} publicPaths @param {string} method @param {boolean} authorization @param {string} base */
export function cacheableRequest(url, origin, publicPaths, method = 'GET', authorization = false, base = '') {
  const bundle = bundlePath(url, base);
  const version = url.searchParams.get('version');
  const versionedBundle = bundle && url.searchParams.size === 1 && version !== null && /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version);
  return method === 'GET' && !authorization && url.origin === origin && !mutableReleasePath(url, base) &&
    ((!url.search && (publicPaths.has(url.pathname) || bundle || immutablePath(url, base))) || versionedBundle);
}
/** @param {Response} response */
export function cacheableResponse(response) {
  const varies = (response.headers.get('vary') || '').split(',').map((name) => name.trim().toLowerCase()).filter(Boolean);
  return response.status === 200 && response.type !== 'opaque' && !/no-store|private/i.test(response.headers.get('cache-control') || '') && varies.every((name) => name === 'accept-encoding') && !response.headers.has('set-cookie');
}
