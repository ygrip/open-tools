export const reservedIds = new Set(['policy', 'privacy', 'terms', 'bundles', 'icons', 'brand', 'illustrations', 'index', '404', '500', '503', '_app', 'offline', 'manifest', 'manifest-webmanifest', 'service-worker', 'pwa', 'id', 'og', 'robots', 'sitemap']);
export const permissionNames = new Set(['clipboard-read', 'clipboard-write', 'geolocation', 'downloads', 'external-assets', 'wasm', 'workers']);
export const iconNames = new Set(['braces', 'toolbox', 'grid', 'sparkles', 'bolt', 'heart', 'filter', 'lock', 'shield', 'search']);
export const MAX_ASSET_BYTES = 64 * 1024 * 1024;
export const MAX_TOTAL_ASSET_BYTES = 128 * 1024 * 1024;
const safeId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const digest = /^[a-f0-9]{64}$/;

/** @param {any} value @param {string} label */
function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`invalid ${label}`);
  return value;
}
/** @param {any} value @param {number} maximum @param {string} label */
function text(value, maximum, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error(`invalid ${label}`);
  return value.trim();
}
/** @param {any} value @param {number} maximum @param {number} length @param {string} label */
function texts(value, maximum, length, label) {
  if (!Array.isArray(value) || value.length > maximum) throw new Error(`invalid ${label}`);
  return value.map((item) => text(item, length, label));
}
/** @param {any} value */
function seo(value) {
  object(value, 'seo');
  if (!['index', 'noindex'].includes(value.robots)) throw new Error('invalid seo robots');
  return { title: text(value.title, 100, 'seo title'), description: text(value.description, 320, 'seo description'), keywords: texts(value.keywords, 10, 80, 'seo keywords'), robots: value.robots };
}
/** @param {any} value */
function guide(value) {
  object(value, 'guide');
  const steps = texts(value.steps, 12, 500, 'guide steps');
  if (!steps.length) throw new Error('guide requires at least one step');
  return { summary: text(value.summary, 500, 'guide summary'), steps };
}
/** Parse without echoing URLs, which may contain accidentally supplied secrets.
 * @param {any} value
 */
export function assetUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\s\\\u0000-\u001f\u007f]/.test(value)) throw new Error('invalid asset URL');
  let url;
  try { url = new URL(value); } catch { throw new Error('invalid asset URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || !url.hostname) throw new Error('asset URL must be credential-free HTTPS without a fragment');
  return url;
}

/** Validate untrusted metadata; return only public, contract-defined fields.
 * @param {any} manifest
 * @returns {import('./types').ToolManifest}
 */
export function validateManifest(manifest) {
  object(manifest, 'manifest');
  if (manifest.schemaVersion !== 2 && manifest.schemaVersion !== 3) throw new Error('unsupported schemaVersion: host theme contract v2 or v3 is required');
  if (manifest.appearance?.theme !== 'host' || manifest.appearance?.protocolVersion !== 1) throw new Error('bundle must declare host theme protocol v1');
  if (typeof manifest.id !== 'string' || !safeId.test(manifest.id) || manifest.id.length > 64 || reservedIds.has(manifest.id)) throw new Error('invalid or reserved id');
  if (manifest.path !== `/${manifest.id}`) throw new Error('path must exactly match /<id>');
  const name = text(manifest.name, 80, 'name');
  const description = text(manifest.description, 240, 'description');
  if (!['media', 'developer', 'data', 'productivity', 'other'].includes(manifest.category)) throw new Error('invalid category');
  if (!['stable', 'beta', 'experimental'].includes(manifest.status)) throw new Error('invalid status');
  if (typeof manifest.repository !== 'string' || !/^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(manifest.repository)) throw new Error('invalid repository');
  if (typeof manifest.version !== 'string' || manifest.version.length > 80 || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(manifest.version)) throw new Error('invalid version');
  const capabilities = texts(manifest.capabilities, 20, 80, 'capabilities');
  const bundle = manifest.bundle;
  if (!bundle || bundle.format !== 'html' || typeof bundle.file !== 'string' || !/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.html$/.test(bundle.file)) throw new Error('bundle must be a relative, self-contained HTML file');
  if (typeof bundle.sha256 !== 'string' || !digest.test(bundle.sha256)) throw new Error('invalid bundle sha256');

  const modern = manifest.schemaVersion === 3;
  if ((modern || manifest.runtimeVersion !== undefined) && manifest.runtimeVersion !== 1) throw new Error('unsupported runtimeVersion');
  const icon = manifest.icon ?? (modern ? undefined : 'toolbox');
  if (!iconNames.has(icon)) throw new Error('invalid tool icon');
  const toolSeo = seo(manifest.seo ?? (modern ? undefined : { title: name, description, keywords: [], robots: 'index' }));
  const toolGuide = guide(manifest.guide ?? (modern ? undefined : { summary: description, steps: ['Enter your input, choose an operation, and review the result.'] }));
  const permissionInput = manifest.permissions ?? (modern ? undefined : []);
  const assetInput = manifest.assets ?? (modern ? undefined : []);
  if (!Array.isArray(permissionInput) || permissionInput.length > permissionNames.size) throw new Error('invalid permissions');
  if (!Array.isArray(assetInput) || assetInput.length > 16) throw new Error('invalid assets');
  if (!modern && (permissionInput.length || assetInput.length)) throw new Error('permissions and external assets require schemaVersion 3');
  const grantedNames = new Set();
  const permissions = permissionInput.map((entry) => {
    object(entry, 'permission');
    if (!permissionNames.has(entry.name) || grantedNames.has(entry.name) || typeof entry.required !== 'boolean') throw new Error('invalid, duplicate or unsupported permission');
    grantedNames.add(entry.name);
    return { name: entry.name, reason: text(entry.reason, 240, 'permission reason'), required: entry.required };
  });
  const assetIds = new Set();
  let assetBytes = 0;
  const assets = assetInput.map((entry) => {
    object(entry, 'asset');
    if (typeof entry.id !== 'string' || !safeId.test(entry.id) || entry.id.length > 64 || assetIds.has(entry.id)) throw new Error('invalid or duplicate asset id');
    assetIds.add(entry.id);
    const url = assetUrl(entry.url).href;
    if (typeof entry.sha256 !== 'string' || !digest.test(entry.sha256)) throw new Error('invalid asset sha256');
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 1 || entry.bytes > MAX_ASSET_BYTES) throw new Error('invalid asset byte limit');
    assetBytes += entry.bytes;
    if (assetBytes > MAX_TOTAL_ASSET_BYTES) throw new Error('asset total exceeds 128 MiB');
    if (!['wasm', 'script', 'worker', 'data'].includes(entry.type) || typeof entry.defer !== 'boolean') throw new Error('invalid asset type or defer flag');
    if (!grantedNames.has('external-assets')) throw new Error('assets require external-assets permission');
    if (entry.type === 'wasm' && !grantedNames.has('wasm')) throw new Error('WASM assets require wasm permission');
    if (entry.type === 'worker' && !grantedNames.has('workers')) throw new Error('worker assets require workers permission');
    return { id: entry.id, url, sha256: entry.sha256, bytes: entry.bytes, type: entry.type, defer: entry.defer };
  });
  /** @type {import('./types').ToolManifest['translations']} */
  const translations = {};
  if (manifest.translations !== undefined) {
    object(manifest.translations, 'translations');
    for (const [locale, value] of Object.entries(manifest.translations)) {
      if (locale !== 'en' && locale !== 'id') throw new Error('unsupported translation locale');
      object(value, 'translation');
      translations[locale] = {
        name: text(value.name, 80, 'translated name'), description: text(value.description, 240, 'translated description'),
        ...(value.guide === undefined ? {} : { guide: guide(value.guide) }),
        ...(value.seo === undefined ? {} : { seo: seo(value.seo) })
      };
    }
  }
  const locales = manifest.locales ?? ['en'];
  if (!Array.isArray(locales) || !locales.length || locales.length > 2 || new Set(locales).size !== locales.length || locales.some((locale) => locale !== 'en' && locale !== 'id')) throw new Error('invalid supported tool locales');
  return {
    schemaVersion: manifest.schemaVersion, runtimeVersion: 1, locales: [...locales], appearance: { theme: 'host', protocolVersion: 1 },
    id: manifest.id, name, description, path: manifest.path, category: manifest.category, repository: manifest.repository,
    version: manifest.version, status: manifest.status, capabilities, icon, seo: toolSeo, guide: toolGuide, permissions, assets, translations,
    bundle: { format: 'html', file: bundle.file, sha256: bundle.sha256 }
  };
}

/** Every published origin requires independent host-registry approval.
 * @param {import('./types').ToolManifest} manifest
 * @param {any} configuredOrigins
 */
export function validateAssetOrigins(manifest, configuredOrigins = []) {
  if (!Array.isArray(configuredOrigins) || configuredOrigins.length > 64) throw new Error('invalid trustedAssetOrigins');
  const origins = new Set(configuredOrigins.map((origin) => {
    const parsed = assetUrl(origin);
    if (parsed.origin !== origin) throw new Error('trustedAssetOrigins entries must be exact HTTPS origins');
    return parsed.origin;
  }));
  for (const asset of manifest.assets) {
    if (!origins.has(assetUrl(asset.url).origin)) throw new Error('asset origin is not approved in trustedAssetOrigins');
  }
}
