<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { base } from '$app/paths';
  import { sandboxDocument, themeMessageType } from '$lib/registry/sandbox';
  import { documentTheme } from '$lib/theme';
  import { loadAsset, loadBundle, parseRuntimeRequest, RuntimeFailure, type RuntimeAsset, type RuntimeRequest, type RuntimeTool, type PermissionName, type CacheWarning } from '$lib/runtime/core';
  import { runtimeStrings } from '$lib/runtime/strings';

  let { tool, locale = 'en' }: { tool: RuntimeTool; locale?: string } = $props();
  const text = $derived(runtimeStrings(locale));
  const frameLocale = $derived(tool.locales?.includes(locale) ? locale : tool.locales?.[0] ?? 'en');
  const permissions = $derived(tool.permissions ?? []);
  const assets = $derived(tool.assets ?? []);
  const release = $derived(JSON.stringify([tool.id, tool.version, tool.bundle.sha256, tool.permissions, tool.assets]));
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
  let operationDialog = $state<HTMLDialogElement | null>(null);
  let loading = $state(false);
  let timedOut = $state(false);
  let controller: AbortController | undefined;
  let generation = 0;
  let token = '';
  let brokerBusy = false;
  let seen = new Set<string>();
  let inFlight = new Set<string>();
  let loadedAssets = new Map<string, Promise<Uint8Array>>();
  const downloadUrls = new Set<string>();
  const missingRequired = $derived(permissions.some((permission) => permission.required && !selected.includes(permission.name)));

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
      promise = loadAsset(tool, asset, {
        signal,
        onProgress: (bytes) => { if (current === generation && !signal.aborted) progress = { id: asset.id, bytes, total: asset.bytes }; },
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
    grants = [...selected];
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
      if (current === generation && !signal.aborted) frameDocument = sandboxDocument(html, documentTheme(document), { locale: frameLocale, token, permissions: [...grants], scriptAssets: assets.some((asset) => asset.type === 'script') });
    } catch (error) {
      if (current === generation && !signal.aborted) failure = fail(error);
    } finally {
      clearTimeout(timeout);
      if (current === generation) { loading = false; progress = null; }
    }
  }

  function revoke() {
    controller?.abort();
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
    inFlight.clear();
    seen.clear();
    consent = true;
  }

  function denyPending() {
    if (pending) {
      reply(pending, false, undefined, 'denied');
      inFlight.delete(pending.id);
    }
    pending = null;
  }

  async function approvePending() {
    const request = pending;
    if (!request) return;
    const current = generation;
    pending = null;
    brokerBusy = true;
    try {
      let value: unknown;
      if (request.operation === 'clipboard-read') {
        if (!navigator.clipboard?.readText) throw new RuntimeFailure('unsupported');
        value = await navigator.clipboard.readText();
        if (typeof value !== 'string' || value.length > 1024 * 1024) throw new RuntimeFailure('size');
      } else if (request.operation === 'clipboard-write') {
        if (!navigator.clipboard?.writeText) throw new RuntimeFailure('unsupported');
        await navigator.clipboard.writeText(request.payload as string);
      } else if (request.operation === 'geolocation') {
        if (!navigator.geolocation) throw new RuntimeFailure('unsupported');
        value = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
          ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
          () => reject(new RuntimeFailure('denied')), { timeout: 10_000, maximumAge: 0, enableHighAccuracy: false }
        ));
      } else if (request.operation === 'downloads') {
        const data = request.payload as { bytes: ArrayBuffer; filename: string; mime: string };
        const url = URL.createObjectURL(new Blob([data.bytes], { type: data.mime }));
        downloadUrls.add(url);
        const link = document.createElement('a');
        link.href = url;
        link.download = data.filename;
        link.hidden = true;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.delete(url); }, 1000);
      }
      if (current === generation) reply(request, true, value);
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
      const nextHeight = Math.max(200, size.height);
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
    if (inFlight.size >= 16) { reply(request, false, undefined, 'busy'); return; }
    if (parsed.asset) {
      inFlight.add(request.id);
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
      } finally { if (current === generation) { progress = null; inFlight.delete(request.id); } }
    } else if (pending || brokerBusy) reply(request, false, undefined, 'busy');
    else { inFlight.add(request.id); pending = request; }
  }

  onMount(() => {
    mounted = true;
    const observer = new MutationObserver(syncFrame);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('message', receive);
    return () => {
      controller?.abort();
      observer.disconnect();
      window.removeEventListener('message', receive);
      for (const url of downloadUrls) URL.revokeObjectURL(url);
    };
  });

  $effect(() => {
    if (!mounted) return;
    void release;
    untrack(() => {
      revoke();
      consent = permissions.length > 0;
      if (!consent) void startTool();
    });
  });
  $effect(() => { if (mounted) { void locale; syncFrame(); } });
  $effect(() => {
    if (!operationDialog) return;
    if (pending && !operationDialog.open) operationDialog.showModal();
    else if (!pending && operationDialog.open) operationDialog.close();
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
  <section class="consent surface" aria-labelledby="runtime-consent-title">
    <h2 id="runtime-consent-title">{text.permissions}</h2>
    <p>{text.permissionHelp}</p>
    {#each permissions as permission}
      <label class="permission"><input type="checkbox" value={permission.name} required={permission.required} bind:group={selected} /><span><strong>{text.labels[permission.name]}</strong> <small>({permission.required ? text.required : text.optional})</small><span>{permission.reason}</span></span></label>
    {/each}
    {#if assets.length}
      <h3>{text.assets}</h3><p>{text.assetHelp}</p>
      <ul>{#each assets as asset}<li>{asset.id} · {new URL(asset.url).origin} · {(asset.bytes / 1024 / 1024).toFixed(2)} MiB · {asset.type} · {asset.defer ? text.deferred : text.automatic}</li>{/each}</ul>
    {/if}
    <button class="clay-button primary" type="button" disabled={missingRequired} onclick={startTool}>{text.start}</button>
    <p class="hint">{text.optionalOff}</p>
  </section>
{:else}
  <section class="runtime-workspace surface" aria-label={tool.name}>
    <div class="runtime-topline"><span>{tool.name}</span><span>v{tool.version}</span>{#if permissions.length}<button class="clay-button small" type="button" onclick={revoke}>{text.revoke}</button>{/if}</div>
    {#if failure || timedOut}
      <div class="load-state" role="alert"><h2>{text.failed}</h2><p>{timedOut ? text.timeout : text.errors[failure!.code]}{#if failure?.status} ({failure.status}){/if}</p><button class="clay-button" type="button" onclick={startTool}>{text.retry}</button></div>
    {:else if frameDocument}
      <iframe bind:this={frame} title={tool.name} srcdoc={frameDocument} sandbox="allow-scripts" allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'" referrerpolicy="no-referrer" style:height={`${frameHeight}px`} onload={syncFrame}></iframe>
    {:else if loading}
      <div class="load-state" role="status"><h2>{text.loading} {tool.name}…</h2></div>
    {/if}
  </section>
{/if}
{#if progress}<p class="runtime-notice" role="status">{text.progress}: {progress.id} · {Math.min(100, Math.round(progress.bytes / progress.total * 100))}%</p>{/if}
{#if warning}<p class="runtime-notice" role="status">{warning === 'cache-corrupt' ? text.corruptWarning : text.cachedWarning}</p>{/if}
{#if assetFailure}<div class="runtime-notice" role="alert"><p>{text.errors[assetFailure.code]}</p>{#if failedAsset}<button class="clay-button small" type="button" onclick={retryAssetDownload}>{text.retryAsset}</button>{/if}</div>{/if}
{#if recoveredAsset}<p class="runtime-notice" role="status">{text.assetReady}</p>{/if}

<dialog bind:this={operationDialog} class="operation-dialog surface" aria-labelledby="runtime-operation-title" oncancel={(event) => { event.preventDefault(); denyPending(); }}>
  {#if pending}
    <h2 id="runtime-operation-title">{text.confirm}</h2>
    <p><strong>{tool.name}: {text.labels[pending.operation as keyof typeof text.labels]}</strong></p>
    <p>{text.confirmHelp}</p>
    {#if pending.operation === 'clipboard-write'}<pre>{(pending.payload as string).slice(0, 240)}</pre>{/if}
    {#if pending.operation === 'downloads'}<p>{(pending.payload as { filename: string }).filename} · {(pending.payload as { mime: string }).mime} · {((pending.payload as { bytes: ArrayBuffer }).bytes.byteLength / 1024).toFixed(1)} KiB</p>{/if}
    <div class="dialog-actions"><button class="clay-button" type="button" onclick={denyPending}>{text.deny}</button><button class="clay-button primary" type="button" onclick={approvePending}>{text.allow}</button></div>
  {/if}
</dialog>

<style>
  .runtime-details { padding: 16px 20px; margin-bottom: 20px; border-radius: 22px; }
  summary { overflow-wrap: anywhere; cursor: pointer; min-height: 44px; display: list-item; align-content: center; font-weight: 850; }
  .runtime-details p, .runtime-details li { color: var(--text-secondary); font-size: 14px; overflow-wrap: anywhere; }
  .runtime-details h2 { font-size: 20px; margin-top: 20px; }
  .runtime-details ol, .runtime-details ul { padding-left: 24px; }
  .consent { padding: 28px; }
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
  .runtime-workspace { overflow: hidden; }
  .runtime-topline { padding: 14px 20px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; border-bottom: 1px solid var(--line); font-size: 13px; }
  .runtime-topline > span:first-child { min-width: 0; flex: 1; overflow-wrap: anywhere; }
  .runtime-topline > span:nth-child(2) { margin-left: auto; }
  iframe { display: block; width: 100%; min-width: 0; height: 280px; border: 0; }
  .load-state { min-height: 280px; padding: 32px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; text-align: center; }
  .load-state h2 { font-size: 26px; }
  .load-state p { color: var(--muted); }
  .runtime-notice { margin: 16px 0; color: var(--text-secondary); overflow-wrap: anywhere; }
  .operation-dialog { width: min(550px, calc(100% - 32px)); padding: 28px; color: var(--text); }
  .operation-dialog::backdrop { background: rgb(27 22 25 / .6); }
  .operation-dialog h2 { font-size: 25px; }
  .operation-dialog p { margin-top: 16px; color: var(--text-secondary); overflow-wrap: anywhere; }
  .operation-dialog pre { white-space: pre-wrap; overflow-wrap: anywhere; background: var(--bg); padding: 14px; border-radius: 14px; max-height: 160px; overflow: auto; }
  .dialog-actions { display: flex; justify-content: end; gap: 12px; flex-wrap: wrap; margin-top: 24px; }
  @media (max-width: 520px) { .consent { padding: 22px; } }
</style>
