/** Static `dir/index.html` files are served at `dir/`; the `.html` URL redirects, and redirects cannot be precached. @param {string} path */
export function precachePath(path) {
  return path.replace(/(^|\/)index\.html$/, '$1') || '/';
}
