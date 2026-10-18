import { isTheme, type Theme } from '../theme';
import { uiKitScript, uiKitStyles } from './ui-kit';

// The policy precedes tool markup and cannot be relaxed by a later meta tag.
// Opaque-origin sandboxing is also mandatory: never add allow-same-origin.
export const bundlePolicy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src data:; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'";

export const themeMessageType = 'open-tools:theme';

/** Host-owned defaults are available even before a bundle's own styles are parsed. */
const themeStyles = `
:root {
  color-scheme: light !important;
  --ot-bg: #fff8f0 !important;
  --ot-surface: #fffdf9 !important;
  --ot-text: #392f2c !important;
  --ot-muted: #71615a !important;
  --ot-border: #e7d8cc !important;
  --ot-accent: #f7a174 !important;
  --ot-on-accent: #42291e !important;
  --ot-shadow: rgba(62, 36, 20, 0.12) !important;
  --ot-highlight: rgba(255, 255, 255, 0.92) !important;
}
:root[data-theme="dark"] {
  color-scheme: dark !important;
  --ot-bg: #242127 !important;
  --ot-surface: #312c34 !important;
  --ot-text: #fff5eb !important;
  --ot-muted: #cbbab3 !important;
  --ot-border: #514650 !important;
  --ot-accent: #ffb18b !important;
  --ot-on-accent: #3e251d !important;
  --ot-shadow: rgba(0, 0, 0, 0.35) !important;
  --ot-highlight: rgba(255, 255, 255, 0.075) !important;
}
html, body { background-color: var(--ot-bg) !important; color: var(--ot-text) !important; }
/* Overridable safety net: long URLs, hashes and tokens wrap instead of widening the tool. */
body { overflow-wrap: anywhere; }
img, video { max-width: 100%; }
`;

// This runs before bundle scripts. Opaque frames have a "null" origin, so source
// identity—not event.origin—is the boundary. No reply or user data leaves the frame.
const themeBootstrap = `
(() => {
  addEventListener('message', (event) => {
    if (event.source !== parent) return;
    const message = event.data;
    if (!message || typeof message !== 'object' ||
        message.type !== '${themeMessageType}' || message.version !== 1 ||
        (message.theme !== 'light' && message.theme !== 'dark')) return;
    document.documentElement.dataset.theme = message.theme;
    document.documentElement.style.colorScheme = message.theme;
  });
})();
`;

export type RuntimeOptions = { locale?: string; token?: string; permissions?: readonly string[]; scriptAssets?: boolean };

export function sandboxDocument(html: string, initialTheme: Theme = 'light', options: RuntimeOptions = {}): string {
  const theme = isTheme(initialTheme) ? initialTheme : 'light';
  const locale = options.locale === 'id' ? 'id' : 'en';
  const permissions = options.permissions ?? [];
  let policy = bundlePolicy;
  if (permissions.includes('wasm')) policy = policy.replace("script-src 'unsafe-inline'", "script-src 'unsafe-inline' 'wasm-unsafe-eval'");
  if (permissions.includes('workers')) policy = policy.replace("worker-src 'none'", 'worker-src blob:');
  if (permissions.includes('workers') || (permissions.includes('external-assets') && options.scriptAssets)) policy = policy.replace("script-src 'unsafe-inline'", "script-src 'unsafe-inline' blob:");
  const token = /^[a-zA-Z0-9_-]{16,128}$/.test(options.token ?? '') ? options.token! : '';
  const config = JSON.stringify({ token, permissions: permissions.filter((name) => ['clipboard-read', 'clipboard-write', 'geolocation', 'downloads', 'camera-capture', 'share-image', 'external-assets', 'wasm', 'workers', 'services'].includes(name)) }).replaceAll('<', '\\u003c');
  const sdk = `(() => {
    const config = ${config};
    const pending = new Map(); let sequence = 0;
    addEventListener('message', event => {
      if (event.source !== parent) return;
      const data = event.data;
      if (data?.type === 'trick-it:locale' && data.version === 1 && (data.locale === 'en' || data.locale === 'id') && data.locale !== document.documentElement.lang) {
        document.documentElement.lang = data.locale;
        dispatchEvent(new CustomEvent('trick-it:localechange', { detail: { locale: data.locale } }));
      }
      if (!config.token || data?.type !== 'trick-it:response' || data.version !== 1 || data.token !== config.token || typeof data.id !== 'string') return;
      const request = pending.get(data.id); if (!request) return;
      pending.delete(data.id); clearTimeout(request.timer);
      if (data.ok === true) request.resolve(data.value); else request.reject(Object.assign(new Error('The requested capability was denied or could not complete.'), { code: typeof data.error === 'string' ? data.error : 'request' }));
    });
    function request(operation, payload) {
      const hostUi = operation === 'ui-toast' || operation === 'ui-dialog';
      if (!config.token || (!hostUi && operation !== 'asset' && !config.permissions.includes(operation)) || (operation === 'asset' && !config.permissions.includes('external-assets'))) return Promise.reject(new Error('Permission not granted.'));
      if (pending.size >= 16) return Promise.reject(new Error('Too many pending requests.'));
      const id = String(++sequence);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('Capability request timed out.')); }, 330000);
        pending.set(id, { resolve, reject, timer });
        try { parent.postMessage({ type: 'trick-it:request', version: 1, token: config.token, id, operation, payload }, '*'); }
        catch { clearTimeout(timer); pending.delete(id); reject(new Error('Invalid capability payload.')); }
      });
    }
${uiKitScript}
    Object.defineProperty(window, 'trickIt', { value: Object.freeze({ version: 1, request, ui, asset: id => request('asset', { id }), get locale() { return document.documentElement.lang; }, permissions: Object.freeze(config.permissions) }), configurable: false });
  })();`;
  // The parent cannot measure an opaque sandbox. Send only the height of the
  // tool's rendered document, never DOM/content, through the session channel.
  const resizeBootstrap = `
(() => {
  const token = ${JSON.stringify(token)};
  if (!token) return;
  let scheduled = false, lastHeight = -1;
  function measure() {
    scheduled = false;
    const body = document.body, root = document.documentElement;
    if (!body || !root) return;
    const rect = body.getBoundingClientRect();
    const margin = Math.max(0, parseFloat(getComputedStyle(body).marginBottom) || 0);
    // Unlike root.scrollHeight, body content can shrink when the frame is tall.
    // Consider root overflow only when it actually extends past the viewport.
    const overflow = root.scrollHeight > innerHeight + 1 ? root.scrollHeight : 0;
    const height = Math.ceil(Math.max(rect.bottom + margin, body.scrollHeight + Math.max(0, rect.top) + margin, overflow));
    if (!Number.isSafeInteger(height) || height < 0 || height > 100000 || Math.abs(height - lastHeight) < 2) return;
    lastHeight = height;
    parent.postMessage({ type: 'trick-it:resize', version: 1, token, height }, '*');
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(measure);
  }
  function start() {
    if (!document.body) return;
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(schedule);
      observer.observe(document.body);
      observer.observe(document.documentElement);
    }
    new MutationObserver(schedule).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    addEventListener('resize', schedule);
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
`;
  return `<!doctype html><html lang="${locale}" data-theme="${theme}" style="color-scheme:${theme}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${themeStyles}${uiKitStyles}</style><script>${themeBootstrap}${sdk}</script><script>${resizeBootstrap}</script></head><body>${html}</body></html>`;
}
