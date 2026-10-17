export const reservedIds = new Set(['policy', 'privacy', 'terms', 'bundles', 'icons', 'brand', 'illustrations', 'index', '404', '500', '503', '_app']);

/** Validate untrusted metadata; return only public, contract-defined fields.
 * @param {any} manifest
 * @returns {import('./types').ToolManifest}
 */
export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('manifest must be an object');
  if (manifest.schemaVersion !== 2) throw new Error('unsupported schemaVersion: host theme contract v2 is required');
  if (manifest.appearance?.theme !== 'host' || manifest.appearance?.protocolVersion !== 1) throw new Error('bundle must declare host theme protocol v1');
  if (typeof manifest.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.id) || manifest.id.length > 64 || reservedIds.has(manifest.id)) throw new Error('invalid or reserved id');
  if (manifest.path !== `/${manifest.id}`) throw new Error('path must exactly match /<id>');
  /** @type {[string, number][]} */
  const textFields = [['name', 80], ['description', 240]];
  for (const [field, max] of textFields) {
    if (typeof manifest[field] !== 'string' || !manifest[field].trim() || manifest[field].length > max) throw new Error(`invalid ${field}`);
  }
  if (!['media', 'developer', 'data', 'productivity', 'other'].includes(manifest.category)) throw new Error('invalid category');
  if (!['stable', 'beta', 'experimental'].includes(manifest.status)) throw new Error('invalid status');
  if (typeof manifest.repository !== 'string' || !/^https:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(manifest.repository)) throw new Error('invalid repository');
  if (typeof manifest.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(manifest.version)) throw new Error('invalid version');
  if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length > 20 || manifest.capabilities.some((/** @type {unknown} */ item) => typeof item !== 'string' || !item.trim() || item.length > 80)) throw new Error('invalid capabilities');
  const bundle = manifest.bundle;
  if (!bundle || bundle.format !== 'html' || typeof bundle.file !== 'string' || !/^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.html$/.test(bundle.file)) throw new Error('bundle must be a relative, self-contained HTML file');
  if (typeof bundle.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(bundle.sha256)) throw new Error('invalid bundle sha256');
  return {
    schemaVersion: 2, appearance: { theme: 'host', protocolVersion: 1 }, id: manifest.id, name: manifest.name.trim(), description: manifest.description.trim(),
    path: manifest.path, category: manifest.category, repository: manifest.repository,
    version: manifest.version, status: manifest.status, capabilities: [...manifest.capabilities],
    bundle: { format: 'html', file: bundle.file, sha256: bundle.sha256 }
  };
}
