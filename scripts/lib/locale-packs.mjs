import { createHash } from 'node:crypto';
import { MAX_LOCALE_PACK_BYTES, localePackPath } from '../../src/lib/registry/locale-packs.js';

/** Verify tool-owned copy before it becomes a public deployment asset.
 * @param {Uint8Array} bytes
 * @param {{sha256: string, bytes: number}} descriptor
 */
export function verifyLocalePack(bytes, descriptor) {
  if (!bytes.length || bytes.length > MAX_LOCALE_PACK_BYTES || bytes.length !== descriptor.bytes) {
    throw new Error('locale pack size mismatch');
  }
  if (createHash('sha256').update(bytes).digest('hex') !== descriptor.sha256) {
    throw new Error('locale pack integrity mismatch');
  }
  const copy = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!copy || typeof copy !== 'object' || Array.isArray(copy) || !Object.keys(copy).length ||
      Object.values(copy).some(value => typeof value !== 'string' || !value.trim())) {
    throw new Error('locale pack must contain nonblank string messages');
  }
  return bytes;
}

/** Load files only from the already pinned, authenticated source reader.
 * @param {Pick<import('../../src/lib/registry/types').ToolManifest, 'id' | 'localePacks'>} manifest
 * @param {(file: string, maximum: number) => Promise<Uint8Array>} read
 */
export async function readLocalePacks(manifest, read) {
  /** @type {Map<string, Uint8Array>} */
  const packs = new Map();
  for (const descriptor of Object.values(manifest.localePacks ?? {})) {
    if (!descriptor.file) continue; // Existing external URL packs remain supported.
    const path = localePackPath(manifest.id, descriptor.sha256);
    const cached = packs.get(path);
    if (cached) {
      verifyLocalePack(cached, descriptor);
      continue;
    }
    const bytes = await read(descriptor.file, MAX_LOCALE_PACK_BYTES);
    packs.set(path, verifyLocalePack(bytes, descriptor));
  }
  return packs;
}
