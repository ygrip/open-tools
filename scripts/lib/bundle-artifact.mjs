import { createHash } from 'node:crypto';

export const MAX_BUNDLE_BYTES = 5 * 1024 * 1024;

/**
 * @param {Uint8Array} bytes
 * @param {{bundle: {sha256: string}}} manifest
 */
export function verifyBundle(bytes, manifest) {
  if (!bytes.length || bytes.length > MAX_BUNDLE_BYTES) throw new Error('bundle size must be 1 byte to 5 MiB');
  if (createHash('sha256').update(bytes).digest('hex') !== manifest.bundle.sha256) throw new Error('bundle integrity mismatch');
  const html = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  if (!/<!doctype html/i.test(html)) throw new Error('bundle must be an HTML document');
  return html;
}
