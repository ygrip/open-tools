<script lang="ts">
  import { onMount, untrack, tick } from 'svelte';
  import { base } from '$app/paths';
  import { sandboxDocument, themeMessageType } from '$lib/registry/sandbox';
  import { documentTheme } from '$lib/theme';
  import { loadAsset, loadBundle, parseRuntimeRequest, RuntimeFailure, type RuntimeAsset, type RuntimeRequest, type RuntimeTool, type PermissionName, type CacheWarning } from '$lib/runtime/core';
  import { executeCapability } from '$lib/runtime/handlers';
  import { DownloadSessionManager, type StreamStart, type StreamPiece, type DownloadProgress } from '$lib/runtime/downloads';
  import { DOWNLOAD_LIMITS } from '$lib/runtime/download-policy';
  import ServiceChallenge from './ServiceChallenge.svelte';
  import { type DnsQueryRequest } from '$lib/runtime/dns';
  import { wikiOrigin, wikiImageUrl, type WikiReadRequest, type WikiImageRequest } from '$lib/runtime/wiki';
  import { runtimeStrings } from '$lib/runtime/strings';
  import { openDialog, closeDialog, hostUi, showToast } from '$lib/ui/host-ui.svelte';
  import { readDecisions, saveDecisions, clearDecisions, type Decisions } from '$lib/permissions';
  import ClayStatus from './ClayStatus.svelte';
  import ToolArt from './ToolArt.svelte';
  import Icon from './Icon.svelte';
  import type { ToolIcon } from '$lib/registry/types';

  let { tool, locale = 'en' }: { tool: RuntimeTool; locale?: string } = $props();
  const text = $derived(runtimeStrings(locale));
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
  let cameraStage = $state<'off' | 'starting' | 'ready'>('off');
  let cameraVideo = $state<HTMLVideoElement | null>(null);
  let cameraStream: MediaStream | null = null;
  // Location is routed through the host like the camera: the browser prompt,
  // a preview and a precision choice happen here; the tool only gets the result.
  let locationStage = $state<'off' | 'locating' | 'ready' | 'blocked'>('off');
  // Raw state: a deep $state proxy cannot be structured-cloned by postMessage.
  let locationFix = $state.raw<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const locationActive = $derived(pending?.operation === 'geolocation' && locationStage !== 'off');
  let loading = $state(false);
  let timedOut = $state(false);
  let controller: AbortController | undefined;
  let generation = 0;
  let token = '';
  let brokerBusy = false;
  let seen = new Set<string>();
  let inFlight = new Set<string>();
  let loadedAssets = new Map<string, Promise<Uint8Array>>();
  const assetRequests = new Map<string, string>(); // request ID → declared asset ID
  const downloadUrls = new Set<string>();
  let downloadProgress = $state<DownloadProgress | null>(null);
  const downloadSessions = new DownloadSessionManager(downloadUrls, undefined, value => { downloadProgress = value; });
  async function cancelDownload() {
    if (downloadProgress?.phase !== 'saving') return;
    const streamId = downloadProgress.streamId;
    const cancelled = downloadSessions.cancel(streamId);
    // Only the user's explicit cancellation interrupts a stalled producer.
    // Sink failures retain their actual error in the request acknowledgement.
    frame?.contentWindow?.postMessage({ type: 'trick-it:download-cancelled', version: 1, token, streamId }, '*');
    await cancelled;
  }
  const nativeDownloads = () => typeof (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function';
  const formatBytes = (bytes: number) => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GiB` : `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  // Remember approved wiki origins for this tool session only, never globally.
  const approvedWikiOrigins = new Set<string>();
  // Startup permissions change the sandbox policy, so they are chosen before launch.
  // Runtime permissions are asked on first use. Both are remembered per tool.
  const STARTUP: PermissionName[] = ['wasm', 'workers', 'external-assets'];
  const startupPermissions = $derived(permissions.filter((permission) => STARTUP.includes(permission.name)));
  const missingRequired = $derived(startupPermissions.some((permission) => permission.required && !selected.includes(permission.name)));
  let decisions = $state<Decisions>({});
  /** True while the pending request's permission has never been decided. */
  let pendingAsk = $state(false);

  function syncFrame() {
    frame?.contentWindow?.postMessage({ type: themeMessageType, version: 1, theme: documentTheme(document) }, '*');
    frame?.contentWindow?.postMessage({ type: 'trick-it:locale', version: 1, locale: frameLocale }, '*');
  }

  function reply(request: RuntimeRequest, ok: boolean, value?: unknown, error?: string, transfer: Transferable[] = []) {
    if (request.token !== token || controller?.signal.aborted || !frame?.contentWindow) return;
    frame.contentWindow.postMessage({ type: 'trick-it:response', version: 1, token, id: request.id, ok, value, error }, '*', transfer);
  }

  function fail(error: unknown): RuntimeFailure {
    return error instanceof RuntimeFailure ? error : new RuntimeFailure('request');
  }

  function assetAllowed(asset: RuntimeAsset, allowed: string[]) {
    return allowed.includes('external-assets') && (asset.type !== 'wasm' || allowed.includes('wasm')) && (asset.type !== 'worker' || allowed.includes('workers'));
  }

  function getAsset(asset: RuntimeAsset, current: number, signal: AbortSignal) {
    let promise = loadedAssets.get(asset.id);
    if (!promise) {
      let reportedAt = -Infinity;
      promise = loadAsset(tool, asset, {
        signal,
        onProgress: (bytes, phase = 'loading') => {
          if (current !== generation || signal.aborted) return;
          const now = performance.now();
          if (phase === 'loading' && bytes !== asset.bytes && now - reportedAt < 80) return;
          reportedAt = now;
          progress = { id: asset.id, bytes, total: asset.bytes };
          for (const [id, assetId] of assetRequests) {
            if (assetId === asset.id) frame?.contentWindow?.postMessage({ type: 'trick-it:asset-progress', version: 1, token, id, loaded: bytes, total: asset.bytes, phase }, '*');
          }
        },
        onWarning: (value) => { if (current === generation && !signal.aborted) warning = value; }
      });
      loadedAssets.set(asset.id, promise);
      void promise.catch(() => { if (loadedAssets.get(asset.id) === promise) loadedAssets.delete(asset.id); });
    }
    return promise;
  }

  async function retryAssetDownload() {
    if (!failedAsset || !controller || controller.signal.aborted) return;
    const current = generation;
    const asset = failedAsset;
    assetFailure = null;
    try {
      await getAsset(asset, current, controller.signal);
      if (current === generation) { failedAsset = null; recoveredAsset = true; }
    } catch (error) { if (current === generation) assetFailure = fail(error); }
    finally { if (current === generation) progress = null; }
  }

  async function startTool() {
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    const current = ++generation;
    const secureCrypto = globalThis.crypto as Crypto | undefined;
    token = secureCrypto?.randomUUID?.() ?? (secureCrypto ? [...secureCrypto.getRandomValues(new Uint8Array(24))].map((value) => value.toString(16).padStart(2, '0')).join('') : '');
    seen = new Set();
    inFlight = new Set();
    loadedAssets = new Map();
    assetRequests.clear();
    brokerBusy = false;
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
    grants = [...selected, ...permissions.filter((permission) => !STARTUP.includes(permission.name) && decisions[permission.name] !== 'denied').map((permission) => permission.name)];
    consent = false;
    loading = true;
    const timeout = setTimeout(() => {
      if (current !== generation) return;
      timedOut = true;
      loading = false;
      controller?.abort();
    }, 30_000);
    try {
      if (!token || !globalThis.crypto?.subtle) throw new RuntimeFailure('unsupported');
      const html = await loadBundle(tool, `${base}/bundles/${tool.id}/${tool.bundle.sha256}.json?version=${encodeURIComponent(tool.version)}`, signal);
      clearTimeout(timeout);
      for (const asset of assets) {
        if (!asset.defer && assetAllowed(asset, grants)) await getAsset(asset, current, signal);
      }
      if (current === generation && !signal.aborted) frameDocument = sandboxDocument(html, documentTheme(document), { locale: frameLocale, token, permissions: [...grants], scriptAssets: assets.some((asset) => asset.type === 'script'), nativeDownloads: nativeDownloads() });
    } catch (error) {
      if (current === generation && !signal.aborted) failure = fail(error);
    } finally {
      clearTimeout(timeout);
      if (current === generation) { loading = false; progress = null; }
    }
  }

  function stopCamera() {
    if (cameraVideo) { cameraVideo.pause(); cameraVideo.srcObject = null; }
    cameraStream?.getTracks().forEach(track => track.stop());
    cameraStream = null;
    cameraStage = 'off';
  }

  async function startCamera(request: RuntimeRequest) {
    if (!navigator.mediaDevices?.getUserMedia) {
      reply(request, false, undefined, 'unsupported');
      inFlight.delete(request.id); pending = null; return;
    }
    const current = generation;
    brokerBusy = true;
    cameraStage = 'starting';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (current !== generation || pending?.id !== request.id || controller?.signal.aborted) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      cameraStream = stream;
      await tick();
      if (!cameraVideo) throw new RuntimeFailure('unsupported');
      cameraVideo.srcObject = stream;
      await cameraVideo.play();
      if (current === generation && pending?.id === request.id) cameraStage = 'ready';
    } catch (error) {
      if (current === generation) {
        stopCamera();
        reply(request, false, undefined, error instanceof RuntimeFailure ? error.code : 'denied');
        inFlight.delete(request.id); pending = null;
      }
    } finally { if (current === generation && cameraStage !== 'ready') brokerBusy = false; }
  }

  async function captureCamera() {
    const request = pending;
    if (request?.operation !== 'camera-capture' || cameraStage !== 'ready' || !cameraVideo) return;
    const current = generation;
    try {
      const video = cameraVideo;
      if (!video.videoWidth || !video.videoHeight) throw new RuntimeFailure('unsupported');
      const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new RuntimeFailure('unsupported');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob || blob.size > 8 * 1024 * 1024) throw new RuntimeFailure('size');
      const bytes = await blob.arrayBuffer();
      if (current === generation) {
        stopCamera();
        pending = null;
        reply(request, true, { bytes, mime: 'image/png' }, undefined, [bytes]);
      }
    } catch (error) {
      if (current === generation) {
        reply(request, false, undefined, error instanceof RuntimeFailure ? error.code : 'request');
        stopCamera(); pending = null;
      }
    } finally { if (current === generation) { brokerBusy = false; inFlight.delete(request.id); } }
  }

  function stopLocation() {
    locationStage = 'off';
    locationFix = null;
  }

  async function geolocationState(): Promise<PermissionState | 'unknown'> {
    try { return (await navigator.permissions?.query({ name: 'geolocation' }))?.state ?? 'unknown'; }
    catch { return 'unknown'; }
  }

  async function startLocation(request: RuntimeRequest) {
    if (!navigator.geolocation) {
      reply(request, false, undefined, 'unsupported');
      inFlight.delete(request.id); pending = null; return;
    }
    const current = generation;
    const active = () => current === generation && pending?.id === request.id && !controller?.signal.aborted;
    brokerBusy = true;
    locationFix = null;
    if (await geolocationState() === 'denied') { if (active()) locationStage = 'blocked'; return; }
    if (!active()) return;
    locationStage = 'locating';
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!active()) return;
        locationFix = { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy };
        locationStage = 'ready';
      },
      (error) => {
        if (!active()) return;
        if (error.code === error.PERMISSION_DENIED) { locationStage = 'blocked'; return; }
        finishLocation(request, false, undefined, error.code === error.TIMEOUT ? 'timeout' : 'unsupported');
      },
      { timeout: 15_000, maximumAge: 60_000, enableHighAccuracy: false }
    );
  }

  function finishLocation(request: RuntimeRequest, ok: boolean, value?: unknown, error?: string) {
    stopLocation();
    pending = null;
    brokerBusy = false;
    inFlight.delete(request.id);
    reply(request, ok, value, error);
  }

  function shareLocation(precise: boolean) {
    const request = pending;
    const fix = locationFix;
    if (request?.operation !== 'geolocation' || locationStage !== 'ready' || !fix) return;
    // Two decimals is roughly 1.1 km: enough for timezone, weather or region lookups.
    const round = (value: number) => Math.round(value * 100) / 100;
    finishLocation(request, true, precise ? fix : { latitude: round(fix.latitude), longitude: round(fix.longitude), accuracy: Math.max(fix.accuracy, 1100) });
  }

  function teardown() {
    // A popup from the old session must not answer the restarted tool.
    if (hostUi.dialog?.source?.id === tool.id) closeDialog(false);
    stopCamera();
    stopLocation();
    controller?.abort();
    void downloadSessions.cancel();
    generation++;
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
    loadedAssets.clear();
    assetRequests.clear();
    inFlight.clear();
    seen.clear();
    pendingAsk = false;
  }

  function initialize() {
    teardown();
    decisions = readDecisions(tool.id);
    selected = startupPermissions.filter((permission) => decisions[permission.name] === 'granted').map((permission) => permission.name);
    consent = startupPermissions.some((permission) => !decisions[permission.name]);
    if (!consent) void startTool();
  }

  function resetAccess() {
    clearDecisions(tool.id);
    initialize();
  }

  function startWithChoices() {
    saveDecisions(tool.id, Object.fromEntries(startupPermissions.map((permission) => [permission.name, selected.includes(permission.name) ? 'granted' : 'denied'])));
    decisions = readDecisions(tool.id);
    void startTool();
  }

  function remember(operation: string, decision: 'granted' | 'denied') {
    saveDecisions(tool.id, { [operation]: decision });
    decisions = readDecisions(tool.id);
    if (decision === 'denied') grants = grants.filter((name) => name !== operation);
  }

  function denyPending() {
    stopCamera();
    stopLocation();
    brokerBusy = false;
    if (pending && pendingAsk && pending.operation !== 'wiki-read') remember(pending.operation === 'download-begin' ? 'downloads' : pending.operation, 'denied');
    pendingAsk = false;
    if (pending) {
      reply(pending, false, undefined, 'denied');
      inFlight.delete(pending.id);
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
    if (request.operation === 'camera-capture') { await startCamera(request); return; }
    if (request.operation === 'geolocation') { await startLocation(request); return; }
    const service = pendingService;
    if (request.operation === 'services' && (!service || service.turnstile && !verificationToken)) return;
    const tokenForAction = verificationToken;
    verificationToken = '';
    const current = generation;
    pending = null;
    brokerBusy = true;
    try {
      const { value, transfer } = request.operation === 'download-begin'
        ? { value: await downloadSessions.begin(request.payload as StreamStart), transfer: [] }
        : await executeCapability(request, {
            tool,
            signal: controller!.signal,
            serviceEndpoint,
            verificationToken: tokenForAction,
            downloadUrls
          });
      if (current === generation) reply(request, true, value, undefined, transfer);
    } catch (error) {
      if (current === generation) reply(request, false, undefined, error instanceof RuntimeFailure ? error.code : 'denied');
    } finally { if (current === generation) { brokerBusy = false; inFlight.delete(request.id); } }
  }

  async function receive(event: MessageEvent) {
    if (!controller || controller.signal.aborted) return;
    // Size reports are layout-only, not capability requests. Still require the
    // current sandbox window and session token so stale frames cannot resize us.
    if (event.data?.type === 'trick-it:resize') {
      const size = event.data;
      if (event.source !== frame?.contentWindow || !frameDocument || size.version !== 1 || size.token !== token || !Number.isSafeInteger(size.height) || size.height < 0 || size.height > 100000) return;
      const nextHeight = Math.max(200, size.height + 2);
      if (Math.abs(frameHeight - nextHeight) >= 2) frameHeight = nextHeight;
      return;
    }
    const parsed = parseRuntimeRequest(event, frame?.contentWindow ?? null, token, tool, grants);
    if (!parsed) return;
    const { request } = parsed;
    // Ignore retransmissions of an active operation: never reject its original
    // promise while leaving an already-visible sensitive-operation prompt alive.
    if (inFlight.has(request.id)) return;
    if (seen.has(request.id)) { reply(request, false, undefined, 'invalid-request'); return; }
    if (seen.size >= 1024) seen.delete(seen.values().next().value!);
    seen.add(request.id);
    if (parsed.error) { reply(request, false, undefined, parsed.error); return; }
    if (inFlight.size >= 16 && request.operation !== 'download-cancel') { reply(request, false, undefined, 'busy'); return; }
    const source = { id: tool.id, name: tool.name, icon: tool.icon };
    if (parsed.toast) { showToast(parsed.toast.message, parsed.toast.tone, source); reply(request, true); return; }
    if (parsed.dialog) {
      // One centred popup at a time, never alongside a host permission prompt.
      if (pending || brokerBusy || hostUi.dialog) { reply(request, false, undefined, 'busy'); return; }
      inFlight.add(request.id);
      const current = generation;
      try {
        const accepted = await openDialog({ ...parsed.dialog, source });
        if (current === generation) reply(request, true, accepted);
      } catch { if (current === generation) reply(request, false, undefined, 'busy'); }
      finally { if (current === generation) inFlight.delete(request.id); }
      return;
    }
    if (parsed.asset) {
      inFlight.add(request.id);
      assetRequests.set(request.id, parsed.asset.id);
      const current = generation;
      assetFailure = null;
      recoveredAsset = false;
      try {
        const bytes = await getAsset(parsed.asset, current, controller.signal);
        if (current !== generation) return;
        const transferable = new Uint8Array(bytes).buffer;
        reply(request, true, { bytes: transferable, type: parsed.asset.type }, undefined, [transferable]);
      } catch (error) {
        if (current !== generation) return;
        assetFailure = fail(error);
        failedAsset = parsed.asset;
        reply(request, false, undefined, assetFailure.code);
      } finally { if (current === generation) { progress = null; inFlight.delete(request.id); assetRequests.delete(request.id); } }
    } else if (['download-chunk', 'download-end', 'download-cancel'].includes(request.operation)) {
      // Cleanup and sequential chunks remain available during unrelated prompts.
      inFlight.add(request.id);
      const current = generation;
      try {
        const payload = request.payload as StreamPiece & { streamId: string };
        if (request.operation === 'download-chunk') await downloadSessions.append(payload);
        else if (request.operation === 'download-end') await downloadSessions.finish(payload.streamId);
        else await downloadSessions.cancel(payload.streamId);
        if (current === generation) reply(request, true);
      } catch (error) {
        if (current === generation) reply(request, false, undefined, error instanceof RuntimeFailure ? error.code : 'request');
      } finally { if (current === generation) inFlight.delete(request.id); }
    } else if (pending || brokerBusy) reply(request, false, undefined, 'busy');
    else {
      verificationToken = '';
      inFlight.add(request.id);
      // Protected services confirm the exact URL and security check every time; nothing to remember.
      if (request.operation === 'wiki-read' && 'image' in (request.payload as object)) {
        // Pictures are only served for a wiki origin the user already approved this session.
        const payload = request.payload as WikiImageRequest;
        // A URL the broker will never serve is an invalid request for that picture; only an unapproved wiki is a refusal.
        let valid = true, approved = false;
        try { wikiImageUrl(payload); approved = approvedWikiOrigins.has(wikiOrigin({ site: payload.site, title: 'x', endpoint: '/w/api.php' })); } catch { valid = false; }
        if (!valid || !approved) { inFlight.delete(request.id); reply(request, false, undefined, valid ? 'denied' : 'invalid-request'); return; }
        pending = request; pendingAsk = false;
        void approvePending();
        return;
      }
      if (request.operation === 'wiki-read') {
        try { wikiOrigin(request.payload as WikiReadRequest); }
        catch { inFlight.delete(request.id); reply(request, false, undefined, 'invalid-request'); return; }
      }
      pendingAsk = request.operation !== 'services' && (request.operation === 'wiki-read' ? !approvedWikiOrigins.has(wikiOrigin(request.payload as WikiReadRequest)) : decisions[request.operation === 'download-begin' ? 'downloads' : request.operation] !== 'granted');
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
      stopCamera();
      stopLocation();
      controller?.abort();
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
</script>

{#if frameLocale !== locale}<p class="runtime-notice" role="status">{text.languageFallback}</p>{/if}
<div class="runtime-details surface">
  <details>
    <summary>{text.guide} · {tool.name} v{tool.version}</summary>
    {#if tool.guide}<p>{tool.guide.summary}</p><ol>{#each tool.guide.steps as step}<li>{step}</li>{/each}</ol>{/if}
    {#if assets.length}<h2>{text.assets}</h2><p>{text.assetHelp}</p><ul>{#each assets as asset}<li><strong>{asset.id}</strong> · {new URL(asset.url).origin} · {(asset.bytes / 1024 / 1024).toFixed(2)} MiB · {asset.type} · {asset.defer ? text.deferred : text.automatic}<br /><code>{asset.url}</code><br /><code>SHA-256: {asset.sha256}</code></li>{/each}</ul>{/if}
  </details>
</div>

{#if consent}
  <div class="load-state"><ClayStatus state="waiting" title={text.permissions} detail={tool.name} /></div>
  <div class="consent surface" role="dialog" aria-modal="true" aria-labelledby="runtime-consent-title">
    <p class="consent-source"><ToolArt id={tool.id} icon={(tool.icon ?? 'sparkles') as ToolIcon} size={32} /> {tool.name}</p>
    <h2 id="runtime-consent-title">{text.permissions}</h2>
    <p>{text.permissionHelp}</p>
    {#each startupPermissions as permission}
      <label class="permission"><input type="checkbox" value={permission.name} required={permission.required} bind:group={selected} /><span><strong>{text.labels[permission.name]}</strong> <small>({permission.required ? text.required : text.optional})</small><span>{permission.reason}</span></span></label>
    {/each}
    {#if assets.length}
      <h3>{text.assets}</h3><p>{text.assetHelp}</p>
      <ul>{#each assets as asset}<li>{asset.id} · {new URL(asset.url).origin} · {(asset.bytes / 1024 / 1024).toFixed(2)} MiB · {asset.type} · {asset.defer ? text.deferred : text.automatic}</li>{/each}</ul>
    {/if}
    <button class="clay-button primary" type="button" disabled={missingRequired} onclick={startWithChoices}>{text.start}</button>
    <p class="hint">{text.optionalOff}</p>
  </div>
{:else}
  <section class="runtime-workspace surface" aria-label={tool.name}>
    <div class="runtime-topline">
      <ToolArt id={tool.id} icon={(tool.icon ?? 'sparkles') as ToolIcon} size={40} />
      <span class="runtime-title"><strong>{tool.name}</strong><span class="runtime-meta"><span class="version-chip">v{tool.version}</span><span class="private-chip"><Icon name="shield" size={12} /> {text.sandboxed}</span></span></span>
      {#if permissions.length}<button class="clay-button small revoke" type="button" onclick={resetAccess} aria-label={text.revoke} title={text.revoke}><Icon name="lock" size={16} /><span>{text.revokeShort}</span></button>{/if}
    </div>
    {#if failure || timedOut}
      <div class="load-state"><ClayStatus state="error" title={text.failed} detail={`${timedOut ? text.timeout : text.errors[failure!.code]}${failure?.status ? ` (${failure.status})` : ''}`}><button class="clay-button small" type="button" onclick={startTool}>{text.retry}</button></ClayStatus></div>
    {:else if frameDocument}
      <iframe bind:this={frame} title={tool.name} srcdoc={frameDocument} sandbox="allow-scripts" allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'" referrerpolicy="no-referrer" style:height={`${frameHeight}px`} onload={syncFrame}></iframe>
    {:else if loading}
      <div class="load-state"><ClayStatus state={progress ? 'working' : 'waiting'} title={`${text.loading} ${tool.name}…`} detail={progress ? `${text.progress}: ${progress.id}` : ''} progress={progress ? progress.bytes / progress.total * 100 : null} /></div>
    {/if}
  </section>
{/if}
{#if progress && frameDocument}<div class="runtime-notice"><ClayStatus state="working" title={text.progress} detail={progress.id} progress={progress.bytes / progress.total * 100} /></div>{/if}
{#if downloadProgress && frameDocument}
  <div class="runtime-notice" data-download-progress>
    <ClayStatus state={downloadProgress.phase === 'complete' ? 'done' : 'working'} title={downloadProgress.phase === 'complete' ? text.downloadDone : downloadProgress.phase === 'finishing' ? text.downloadFinishing : text.downloadSaving}
      detail={`${downloadProgress.filename} · ${formatBytes(downloadProgress.loaded)} / ${formatBytes(downloadProgress.total)} · ${Math.floor(downloadProgress.loaded / downloadProgress.total * 100)}%`}
      progress={downloadProgress.loaded / downloadProgress.total * 100}>
      {#if downloadProgress.phase === 'saving'}<button class="clay-button small" type="button" onclick={cancelDownload}>{text.downloadCancel}</button>{/if}
    </ClayStatus>
  </div>
{/if}
{#if warning}<p class="runtime-notice" role="status">{warning === 'cache-corrupt' ? text.corruptWarning : text.cachedWarning}</p>{/if}
{#if assetFailure}<div class="runtime-notice" role="alert"><p>{text.errors[assetFailure.code]}</p>{#if failedAsset}<button class="clay-button small" type="button" onclick={retryAssetDownload}>{text.retryAsset}</button>{/if}</div>{/if}
{#if recoveredAsset}<p class="runtime-notice" role="status">{text.assetReady}</p>{/if}

<dialog bind:this={operationDialog} class="operation-dialog surface" aria-labelledby="runtime-operation-title" oncancel={(event) => { event.preventDefault(); denyPending(); }}>
  {#if pending}
    <h2 id="runtime-operation-title">{text.confirm}</h2>
    <p><strong>{tool.name}: {text.labels[(pending.operation === 'download-begin' ? 'downloads' : pending.operation) as keyof typeof text.labels]}</strong></p>
    <p>{pendingAsk ? text.rememberHelp : text.confirmHelp}</p>
    {#if pendingService && pendingInput}<p>{pendingService.handler === 'tracker-audit' ? (locale === 'id' ? 'URL publik akan diperiksa oleh Google PageSpeed Insights dan Worker trick-it. Google dapat memuat skrip halaman dalam browser uji terisolasi. Jangan gunakan URL privat atau bertanda tangan.' : 'The public URL is sent to Google PageSpeed Insights and inspected by the trick-it Worker. Google may load page scripts in an isolated test browser. Do not submit private or signed URLs.') : text.seoHelp}</p><pre>{pendingInput.url}</pre><p>{pendingInput.strategy === 'mobile' ? text.seoMobile : text.seoDesktop} · {text.serviceLimit}: {pendingService.rateLimit.limit} / {pendingService.rateLimit.periodSeconds}s</p>{#if pendingService.turnstile}<ServiceChallenge endpoint={serviceEndpoint(pendingService.id)} version={tool.version} sha256={tool.bundle.sha256} {locale} onToken={(token) => verificationToken = token} />{/if}{/if}
    {#if pending.operation === 'clipboard-write'}<pre>{(pending.payload as string).slice(0, 240)}</pre>{/if}
    {#if pending.operation === 'dns-query'}<p>{locale === 'id' ? 'Nama host dikirim ke resolver DNS-over-HTTPS publik (Cloudflare, termasuk resolver keamanannya, dan Google). Situs itu sendiri tidak dihubungi.' : 'The hostname is sent to public DNS-over-HTTPS resolvers (Cloudflare, including its security-filtering resolver, and Google). The site itself is not contacted.'}</p>{/if}
    {#if pending.operation === 'wiki-read'}<p>{locale === 'id' ? 'Situs tujuan akan menerima permintaan dari browser Anda. Tidak ada proxy server.' : 'Your browser will contact this wiki directly. No server proxy is used.'}</p><pre>{(pending.payload as WikiReadRequest).site}
{(pending.payload as WikiReadRequest).title}</pre>{/if}
    {#if pending.operation === 'download-begin'}<p>{(pending.payload as StreamStart).filename} · {formatBytes((pending.payload as StreamStart).size)}</p><p>{nativeDownloads() ? text.downloadNative : text.downloadBuffered} {text.downloadLimit}: {formatBytes(nativeDownloads() ? DOWNLOAD_LIMITS.maxBytes : DOWNLOAD_LIMITS.bufferedMaxBytes)}.</p>{/if}
    {#if pending.operation === 'downloads'}<p>{(pending.payload as { filename: string }).filename} · {(pending.payload as { mime: string }).mime} · {((pending.payload as { bytes: ArrayBuffer }).bytes.byteLength / 1024).toFixed(1)} KiB</p>{/if}
    {#if pending.operation === 'camera-capture' && cameraStage !== 'off'}
      <p>{locale === 'id' ? 'Foto hanya dikirim ke alat setelah Anda menekan Ambil foto.' : 'Only the photo you capture is sent to this tool.'}</p>
      <video bind:this={cameraVideo} autoplay muted playsinline class="camera-preview" aria-label={locale === 'id' ? 'Pratinjau kamera' : 'Camera preview'}></video>
    {/if}
    {#if locationActive}
      {#if locationStage === 'locating'}<p role="status">{text.location.locating}</p>{/if}
      {#if locationStage === 'blocked'}<p role="alert">{text.location.blocked}</p>{/if}
      {#if locationStage === 'ready' && locationFix}
        <p>{text.location.preview}</p>
        <pre>{locationFix.latitude.toFixed(5)}, {locationFix.longitude.toFixed(5)} · ±{Math.round(locationFix.accuracy)} m</pre>
        <p class="hint">{text.location.precisionHelp}</p>
      {/if}
    {/if}
    <div class="dialog-actions">
      <button class="clay-button" type="button" onclick={denyPending}>{cameraStage === 'off' && !locationActive ? text.deny : locale === 'id' ? 'Batal' : 'Cancel'}</button>
      {#if locationActive}
        {#if locationStage === 'blocked'}<button class="clay-button primary" type="button" onclick={() => pending && startLocation(pending)}>{text.location.retry}</button>{/if}
        {#if locationStage === 'locating'}<button class="clay-button primary" type="button" disabled>{text.location.locatingShort}</button>{/if}
        {#if locationStage === 'ready'}
          <button class="clay-button" type="button" onclick={() => shareLocation(false)}>{text.location.approximate}</button>
          <button class="clay-button primary" type="button" onclick={() => shareLocation(true)}>{text.location.precise}</button>
        {/if}
      {:else if pending.operation === 'camera-capture' && cameraStage !== 'off'}
        <button class="clay-button primary" type="button" disabled={cameraStage !== 'ready'} onclick={captureCamera}>{cameraStage === 'ready' ? locale === 'id' ? 'Ambil foto' : 'Capture photo' : locale === 'id' ? 'Menyiapkan kamera…' : 'Starting camera…'}</button>
      {:else}
        <button class="clay-button primary" type="button" disabled={pendingService?.turnstile && !verificationToken} onclick={approvePending}>{text.allow}</button>
      {/if}
    </div>
  {/if}
</dialog>

<style>
  .runtime-details { padding: 16px 20px; margin-bottom: 20px; border-radius: 22px; }
  summary { overflow-wrap: anywhere; cursor: pointer; min-height: 44px; display: list-item; align-content: center; font-weight: 850; }
  .runtime-details p, .runtime-details li { color: var(--text-secondary); font-size: 14px; overflow-wrap: anywhere; }
  .runtime-details h2 { font-size: 20px; margin-top: 20px; }
  .runtime-details ol, .runtime-details ul { padding-left: 24px; }
  .consent { position: fixed; inset: 0; z-index: 70; margin: auto; width: min(560px, calc(100vw - 24px)); height: fit-content; max-height: calc(100dvh - 32px); overflow: auto; padding: 28px; box-shadow: 0 0 0 100vmax rgb(56 47 43 / .45), var(--clay-shadow); }
  .consent-source { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 12px; padding: 4px 12px 4px 4px; border: 1px solid var(--line); border-radius: 99px; background: var(--bg); font-size: 12px; font-weight: 800; color: var(--muted); }
  .consent h2 { font-size: 25px; }
  .consent > p { color: var(--muted); margin: 15px 0; }
  .consent li { overflow-wrap: anywhere; color: var(--muted); font-size: 14px; }
  .consent button:disabled { cursor: not-allowed; }
  .permission { display: flex; gap: 14px; align-items: flex-start; padding: 16px 0; border-top: 1px solid var(--line); cursor: pointer; }
  .permission input { width: 22px; height: 22px; flex-shrink: 0; margin: 4px 0; accent-color: var(--accent-strong); }
  .permission > span { min-width: 0; overflow-wrap: anywhere; }
  .permission > span > span { display: block; color: var(--muted); margin-top: 4px; }
  .permission small { color: var(--muted); }
  .hint { font-size: 13px; }
  .runtime-workspace { min-width: 0; overflow: hidden; }
  .runtime-topline { padding: 12px 14px 12px 16px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--bg) 55%, var(--surface)); }
  .runtime-title { flex: 1; min-width: 0; display: grid; gap: 4px; }
  .runtime-title strong { font-size: 15px; font-weight: 900; line-height: 1.25; letter-spacing: -.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .runtime-meta { display: flex; flex-wrap: wrap; gap: 6px; }
  .version-chip, .private-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border: 1px solid var(--line); border-radius: 99px; background: var(--surface); color: var(--muted); font-size: 11px; font-weight: 800; line-height: 1.5; white-space: nowrap; }
  .private-chip { background: var(--mint); color: var(--text-secondary); }
  .revoke { flex-shrink: 0; }
  @media (max-width: 520px) { .revoke { width: 44px; padding: 0; } .revoke span { display: none; } }
  iframe { display: block; width: 100%; min-width: 0; height: 280px; border: 0; }
  .load-state { min-height: 280px; padding: 24px 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; text-align: center; }
  .runtime-notice { margin: 16px 0; color: var(--text-secondary); overflow-wrap: anywhere; }
  .operation-dialog { width: min(550px, calc(100% - 32px)); padding: 28px; color: var(--text); }
  .operation-dialog::backdrop { background: rgb(27 22 25 / .6); }
  .operation-dialog h2 { font-size: 25px; }
  .operation-dialog p { margin-top: 16px; color: var(--text-secondary); overflow-wrap: anywhere; }
  .operation-dialog pre { white-space: pre-wrap; overflow-wrap: anywhere; background: var(--bg); padding: 14px; border-radius: 14px; max-height: 160px; overflow: auto; }
  .camera-preview { display: block; width: 100%; max-height: 55vh; margin-top: 16px; object-fit: contain; background: #111; border-radius: 16px; }
  .dialog-actions { display: flex; justify-content: end; gap: 12px; flex-wrap: wrap; margin-top: 24px; }
  @media (max-width: 520px) { .consent { padding: 22px; } }
</style>
