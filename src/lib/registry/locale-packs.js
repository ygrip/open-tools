export const MAX_LOCALE_PACK_BYTES = 65_536;

/** @param {string} id @param {string} sha256 */
export function localePackPath(id, sha256) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error('invalid hosted locale pack identity');
  }
  return `/bundles/${id}/locales/${sha256}.json`;
}
