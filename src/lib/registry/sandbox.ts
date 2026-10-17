// The policy precedes tool markup and cannot be relaxed by a later meta tag.
// Opaque-origin sandboxing is also mandatory: never add allow-same-origin.
export const bundlePolicy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src data:; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'";

export function sandboxDocument(html: string): string {
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${bundlePolicy}"><meta name="referrer" content="no-referrer"></head><body>${html}</body></html>`;
}
