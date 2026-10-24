import { isTheme, type Theme } from '../theme';
import { uiKitScript, uiKitStyles } from './ui-kit';
import { tableScript, tableStyles } from './ui-table';
import { codeBlockScript, codeBlockStyles } from './ui-code-block';
import { highlightRuntime } from './highlight-runtime';
import { DOWNLOAD_LIMITS } from '../runtime/download-policy';
import { TOOL_ZOOM } from '../runtime/tool-zoom';
import { languageCodes, isSupportedLanguage } from '../languages.js';

// The policy precedes tool markup and cannot be relaxed by a later meta tag.
// Opaque-origin sandboxing is also mandatory: never add allow-same-origin.
export const bundlePolicy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; font-src data:; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'";

export const themeMessageType = 'open-tools:theme';
export const zoomMessageType = 'trick-it:zoom';

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
/* Document height follows content, never the iframe viewport being measured. */
html, body { height: auto !important; min-height: 0 !important; background-color: var(--ot-bg) !important; color: var(--ot-text) !important; }
/* Overridable safety net: long URLs, hashes and tokens wrap instead of widening the tool. */
html { overscroll-behavior-x: contain; }
body { overflow-wrap: anywhere; zoom: var(--ot-host-tool-zoom, 1) !important; }
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

export type RuntimeOptions = { locale?: string; token?: string; permissions?: readonly string[]; scriptAssets?: boolean; nativeDownloads?: boolean; zoomPercent?: number; viewportHeight?: number };

export function sandboxDocument(html: string, initialTheme: Theme = 'light', options: RuntimeOptions = {}): string {
  const theme = isTheme(initialTheme) ? initialTheme : 'light';
  let locale = 'en';
  if (options.locale && isSupportedLanguage(options.locale)) locale = options.locale;
  const initialZoom = Number.isInteger(options.zoomPercent) && (options.zoomPercent ?? 0) >= TOOL_ZOOM.min && (options.zoomPercent ?? 0) <= TOOL_ZOOM.max ? options.zoomPercent! : TOOL_ZOOM.default;
  const viewportHeight = Number.isSafeInteger(options.viewportHeight) && options.viewportHeight! > 0 && options.viewportHeight! <= 100000 ? options.viewportHeight! : 280;
  const permissions = options.permissions ?? [];
  let policy = bundlePolicy;
  if (permissions.includes('wasm')) policy = policy.replace("script-src 'unsafe-inline'", "script-src 'unsafe-inline' 'wasm-unsafe-eval'");
  if (permissions.includes('workers')) policy = policy.replace("worker-src 'none'", 'worker-src blob:');
  if (permissions.includes('workers') || (permissions.includes('external-assets') && options.scriptAssets)) policy = policy.replace("script-src 'unsafe-inline'", "script-src 'unsafe-inline' blob:");
  const token = /^[a-zA-Z0-9_-]{16,128}$/.test(options.token ?? '') ? options.token! : '';
  const config = JSON.stringify({ token, permissions: permissions.filter((name) => ['clipboard-read', 'clipboard-write', 'geolocation', 'downloads', 'camera-capture', 'share-image', 'external-assets', 'wasm', 'workers', 'services', 'wiki-read', 'dns-query'].includes(name)) }).replaceAll('<', '\\u003c');
  const sdk = `(() => {
    const config = ${config};
    const supportedLocales = ${JSON.stringify(languageCodes)};
    const downloadLimits = Object.freeze(${JSON.stringify({ ...DOWNLOAD_LIMITS, maxBytes: options.nativeDownloads ? DOWNLOAD_LIMITS.maxBytes : DOWNLOAD_LIMITS.bufferedMaxBytes })});
    const pending = new Map(); let sequence = 0;
    const activeDownloads = new Map();
    const focusElement = HTMLElement.prototype.focus;
    addEventListener('message', event => {
      if (event.source !== parent) return;
      const data = event.data;
      if (data?.type === 'trick-it:locale' && data.version === 1 && supportedLocales.includes(data.locale) && data.locale !== document.documentElement.lang) {
        document.documentElement.lang = data.locale;
        dispatchEvent(new CustomEvent('trick-it:localechange', { detail: { locale: data.locale } }));
      }
      if (!config.token || data?.version !== 1 || data.token !== config.token) return;
      if (data.type === 'trick-it:download-cancelled' && typeof data.streamId === 'string') { activeDownloads.get(data.streamId)?.(); return; }
      if (typeof data.id !== 'string') return;
      const request = pending.get(data.id); if (!request) return;
      if (data.type === 'trick-it:asset-progress') {
        if (request.operation !== 'asset' || !Number.isSafeInteger(data.loaded) || !Number.isSafeInteger(data.total) || data.loaded < 0 || data.total < 1 || data.loaded > data.total || data.total > 536870912 || !['loading', 'verifying'].includes(data.phase)) return;
        try { request.onProgress?.({ loaded: data.loaded, total: data.total, phase: data.phase }); }
        catch (error) { pending.delete(data.id); clearTimeout(request.timer); request.reject(error); }
        return;
      }
      if (data.type !== 'trick-it:response') return;
      pending.delete(data.id); clearTimeout(request.timer);
      // The parent can focus the opaque frame, but only this SDK can restore
      // its local control. Never override a newer control or host-page focus.
      if (request.focusTarget?.isConnected && document.hasFocus() && document.activeElement === document.body) focusElement.call(request.focusTarget, { preventScroll: true });
      if (data.ok === true) request.resolve(data.value); else request.reject(Object.assign(new Error('The requested capability was denied or could not complete.'), { code: typeof data.error === 'string' ? data.error : 'request' }));
    });
    function request(operation, payload, onProgress, transfer = []) {
      // Preserve existing tools while keeping large buffers off the message bridge.
      if (operation === 'downloads' && payload?.bytes instanceof ArrayBuffer && payload.bytes.byteLength > downloadLimits.inlineBytes) {
        const bytes = new Uint8Array(payload.bytes);
        return downloadStream({ filename: payload.filename, mime: payload.mime, size: bytes.byteLength,
          chunks: (async function* () { yield bytes; })(), onProgress });
      }
      const hostUi = operation === 'ui-toast' || operation === 'ui-dialog' || operation === 'locale-pack';
      if (!config.token || (!hostUi && operation !== 'asset' && !config.permissions.includes(operation) && !(operation.startsWith('download-') && config.permissions.includes('downloads'))) || (operation === 'asset' && !config.permissions.includes('external-assets'))) return Promise.reject(new Error('Permission not granted.'));
      if (pending.size >= 16 && operation !== 'download-cancel') return Promise.reject(new Error('Too many pending requests.'));
      const id = String(++sequence);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('Capability request timed out.')); }, 330000);
        const focusTarget = operation !== 'asset' && operation !== 'locale-pack' && operation !== 'ui-toast' && document.activeElement instanceof HTMLElement ? document.activeElement : null;
        pending.set(id, { resolve, reject, timer, operation, onProgress, focusTarget });
        try { parent.postMessage({ type: 'trick-it:request', version: 1, token: config.token, id, operation, payload }, '*', transfer); }
        catch { clearTimeout(timer); pending.delete(id); reject(new Error('Invalid capability payload.')); }
      });
    }
${tableScript}
${highlightRuntime}
${codeBlockScript}
${uiKitScript}
    async function downloadStream({ filename, mime, size, chunks, onProgress, signal }) {
      if (!config.permissions.includes('downloads')) throw new Error('Download permission was not declared.');
      if (!Number.isSafeInteger(size) || size < 1 || size > downloadLimits.maxBytes) throw Object.assign(new Error('Export exceeds this browser’s download limit.'), { code: 'size' });
      if (!chunks || typeof chunks[Symbol.asyncIterator] !== 'function') throw new Error('chunks must be an async iterable.');
      const checkAbort = () => { if (signal?.aborted) throw Object.assign(new Error('Export cancelled.'), { code: 'aborted' }); };
      checkAbort();
      const { streamId } = await request('download-begin', { filename, mime, size });
      let interrupt;
      const interrupted = new Promise((_, reject) => { interrupt = () => reject(Object.assign(new Error('Export cancelled.'), { code: 'aborted' })); });
      // Closing is intentionally not raced: the native sink may already commit.
      interrupted.catch(() => undefined);
      activeDownloads.set(streamId, interrupt);
      const abort = () => { interrupt(); void request('download-cancel', { streamId }).catch(() => undefined); };
      signal?.addEventListener('abort', abort, { once: true });
      let iterator;
      let produced = false;
      try {
        iterator = chunks[Symbol.asyncIterator]();
        checkAbort();
        let sent = 0;
        onProgress?.({ loaded: 0, total: size, phase: 'saving' });
        while (true) {
          const next = await Promise.race([iterator.next(), interrupted]);
          if (next.done) { produced = true; break; }
          const part = next.value;
          checkAbort();
          const view = part instanceof ArrayBuffer ? new Uint8Array(part) : part;
          if (!(view instanceof Uint8Array)) throw new Error('Invalid export chunk.');
          for (let start = 0; start < view.byteLength; start += downloadLimits.chunkBytes) {
            checkAbort();
            const buffer = view.slice(start, start + downloadLimits.chunkBytes).buffer;
            sent += buffer.byteLength;
            if (sent > size) throw new Error('Export exceeds declared size.');
            await Promise.race([request('download-chunk', { streamId, bytes: buffer }, undefined, [buffer]), interrupted]);
            checkAbort();
            onProgress?.({ loaded: sent, total: size, phase: 'saving' });
          }
        }
        if (sent !== size) throw new Error('Export size does not match declaration.');
        checkAbort();
        onProgress?.({ loaded: sent, total: size, phase: 'finishing' });
        checkAbort();
        // Closing commits the native file atomically; cancellation ends here.
        signal?.removeEventListener('abort', abort);
        await request('download-end', { streamId });
        onProgress?.({ loaded: sent, total: size, phase: 'complete' });
      } catch (error) {
        await request('download-cancel', { streamId }).catch(() => undefined);
        throw error;
      } finally {
        signal?.removeEventListener('abort', abort);
        activeDownloads.delete(streamId);
        // A generator may be awaiting work that cancellation cannot interrupt.
        // Ask it to close, but never block file cleanup or the caller on return().
        if (!produced) { try { Promise.resolve(iterator?.return?.()).catch(() => undefined); } catch {} }
      }
    }
    Object.defineProperty(window, 'trickIt', { value: Object.freeze({ version: 1, request, downloadStream, downloadLimits, ui, asset: (id, options = {}) => request('asset', { id }, options.onProgress), localePack: locale => request('locale-pack', { locale }), get locale() { return document.documentElement.lang; }, permissions: Object.freeze(config.permissions) }), configurable: false });
  })();`;
  // Host controls can only change an existing isolated frame. No reload and no
  // permission escalation; the host separately contains browser zoom gestures.
  const zoomBootstrap = `
(() => {
  const token = ${JSON.stringify(token)};
  if (!token) return;
  // Native frame zoom also magnifies the host. Translate gestures into the
  // same tool-only zoom used by the toolbar, without replacing the iframe.
  const currentZoom = () => Math.round((parseFloat(document.documentElement.style.getPropertyValue('--ot-host-tool-zoom')) || 1) * 100);
  function applyZoom(percent, notify = false) {
    percent = Math.max(${TOOL_ZOOM.min}, Math.min(${TOOL_ZOOM.max}, Math.round(percent)));
    if (percent === currentZoom()) return;
    document.documentElement.style.setProperty('--ot-host-tool-zoom', String(percent / 100));
    dispatchEvent(new Event('trick-it:zoomchange'));
    if (notify) parent.postMessage({ type: 'trick-it:zoom-request', version: 1, token, percent }, '*');
  }
  addEventListener('wheel', (event) => {
    if (!event.ctrlKey && !event.metaKey || event.defaultPrevented) return;
    event.preventDefault();
    if (event.deltaY) applyZoom(currentZoom() + (event.deltaY < 0 ? 5 : -5), true);
  }, { passive: false });
  addEventListener('keydown', (event) => {
    if (event.defaultPrevented || !(event.ctrlKey || event.metaKey) || !['+', '=', '-', '0'].includes(event.key)) return;
    event.preventDefault();
    applyZoom(event.key === '0' ? ${TOOL_ZOOM.default} : currentZoom() + (event.key === '-' ? -${TOOL_ZOOM.step} : ${TOOL_ZOOM.step}), true);
  });
  let pinch = null;
  const distance = touches => Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY);
  addEventListener('touchstart', (event) => {
    if (event.defaultPrevented || event.touches.length !== 2) return;
    event.preventDefault();
    const span = distance(event.touches);
    pinch = span > 0 ? { distance: span, percent: currentZoom() } : null;
  }, { passive: false });
  addEventListener('touchmove', (event) => {
    if (event.defaultPrevented || event.touches.length < 2) return;
    event.preventDefault();
    if (pinch) applyZoom(pinch.percent * distance(event.touches) / pinch.distance, true);
  }, { passive: false });
  addEventListener('touchend', () => { pinch = null; });
  addEventListener('touchcancel', () => { pinch = null; });
  let gestureZoom = ${initialZoom};
  addEventListener('gesturestart', (event) => {
    event.preventDefault();
    gestureZoom = currentZoom();
  }, { passive: false });
  addEventListener('gesturechange', (event) => {
    event.preventDefault();
    if (!pinch && Number.isFinite(event.scale) && event.scale > 0) applyZoom(gestureZoom * event.scale, true);
  }, { passive: false });
  addEventListener('message', (event) => {
    if (!token || event.source !== parent) return;
    const data = event.data;
    if (data?.type !== '${zoomMessageType}' || data.version !== 1 || data.token !== token ||
        !Number.isInteger(data.percent) || data.percent < ${TOOL_ZOOM.min} || data.percent > ${TOOL_ZOOM.max}) return;
    if (Number.isSafeInteger(data.viewportHeight) && data.viewportHeight > 0 && data.viewportHeight <= 100000) {
      document.documentElement.style.setProperty('--ot-host-viewport-height', data.viewportHeight + 'px');
      dispatchEvent(new Event('trick-it:zoomchange'));
    }
    applyZoom(data.percent);
  });
})();
`;
  // The parent cannot measure an opaque sandbox. Send only the height of the
  // tool's rendered document, never DOM/content, through the session channel.
  const resizeBootstrap = `
(() => {
  const token = ${JSON.stringify(token)};
  if (!token) return;
  let scheduled = false, lastHeight = -1;
  // A tool's 100vh wrapper must refer to the host viewport, not to the iframe
  // height that it is about to increase. Normalize CSS declarations (including
  // dynamic/inline ones) without touching tool markup, scripts or fixed sizes.
  function viewportStyles() {
    const units = /"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|url\\((?:\\\\.|[^"'()\\\\]|"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')*\\)|(?<![-\\w.])(-?(?:[0-9]*\\.)?[0-9]+(?:e[+-]?[0-9]+)?)(?:d|s|l)?vh\\b/gi;
    function style(declaration) {
      for (const property of Array.from(declaration)) {
        const value = declaration.getPropertyValue(property);
        const stable = value.replace(units, (match, amount) => amount === undefined ? match : 'calc(var(--ot-host-viewport-height) * ' + Number(amount) / 100 + ')');
        if (stable !== value) declaration.setProperty(property, stable, declaration.getPropertyPriority(property));
      }
    }
    function rules(entries) {
      for (const rule of entries) {
        if (rule.style) style(rule.style);
        if (rule.cssRules) rules(rule.cssRules);
      }
    }
    for (const sheet of document.styleSheets) rules(sheet.cssRules);
    for (const element of document.querySelectorAll('[style]')) style(element.style);
  }
  function measure() {
    scheduled = false;
    const body = document.body, root = document.documentElement;
    if (!body || !root) return;
    viewportStyles();
    const rect = body.getBoundingClientRect();
    const margin = Math.max(0, parseFloat(getComputedStyle(body).marginBottom) || 0);
    // Unlike root.scrollHeight, body content can shrink when the frame is tall.
    // Consider root overflow only when it actually extends past the viewport.
    const overflow = root.scrollHeight > innerHeight + 1 ? root.scrollHeight : 0;
    const scale = parseFloat(getComputedStyle(body).zoom) || 1;
    // Classic horizontal scrollbars consume viewport height; reserve their
    // actual size so horizontal overflow never introduces a vertical scrollbar.
    const scrollbar = Math.max(0, innerHeight - root.clientHeight);
    const height = Math.ceil(Math.max(rect.bottom + margin * scale, body.scrollHeight * scale + Math.max(0, rect.top) + margin * scale, overflow) + scrollbar);
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
    addEventListener('trick-it:zoomchange', schedule);
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
`;
  return `<!doctype html><html lang="${locale}" data-theme="${theme}" style="color-scheme:${theme};--ot-host-tool-zoom:${initialZoom / 100};--ot-host-viewport-height:${viewportHeight}px"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${themeStyles}${uiKitStyles}${tableStyles}${codeBlockStyles}</style><script>${themeBootstrap}${zoomBootstrap}${sdk}</script><script>${resizeBootstrap}</script></head><body>${html}</body></html>`;
}
