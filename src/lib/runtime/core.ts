import type { ToolService } from '../registry/types';
export type PermissionName = 'clipboard-read' | 'clipboard-write' | 'geolocation' | 'downloads' | 'camera-capture' | 'share-image' | 'external-assets' | 'wasm' | 'workers' | 'services' | 'wiki-read' | 'dns-query';
export type RuntimePermission = { name: PermissionName; reason: string; required: boolean };
export type RuntimeAsset = { id: string; url: string; sha256: string; bytes: number; type: 'wasm' | 'script' | 'worker' | 'data'; defer: boolean };
export type RuntimeTool = {
  schemaVersion: number; id: string; name: string; version: string; bundle: { sha256: string }; locales?: string[]; icon?: string;
  permissions?: RuntimePermission[]; assets?: RuntimeAsset[]; services?: ToolService[];
  guide?: { summary: string; steps: string[] };
};
export type RuntimeErrorCode = 'request' | 'invalid-bundle' | 'integrity' | 'size' | 'invalid-asset' | 'aborted' | 'denied' | 'invalid-request' | 'busy' | 'unsupported' | 'timeout' | 'quota' | 'audit-failed' | 'verification' | 'stale-release';
export type CacheWarning = 'cache-unavailable' | 'cache-corrupt';
export class RuntimeFailure extends Error {
  constructor(public code: RuntimeErrorCode, public status?: number) { super(code); this.name = 'RuntimeFailure'; }
}
const MAX_HTML = 5 * 1024 * 1024;
export const MAX_ASSET = 64 * 1024 * 1024;
const HASH = /^[a-f0-9]{64}$/;
const ID = /^[a-zA-Z0-9_-]{1,64}$/;
export function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new RuntimeFailure('aborted');
}
export async function sha256(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', copy.buffer))].map((value) => value.toString(16).padStart(2, '0')).join('');
}
async function readBounded(response: Response, maximum: number, signal?: AbortSignal, progress?: (bytes: number) => void) {
  if (!response.body) throw new RuntimeFailure('request');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      checkAbort(signal);
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) { await reader.cancel(); throw new RuntimeFailure('size'); }
      chunks.push(value);
      progress?.(length);
    }
    checkAbort(signal);
  } catch (error) {
    if (error instanceof RuntimeFailure) throw error;
    throw new RuntimeFailure(signal?.aborted ? 'aborted' : 'request');
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
export async function loadBundle(tool: RuntimeTool, url: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<string> {
  let response: Response;
  try { response = await fetcher(url, { signal, credentials: 'omit', cache: 'no-cache', redirect: 'error', referrerPolicy: 'no-referrer' }); }
  catch { throw new RuntimeFailure(signal.aborted ? 'aborted' : 'request'); }
  if (!response.ok) throw new RuntimeFailure('request', response.status);
  let bundle: { html?: unknown; id?: unknown; version?: unknown; sha256?: unknown };
  try { bundle = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(response, MAX_HTML * 6 + 4096, signal))); }
  catch (error) { if (error instanceof RuntimeFailure) throw error; throw new RuntimeFailure('invalid-bundle'); }
  if (!bundle || typeof bundle.html !== 'string' || !HASH.test(tool.bundle.sha256)) throw new RuntimeFailure('invalid-bundle');
  if ((tool.schemaVersion >= 3 || bundle.id !== undefined) && bundle.id !== tool.id ||
      (tool.schemaVersion >= 3 || bundle.version !== undefined) && bundle.version !== tool.version ||
      (tool.schemaVersion >= 3 || bundle.sha256 !== undefined) && bundle.sha256 !== tool.bundle.sha256) throw new RuntimeFailure('invalid-bundle');
  const bytes = new TextEncoder().encode(bundle.html);
  if (!bytes.length || bytes.length > MAX_HTML) throw new RuntimeFailure('size');
  if (await sha256(bytes) !== tool.bundle.sha256) throw new RuntimeFailure('integrity');
  checkAbort(signal);
  return bundle.html;
}
export function assetRequestUrl(asset: RuntimeAsset): string {
  let url: URL;
  try { url = new URL(asset.url); } catch { throw new RuntimeFailure('invalid-asset'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || !HASH.test(asset.sha256) || !Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || asset.bytes > MAX_ASSET) throw new RuntimeFailure('invalid-asset');
  url.searchParams.set('trick-it-sha256', asset.sha256);
  return url.href;
}
type AssetOptions = {
  signal: AbortSignal; fetcher?: typeof fetch; cacheStorage?: CacheStorage | null; timeoutMs?: number;
  onProgress?: (bytes: number, phase?: 'loading' | 'verifying') => void; onWarning?: (warning: CacheWarning) => void;
};
export async function loadAsset(tool: RuntimeTool, asset: RuntimeAsset, options: AssetOptions): Promise<Uint8Array> {
  checkAbort(options.signal);
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal.addEventListener('abort', abort, { once: true });
  let expired = false;
  const timer = setTimeout(() => { expired = true; controller.abort(); }, options.timeoutMs ?? 300_000);
  try { return await readAsset(tool, asset, { ...options, signal: controller.signal }); }
  catch (error) { if (expired && !options.signal.aborted) throw new RuntimeFailure('timeout'); throw error; }
  finally { clearTimeout(timer); options.signal.removeEventListener('abort', abort); }
}
async function readAsset(tool: RuntimeTool, asset: RuntimeAsset, options: AssetOptions): Promise<Uint8Array> {
  const { signal, onWarning, onProgress } = options;
  const url = assetRequestUrl(asset);
  const name = `trick-it-assets-${tool.id}-${tool.version}-${tool.bundle.sha256}`;
  let cache: Cache | undefined;
  try {
    const storage = options.cacheStorage === undefined ? globalThis.caches : options.cacheStorage;
    if (!storage) throw new Error('CacheStorage unavailable');
    cache = await storage.open(name);
  } catch { onWarning?.('cache-unavailable'); }
  if (cache) {
    let cached: Response | undefined;
    try { cached = await cache.match(url); } catch { onWarning?.('cache-unavailable'); cache = undefined; }
    if (cached) {
      try {
        const bytes = await readBounded(cached, asset.bytes, signal, onProgress);
        if (bytes.length !== asset.bytes) throw new RuntimeFailure('integrity');
        onProgress?.(bytes.length, 'verifying');
        if (await sha256(bytes) !== asset.sha256) throw new RuntimeFailure('integrity');
        checkAbort(signal);
        return bytes;
      } catch (error) {
        if (signal.aborted) throw new RuntimeFailure('aborted');
        onWarning?.('cache-corrupt');
        try { await cache?.delete(url); } catch { onWarning?.('cache-unavailable'); cache = undefined; }
      }
    }
  }
  checkAbort(signal);
  let response: Response;
  try { response = await (options.fetcher ?? fetch)(url, { signal, credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', cache: 'no-cache' }); }
  catch { throw new RuntimeFailure(signal.aborted ? 'aborted' : 'request'); }
  if (!response.ok || response.type === 'opaque') throw new RuntimeFailure('request', response.status);
  const bytes = await readBounded(response, asset.bytes, signal, onProgress);
  if (bytes.length !== asset.bytes) throw new RuntimeFailure('size');
  onProgress?.(bytes.length, 'verifying');
  if (await sha256(bytes) !== asset.sha256) throw new RuntimeFailure('integrity');
  checkAbort(signal);
  if (cache && !/no-store|private/i.test(response.headers.get('cache-control') || '')) {
    try { await cache.put(url, new Response(new Uint8Array(bytes), { headers: { 'content-type': 'application/octet-stream' } })); }
    catch { onWarning?.('cache-unavailable'); }
  } else if (cache) onWarning?.('cache-unavailable');
  return bytes;
}
export type RuntimeRequest = { type: 'trick-it:request'; version: 1; token: string; id: string; operation: PermissionName | 'asset' | 'ui-toast' | 'ui-dialog'; payload?: unknown };
export type UiToast = { message: string; tone: 'info' | 'success' | 'error' };
export type UiDialog = { kind: 'info' | 'confirm'; title: string; message: string; items: string[]; ordered: boolean; confirmLabel: string; cancelLabel: string; tone: 'default' | 'danger' };
export type ParsedRequest = { request: RuntimeRequest; error?: RuntimeErrorCode; asset?: RuntimeAsset; toast?: UiToast; dialog?: UiDialog };

const plainObject = (value: unknown, keys: string[]): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).every((key) => keys.includes(key));
const shortText = (value: unknown, max: number) => typeof value === 'string' && value.length <= max;

/** Host UI (toast, centred popups) is text-only and needs no permission. */
function parseUi(request: RuntimeRequest): ParsedRequest {
  const data = request.payload;
  if (request.operation === 'ui-toast') {
    if (!plainObject(data, ['message', 'tone']) || !shortText(data.message, 240) || !(data.message as string).trim() || !['info', 'success', 'error'].includes(data.tone as string)) return { request, error: 'invalid-request' };
    return { request, toast: { message: data.message as string, tone: data.tone as UiToast['tone'] } };
  }
  if (!plainObject(data, ['kind', 'title', 'message', 'items', 'ordered', 'confirmLabel', 'cancelLabel', 'tone']) || !['info', 'confirm'].includes(data.kind as string) || !shortText(data.title, 120) || !(data.title as string).trim() ||
    !shortText(data.message, 800) || !Array.isArray(data.items) || data.items.length > 12 || !data.items.every((item) => shortText(item, 300)) || typeof data.ordered !== 'boolean' ||
    !shortText(data.confirmLabel, 40) || !shortText(data.cancelLabel, 40) || !['default', 'danger'].includes(data.tone as string)) return { request, error: 'invalid-request' };
  return { request, dialog: { ...(data as UiDialog), items: [...(data.items as string[])] } };
}
export function parseRuntimeRequest(event: Pick<MessageEvent, 'source' | 'data'>, frameWindow: Window | null, token: string, tool: RuntimeTool, grants: readonly string[]): ParsedRequest | null {
  if (!frameWindow || event.source !== frameWindow) return null;
  const message = event.data;
  if (!message || typeof message !== 'object' || Array.isArray(message) || message.type !== 'trick-it:request' || message.version !== 1 || message.token !== token || typeof message.id !== 'string' || !ID.test(message.id)) return null;
  if (Object.keys(message).some((key) => !['type', 'version', 'token', 'id', 'operation', 'payload'].includes(key))) return null;
  const request = message as RuntimeRequest;
  const declared = (name: string) => tool.permissions?.some((permission) => permission.name === name) && grants.includes(name);
  if (request.operation === 'asset') {
    if (!declared('external-assets')) return { request, error: 'denied' };
    const payload = request.payload as { id?: unknown } | undefined;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).some((key) => key !== 'id')) return { request, error: 'invalid-request' };
    const asset = tool.assets?.find((value) => value.id === payload.id);
    if (!asset) return { request, error: 'invalid-request' };
    if (asset.type === 'wasm' && !declared('wasm') || asset.type === 'worker' && !declared('workers')) return { request, error: 'denied' };
    return { request, asset };
  }
  if (request.operation === 'ui-toast' || request.operation === 'ui-dialog') return parseUi(request);
  if (!['clipboard-read', 'clipboard-write', 'geolocation', 'downloads', 'camera-capture', 'share-image', 'services', 'wiki-read', 'dns-query'].includes(request.operation)) return { request, error: 'unsupported' };
  if (!declared(request.operation)) return { request, error: 'denied' };
  if ((request.operation === 'clipboard-read' || request.operation === 'geolocation' || request.operation === 'camera-capture') && request.payload !== undefined) return { request, error: 'invalid-request' };
  if (request.operation === 'clipboard-write' && (typeof request.payload !== 'string' || request.payload.length > 1024 * 1024)) return { request, error: 'invalid-request' };
  if (request.operation === 'dns-query') {
    const data = request.payload as { name?: unknown; type?: unknown } | undefined;
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(k => !['name', 'type'].includes(k)) || typeof data.name !== 'string' || data.name.length > 253 || typeof data.type !== 'string' || data.type.length > 8) return { request, error: 'invalid-request' };
  }
  if (request.operation === 'wiki-read') {
    const image = request.payload as { site?: unknown; image?: unknown } | undefined;
    if (image && typeof image === 'object' && !Array.isArray(image) && 'image' in image) {
      if (Object.keys(image).some(k => !['site', 'image'].includes(k)) || typeof image.site !== 'string' || image.site.length > 260 || typeof image.image !== 'string' || image.image.length > 1500) return { request, error: 'invalid-request' };
      return { request };
    }
    const data = request.payload as {site?: unknown;title?: unknown;endpoint?: unknown} | undefined;
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(k => !['site','title','endpoint'].includes(k)) || typeof data.site !== 'string' || data.site.length > 260 || typeof data.title !== 'string' || !data.title.trim() || data.title.length > 180 || typeof data.endpoint !== 'string' || data.endpoint.length > 150) return {request,error:'invalid-request'};
  }
  if (request.operation === 'services') {
    const data = request.payload as { feature?: unknown; input?: unknown } | undefined;
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(key => !['feature', 'input'].includes(key)) || typeof data.feature !== 'string' || !tool.services?.some(service => service.id === data.feature) || !data.input || typeof data.input !== 'object' || Array.isArray(data.input)) return { request, error: 'invalid-request' };
    const service = tool.services!.find(service => service.id === data.feature)!;
    const input = data.input as { url?: unknown; strategy?: unknown; locale?: unknown };
    if (service.handler !== 'pagespeed-seo' || Object.keys(input).some(key => !['url', 'strategy', 'locale'].includes(key)) || typeof input.url !== 'string' || input.url.length > 2048 || !['mobile', 'desktop'].includes(input.strategy as string) || !['en', 'id'].includes(input.locale as string)) return { request, error: 'invalid-request' };
    try { const url = new URL(input.url); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return { request, error: 'invalid-request' }; } catch { return { request, error: 'invalid-request' }; }
    try { if (JSON.stringify(data.input).length > 4096) return { request, error: 'invalid-request' }; }
    catch { return { request, error: 'invalid-request' }; }
  }
  if (request.operation === 'share-image') {
    const data = request.payload as { filename?: unknown; bytes?: unknown; mime?: unknown } | undefined;
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some(key => !['bytes', 'filename', 'mime'].includes(key)) ||
      typeof data.filename !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_. -]{0,119}$/.test(data.filename) ||
      !(data.bytes instanceof ArrayBuffer) || data.bytes.byteLength < 1 || data.bytes.byteLength > 16 * 1024 * 1024 ||
      data.mime !== 'image/png') return { request, error: 'invalid-request' };
  }
  if (request.operation === 'downloads') {
    const data = request.payload as { filename?: unknown; bytes?: unknown; mime?: unknown } | undefined;
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).some((key) => !['bytes', 'filename', 'mime'].includes(key)) || typeof data.filename !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_. -]{0,119}$/.test(data.filename) || !(data.bytes instanceof ArrayBuffer) || data.bytes.byteLength > 16 * 1024 * 1024 || typeof data.mime !== 'string' || !/^(?:text\/(?:plain|csv|html)|application\/(?:json|octet-stream|pdf)|image\/(?:png|svg\+xml))$/.test(data.mime)) return { request, error: 'invalid-request' };
  }
  return { request };
}

/** Same-origin, fixed-provider service. The sandbox never receives network access. */
export async function runService(endpoint: string, payload: unknown, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  checkAbort(signal);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 100_000);
  try {
    const response = await fetcher(endpoint, { method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
    if (!response.ok) {
      // Only a Turnstile rejection is a verification failure; other 403s are request errors.
      let code: unknown;
      if (response.status === 403) { try { code = (JSON.parse(new TextDecoder().decode(await readBounded(response, 1024, controller.signal))) as { error?: unknown })?.error; } catch { code = undefined; } }
      await response.body?.cancel().catch(() => undefined);
      throw new RuntimeFailure(response.status === 429 ? 'quota' : response.status === 403 ? (code === 'verification' ? 'verification' : 'request') : response.status === 409 ? 'stale-release' : response.status === 504 ? 'timeout' : 'audit-failed', response.status);
    }
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readBounded(response, 512 * 1024, controller.signal)));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new RuntimeFailure('request');
    checkAbort(signal);
    return data;
  } catch (error) {
    if (signal.aborted) throw new RuntimeFailure('aborted');
    if (controller.signal.aborted) throw new RuntimeFailure('timeout');
    if (error instanceof RuntimeFailure) throw error;
    throw new RuntimeFailure('audit-failed');
  } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
}
