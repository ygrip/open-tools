import { validateManifest } from '../../src/lib/registry/contract.js';

/** Parse the exact same metadata bytes for registry sync and tool-owned tests.
 * @param {Uint8Array} bytes
 */
export function parseManifestBytes(bytes) {
  if (bytes.byteLength > 64 * 1024) throw new Error('manifest exceeds 64 KiB');
  const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  return validateManifest(JSON.parse(source));
}
