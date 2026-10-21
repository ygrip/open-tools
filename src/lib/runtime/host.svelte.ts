import { onMount, untrack } from 'svelte';
import { base } from '$app/paths';
import { sandboxDocument, themeMessageType } from '../registry/sandbox';
import { documentTheme } from '../theme';
import { loadAsset, loadBundle, RuntimeFailure, type RuntimeAsset, type RuntimeRequest, type RuntimeTool, type PermissionName, type CacheWarning } from './core';
import { executeCapability } from './handlers';
import { DownloadSessionManager, type StreamStart, type StreamPiece, type DownloadProgress } from './downloads';
import { wikiOrigin, wikiImageUrl, type WikiReadRequest, type WikiImageRequest } from './wiki';
import { openDialog, closeDialog, hostUi, showToast } from '../ui/host-ui.svelte';
import type { Decisions } from '../permissions';
import { startupPermissions as startupForTool, loadStartupPermissions, saveStartupPermissions, runtimeGrants, rememberPermission, needsPermissionPrompt, clearDecisions } from './permission-coordinator';
import { RuntimeSession } from './session';
import { classifyRuntimeMessage } from './dispatcher';
import { createMediaSessions } from './media.svelte';
export function createToolRuntimeHost(getTool: () => RuntimeTool, getLocale: () => string) {
  const tool = $derived(getTool());
  const locale = $derived(getLocale());
  const frameLocale = $derived(tool.locales?.includes(locale) ? locale : tool.locales?.[0] ?? 'en');
  const permissions = $derived(tool.permissions ?? []);
  const assets = $derived(tool.assets ?? []);
  const release = $derived(JSON.stringify([tool.id, tool.version, tool.bundle.sha256, tool.permissions, tool.assets, tool.services]));
  let mounted = $state(false);
  let frame = $state<HTMLIFrameElement | null>(null);
  let frameDocument = $state('');
  let frameHeight = $state(280);
  let selected = $state<PermissionName[]>([]);
  let grants = $state<PermissionName[]>([]);
  let consent = $state(false);
  let failure = $state<RuntimeFailure | null>(null);
  let warning = $state<CacheWarning | null>(null);
  let assetFailure = $state<RuntimeFailure | null>(null);
  let failedAsset = $state<RuntimeAsset | null>(null);
  let recoveredAsset = $state(false);
  let progress = $state<{ id: string; bytes: number; total: number } | null>(null);
  let pending = $state<RuntimeRequest | null>(null);
  let verificationToken = $state('');
  const pendingService = $derived(pending?.operation === 'services' ? tool.services?.find(service => service.id === (pending?.payload as { feature?: string })?.feature) : undefined);
  const pendingInput = $derived(pendingService ? (pending?.payload as { input: { url: string; strategy: string } }).input : undefined);
  const serviceEndpoint = (feature: string) => `${base}/api/tools/${tool.id}/${feature}`;
  let operationDialog = $state<HTMLDialogElement | null>(null);
  let operationFocus: HTMLElement | null = null;

  let loading = $state(false);
  let timedOut = $state(false);

  const downloadUrls = new Set<string>();
  const session = new RuntimeSession();
  let downloadProgress = $state<DownloadProgress | null>(null);
  const downloadSessions = new DownloadSessionManager(downloadUrls, undefined, value => { downloadProgress = value; });
  async function cancelDownload() {
    if (downloadProgress?.phase !== 'saving') return;
    const streamId = downloadProgress.streamId;
    const cancelled = downloadSessions.cancel(streamId);
    // Only the user's explicit cancellation interrupts a stalled producer.
    // Sink failures retain their actual error in the request acknowledgement.
    frame?.contentWindow?.postMessage({ type: 'trick-it:download-cancelled', version: 1, token: session.token, streamId }, '*');
    await cancelled;
  }
  const nativeDownloads = () => typeof (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function';
  const formatBytes = (bytes: number) => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GiB` : `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  // Remember approved wiki origins for this tool session only, never globally.
  const approvedWikiOrigins = new Set<string>();
  // Startup permissions change the sandbox policy, so they are chosen before launch.
  // Runtime permissions are asked on first use. Both are remembered per tool.
  const startupPermissions = $derived(startupForTool(permissions));
  const missingRequired = $derived(startupPermissions.some((permission) => permission.required && !selected.includes(permission.name)));
  let decisions = $state<Decisions>({});
  /** True while the pending request's permission has never been decided. */
  let pendingAsk = $state(false);

  function syncFrame() {
    frame?.contentWindow?.postMessage({ type: themeMessageType, version: 1, theme: documentTheme(document) }, '*');
    frame?.contentWindow?.postMessage({ type: 'trick-it:locale', version: 1, locale: frameLocale }, '*');
  }

  function reply(request: RuntimeRequest, ok: boolean, value?: unknown, error?: string, transfer: Transferable[] = []) {
    if (request.session.token !== session.token || session.controller?.signal.aborted || !frame?.contentWindow) return;
    frame.contentWindow.postMessage({ type: 'trick-it:response', version: 1, token: session.token, id: request.id, ok, value, error }, '*', transfer);
  }

  function fail(error: unknown): RuntimeFailure {
    return error instanceof RuntimeFailure ? error : new RuntimeFailure('request');
  }

  function assetAllowed(asset: RuntimeAsset, allowed: string[]) {
    return allowed.includes('external-assets') && (asset.type !== 'wasm' || allowed.includes('wasm')) && (asset.type !== 'worker' || allowed.includes('workers'));
  }

  function getAsset(asset: RuntimeAsset, current: number, signal: AbortSignal) {
    let promise = session.loadedAssets.get(asset.id);
    if (!promise) {
      let reportedAt = -Infinity;
      promise = loadAsset(tool, asset, {
        signal,
        onProgress: (bytes, phase = 'loading') => {
          if (current !== session.generation || signal.aborted) return;
          const now = performance.now();
          if (phase === 'loading' && bytes !== asset.bytes && now - reportedAt < 80) return;
          reportedAt = now;
          progress = { id: asset.id, bytes, total: asset.bytes };
          for (const [id, assetId] of session.assetRequests) {
            if (assetId === asset.id) frame?.contentWindow?.postMessage({ type: 'trick-it:asset-progress', version: 1, token: session.token, id, loaded: bytes, total: asset.bytes, phase }, '*');
          }
        },
        onWarning: (value) => { if (current === session.generation && !signal.aborted) warning = value; }
      });
      session.loadedAssets.set(asset.id, promise);
      void promise.catch(() => { if (session.loadedAssets.get(asset.id) === promise) session.loadedAssets.delete(asset.id); });
    }
    return promise;
  }

  async function retryAssetDownload() {
    if (!failedAsset || !session.controller || session.controller.signal.aborted) return;
    const current = session.generation;
    const asset = failedAsset;
    assetFailure = null;
    try {
      await getAsset(asset, current, session.controller.signal);
      if (current === session.generation) { failedAsset = null; recoveredAsset = true; }
    } catch (error) { if (current === session.generation) assetFailure = fail(error); }
    finally { if (current === session.generation) progress = null; }
  }

  async function startTool() {
    const { signal, session.generation: current } = session.start();
    pending = null;
    frameDocument = '';
    frameHeight = 280;
    failure = null;
    assetFailure = null;
    failedAsset = null;
    recoveredAsset = false;
    warning = null;
    progress = null;
    timedOut = false;
    grants = runtimeGrants(permissions, selected, decisions);
    consent = false;
    loading = true;
    const timeout = setTimeout(() => {
      if (current !== session.generation) return;
      timedOut = true;
      loading = false;
      session.controller?.abort();
    }, 30_000);
    try {
      if (!session.token || !globalThis.crypto?.subtle) throw new RuntimeFailure('unsupported');
      const html = await loadBundle(tool, `${base}/bundles/${tool.id}/${tool.bundle.sha256}.json?version=${encodeURIComponent(tool.version)}`, signal);
      clearTimeout(timeout);
      for (const asset of assets) {
        if (!asset.defer && assetAllowed(asset, grants)) await getAsset(asset, current, signal);
      }
      if (current === session.generation && !signal.aborted) frameDocument = sandboxDocument(html, documentTheme(document), { locale: frameLocale, token: session.token, permissions: [...grants], scriptAssets: assets.some((asset) => asset.type === 'script'), nativeDownloads: nativeDownloads() });
    } catch (error) {
      if (current === session.generation && !signal.aborted) failure = fail(error);
    } finally {
      clearTimeout(timeout);
      if (current === session.generation) { loading = false; progress = null; }
    }
  }

  const media = createMediaSessions({
    session.generation: () => session.generation,
    pending: () => pending,
    active: (request, current) => current === session.generation && pending?.id === request.id && !session.controller?.signal.aborted,
    reply,
    finish: request => { session.inFlight.delete(request.id); pending = null; },
    busy: value => { session.brokerBusy = value; }
  });
  const locationActive = $derived(pending?.operation === 'geolocation' && media.locationStage !== 'off');

  function teardown() {
    // A popup from the old session must not answer the restarted tool.
    if (hostUi.dialog?.source?.id === tool.id) closeDialog(false);
    media.stopCamera();
    media.stopLocation();
    session.stop();
    void downloadSessions.cancel();
    pending = null;
    frameDocument = '';
    frameHeight = 280;
    selected = [];
    grants = [];
    failure = null;
    timedOut = false;
    assetFailure = null;
    failedAsset = null;
    recoveredAsset = false;
    progress = null;
    pendingAsk = false;
  }

  function initialize() {
    teardown();
    const initial = loadStartupPermissions(tool.id, startupPermissions);
    decisions = initial.decisions;
    selected = initial.selected;
    consent = initial.consent;
    if (!consent) void startTool();
  }

  function resetAccess() {
    clearDecisions(tool.id);
    initialize();
  }

  function startWithChoices() {
    decisions = saveStartupPermissions(tool.id, startupPermissions, selected);
    void startTool();
  }

  function remember(operation: string, decision: 'granted' | 'denied') {
    decisions = rememberPermission(tool.id, operation, decision);
    if (decision === 'denied') grants = grants.filter((name) => name !== operation);
  }

  function denyPending() {
    media.stopCamera();
    media.stopLocation();
    session.brokerBusy = false;
    if (pending && pendingAsk && pending.operation !== 'wiki-read') remember(pending.operation === 'download-begin' ? 'downloads' : pending.operation, 'denied');
    pendingAsk = false;
    if (pending) {
      reply(pending, false, undefined, 'denied');
      session.inFlight.delete(pending.id);
    }
    pending = null;
  }

  async function approvePending() {
    const request = pending;
    if (!request) return;
    if (pendingAsk) {
      if (request.operation === 'wiki-read') approvedWikiOrigins.add(wikiOrigin(request.payload as WikiReadRequest));
      remember(request.operation === 'download-begin' ? 'downloads' : request.operation, 'granted'); pendingAsk = false;
    }
    if (request.operation === 'camera-capture') { await media.startCamera(request); return; }
    if (request.operation === 'geolocation') { await media.startLocation(request); return; }
    const service = pendingService;
    if (request.operation === 'services' && (!service || service.turnstile && !verificationToken)) return;
    const tokenForAction = verificationToken;
    verificationToken = '';
    const current = session.generation;
    pending = null;
    session.brokerBusy = true;
    try {
      const { value, transfer } = request.operation === 'download-begin'
        ? { value: await downloadSessions.begin(request.payload as StreamStart), transfer: [] }
        : await executeCapability(request, {
            tool,
            signal: session.controller!.signal,
            serviceEndpoint,
            verificationToken: tokenForAction,
            downloadUrls
          });
      if (current === session.generation) reply(request, true, value, undefined, transfer);
    } catch (error) {
      if (current === session.generation) reply(request, false, undefined, error instanceof RuntimeFailure ? error.code : 'denied');
    } finally { if (current === session.generation) { session.brokerBusy = false; session.inFlight.delete(request.id); } }
  }

  async function receive(event: MessageEvent) {
    const incoming = classifyRuntimeMessage(event, { frameWindow: frame?.contentWindow ?? null, frameReady: !!frameDocument, session, tool, grants });
    if (incoming.kind === 'ignore') return;
    if (incoming.kind === 'resize') {
      if (Math.abs(frameHeight - incoming.height) >= 2) frameHeight = incoming.height;
      return;
    }
    if (incoming.kind === 'reject') { reply(incoming.request, false, undefined, incoming.error); return; }
    const parsed = incoming.parsed;
    const { request } = parsed;
    const source = { id: tool.id, name: tool.name, icon: tool.icon };
    if (parsed.toast) { showToast(parsed.toast.message, parsed.toast.tone, source); reply(request, true); return; }
    if (parsed.dialog) {
      // One centred popup at a time, never alongside a host permission prompt.
      if (pending || session.brokerBusy || hostUi.dialog) { reply(request, false, undefined, 'busy'); return; }
      session.inFlight.add(request.id);
      const current = session.generation;
      try {
        const accepted = await openDialog({ ...parsed.dialog, source });
        if (current === session.generation) reply(request, true, accepted);
      } catch { if (current === session.generation) reply(request, false, undefined, 'busy'); }
      finally { if (current === session.generation) session.inFlight.delete(request.id); }
      return;
    }
    if (parsed.asset) {
      session.inFlight.add(request.id);
      session.assetRequests.set(request.id, parsed.asset.id);
      const current = session.generation;
      assetFailure = null;
      recoveredAsset = false;
      try {
        const bytes = await getAsset(parsed.asset, current, session.controller.signal);
        if (current !== session.generation) return;
        const transferable = new Uint8Array(bytes).buffer;
        reply(request, true, { bytes: transferable, type: parsed.asset.type }, undefined, [transferable]);
      } catch (error) {
        if (current !== session.generation) return;
        assetFailure = fail(error);
        failedAsset = parsed.asset;
        reply(request, false, undefined, assetFailure.code);
      } finally { if (current === session.generation) { progress = null; session.inFlight.delete(request.id); session.assetRequests.delete(request.id); } }
    } else if (['download-chunk', 'download-end', 'download-cancel'].includes(request.operation)) {
      // Cleanup and sequential chunks remain available during unrelated prompts.
      session.inFlight.add(request.id);
      const current = session.generation;
      try {
        const payload = request.payload as StreamPiece & { streamId: string };
        if (request.operation === 'download-chunk') await downloadSessions.append(payload);
        else if (request.operation === 'download-end') await downloadSessions.finish(payload.streamId);
        else await downloadSessions.cancel(payload.streamId);
        if (current === session.generation) reply(request, true);
      } catch (error) {
        if (current === session.generation) reply(request, false, undefined, error instanceof RuntimeFailure ? error.code : 'request');
      } finally { if (current === session.generation) session.inFlight.delete(request.id); }
    } else if (pending || session.brokerBusy) reply(request, false, undefined, 'busy');
    else {
      verificationToken = '';
      session.inFlight.add(request.id);
      // Protected services confirm the exact URL and security check every time; nothing to remember.
      if (request.operation === 'wiki-read' && 'image' in (request.payload as object)) {
        // Pictures are only served for a wiki origin the user already approved this session.
        const payload = request.payload as WikiImageRequest;
        // A URL the broker will never serve is an invalid request for that picture; only an unapproved wiki is a refusal.
        let valid = true, approved = false;
        try { wikiImageUrl(payload); approved = approvedWikiOrigins.has(wikiOrigin({ site: payload.site, title: 'x', endpoint: '/w/api.php' })); } catch { valid = false; }
        if (!valid || !approved) { session.inFlight.delete(request.id); reply(request, false, undefined, valid ? 'denied' : 'invalid-request'); return; }
        pending = request; pendingAsk = false;
        void approvePending();
        return;
      }
      if (request.operation === 'wiki-read') {
        try { wikiOrigin(request.payload as WikiReadRequest); }
        catch { session.inFlight.delete(request.id); reply(request, false, undefined, 'invalid-request'); return; }
      }
      pendingAsk = needsPermissionPrompt(request, decisions, approvedWikiOrigins, value => wikiOrigin(value.payload as WikiReadRequest));
      pending = request;
      // Remembered grants run straight away; camera and location still show their
      // live preview, and protected services still need their security check.
      // A native save picker needs fresh user activation even when the downloads grant is remembered.
      if (!pendingAsk && request.operation !== 'services' && request.operation !== 'download-begin') void approvePending();
    }
  }

  onMount(() => {
    mounted = true;
    const observer = new MutationObserver(syncFrame);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('message', receive);
    return () => {
      if (hostUi.dialog?.source?.id === tool.id) closeDialog(false);
      media.stopCamera();
      media.stopLocation();
      session.stop();
      void downloadSessions.cancel();
      observer.disconnect();
      window.removeEventListener('message', receive);
      for (const url of downloadUrls) URL.revokeObjectURL(url);
    };
  });

  $effect(() => {
    if (!mounted) return;
    void release;
    untrack(() => {
      initialize();
    });
  });
  $effect(() => { if (mounted) { void locale; syncFrame(); } });
  $effect(() => {
    if (!operationDialog) return;
    if (pending && !operationDialog.open) {
      operationFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      operationDialog.showModal();
    } else if (!pending && operationDialog.open) {
      // Pending controls have already been removed by Svelte, so the native
      // dialog may lose its return-focus step. Only touch parent-owned nodes;
      // the sandbox's document must remain opaque.
      const restore = document.activeElement === document.body || operationDialog.contains(document.activeElement);
      operationDialog.close();
      const target = operationFocus;
      operationFocus = null;
      if (restore && target?.isConnected) target.focus({ preventScroll: true });
    }
  });

  return {
    get frameLocale() { return frameLocale; },
    get permissions() { return permissions; },
    get assets() { return assets; },
    get frameDocument() { return frameDocument; },
    get frameHeight() { return frameHeight; },
    get selected() { return selected; },
    get consent() { return consent; },
    get failure() { return failure; },
    get warning() { return warning; },
    get assetFailure() { return assetFailure; },
    get failedAsset() { return failedAsset; },
    get recoveredAsset() { return recoveredAsset; },
    get progress() { return progress; },
    get pending() { return pending; },
    get verificationToken() { return verificationToken; },
    get pendingService() { return pendingService; },
    get pendingInput() { return pendingInput; },
    get cameraStage() { return media.cameraStage; },
    get cameraVideo() { return media.cameraVideo; },
    get locationStage() { return media.locationStage; },
    get locationFix() { return media.locationFix; },
    get locationActive() { return locationActive; },
    get loading() { return loading; },
    get timedOut() { return timedOut; },
    get downloadProgress() { return downloadProgress; },
    get startupPermissions() { return startupPermissions; },
    get missingRequired() { return missingRequired; },
    get operationDialog() { return operationDialog; },
    get frame() { return frame; },
    set frame(value: HTMLIFrameElement | null) { frame = value; },
    set selected(value: PermissionName[]) { selected = value; },
    set cameraVideo(value: HTMLVideoElement | null) { media.cameraVideo = value; },
    set operationDialog(value: HTMLDialogElement | null) { operationDialog = value; },
    set verificationToken(value: string) { verificationToken = value; },
    serviceEndpoint,
    startCamera: media.startCamera,
    captureCamera: media.captureCamera,
    startLocation: media.startLocation,
    shareLocation: media.shareLocation,
    syncFrame,
    cancelDownload,
    nativeDownloads,
    formatBytes,
    retryAssetDownload,
    startTool,
    teardown,
    initialize,
    resetAccess,
    startWithChoices,
    denyPending,
    approvePending
  };
}
