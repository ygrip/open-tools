import { precachePath } from './precache.js';

/**
 * A deployment's public files are not all suitable for installation-time
 * downloads. Cloudflare consumes _headers/_redirects instead of serving them,
 * and eagerly downloading every illustration slows down or breaks PWA setup.
 *
 * @param {string[]} build
 * @param {string[]} files
 * @param {string[]} prerendered
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
  // Route HTML and application chunks are small, release-specific offline shell.
  // Other public assets are cached on first use rather than during install.
  const coreStatic = staticFiles.filter((path) =>
    /\/(?:manifest\.webmanifest|favicon\.[^/]+)$/.test(path) ||
    path.startsWith(`${base}/brand/`) ||
    path.startsWith(`${base}/pwa/`)
  );
  const precachePaths = new Set([...build, ...prerendered, ...coreStatic]);
  const requiredPaths = new Set([...build, `${base}/`, `${base}/offline/`]);
  return { publicPaths, precachePaths, requiredPaths };
}
