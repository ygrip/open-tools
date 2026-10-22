<script lang="ts">
  import { createToolRuntimeHost } from '$lib/runtime/host.svelte';
  import type { RuntimeTool } from '$lib/runtime/core';
  import type { WikiReadRequest } from '$lib/runtime/wiki';
  import type { StreamStart } from '$lib/runtime/downloads';
  import { DOWNLOAD_LIMITS } from '$lib/runtime/download-policy';
  import { runtimeStrings } from '$lib/runtime/strings';
  import { TOOL_ZOOM, stepToolZoom } from '$lib/runtime/tool-zoom';
  import ServiceChallenge from './ServiceChallenge.svelte';
  import ClayStatus from './ClayStatus.svelte';
  import ToolArt from './ToolArt.svelte';
  import Icon from './Icon.svelte';
  import type { ToolIcon } from '$lib/registry/types';
  let { tool, locale = 'en' }: { tool: RuntimeTool; locale?: string } = $props();
  const text = $derived(runtimeStrings(locale));
  let zoomPercent = $state<number>(TOOL_ZOOM.default);
  const host = createToolRuntimeHost(() => tool, () => locale, () => zoomPercent);
</script>

{#if host.frameLocale !== locale}<p class="runtime-notice" role="status">{text.languageFallback}</p>{/if}
<div class="runtime-details surface">
  <details>
    <summary>{text.guide} · {tool.name} v{tool.version}</summary>
    {#if tool.guide}<p>{tool.guide.summary}</p><ol>{#each tool.guide.steps as step}<li>{step}</li>{/each}</ol>{/if}
    {#if host.assets.length}<h2>{text.assets}</h2><p>{text.assetHelp}</p><ul>{#each host.assets as asset}<li><strong>{asset.id}</strong> · {new URL(asset.url).origin} · {(asset.bytes / 1024 / 1024).toFixed(2)} MiB · {asset.type} · {asset.defer ? text.deferred : text.automatic}<br /><code>{asset.url}</code><br /><code>SHA-256: {asset.sha256}</code></li>{/each}</ul>{/if}
  </details>
</div>

{#if host.consent}
  <div class="load-state"><ClayStatus state="waiting" title={text.permissions} detail={tool.name} /></div>
  <div class="consent surface" role="dialog" aria-modal="true" aria-labelledby="runtime-consent-title">
    <p class="consent-source"><ToolArt id={tool.id} icon={(tool.icon ?? 'sparkles') as ToolIcon} size={32} /> {tool.name}</p>
    <h2 id="runtime-consent-title">{text.permissions}</h2>
    <p>{text.permissionHelp}</p>
    {#each host.startupPermissions as permission}
      <label class="permission"><input type="checkbox" value={permission.name} required={permission.required} bind:group={host.selected} /><span><strong>{text.labels[permission.name]}</strong> <small>({permission.required ? text.required : text.optional})</small><span>{permission.reason}</span></span></label>
    {/each}
    {#if host.assets.length}
      <h3>{text.assets}</h3><p>{text.assetHelp}</p>
      <ul>{#each host.assets as asset}<li>{asset.id} · {new URL(asset.url).origin} · {(asset.bytes / 1024 / 1024).toFixed(2)} MiB · {asset.type} · {asset.defer ? text.deferred : text.automatic}</li>{/each}</ul>
    {/if}
    <button class="clay-button primary" type="button" disabled={host.missingRequired} onclick={host.startWithChoices}>{text.start}</button>
    <p class="hint">{text.optionalOff}</p>
  </div>
{:else}
  <section class="runtime-workspace surface" aria-label={tool.name}>
    <div class="runtime-topline">
      <ToolArt id={tool.id} icon={(tool.icon ?? 'sparkles') as ToolIcon} size={40} />
      <span class="runtime-title"><strong>{tool.name}</strong><span class="runtime-meta"><span class="version-chip">v{tool.version}</span><span class="private-chip"><Icon name="shield" size={12} /> {text.sandboxed}</span></span></span>
      {#if host.frameDocument}
        <div class="runtime-zoom-controls" role="group" aria-label={text.zoomGroup}>
          <button type="button" aria-label={text.zoomOut} title={text.zoomOut} disabled={zoomPercent <= TOOL_ZOOM.min} onclick={() => (zoomPercent = stepToolZoom(zoomPercent, -1))}><Icon name="minus" size={18} /></button>
          <span class="zoom-level" role="meter" aria-label={text.zoomLevel} aria-valuemin={TOOL_ZOOM.min} aria-valuemax={TOOL_ZOOM.max} aria-valuenow={zoomPercent} aria-live="polite">{zoomPercent}%</span>
          <button type="button" aria-label={text.zoomIn} title={text.zoomIn} disabled={zoomPercent >= TOOL_ZOOM.max} onclick={() => (zoomPercent = stepToolZoom(zoomPercent, 1))}><Icon name="plus" size={18} /></button>
          <button type="button" class="zoom-reset" aria-label={text.zoomReset} title={text.zoomReset} disabled={zoomPercent === TOOL_ZOOM.default} onclick={() => (zoomPercent = TOOL_ZOOM.default)}><Icon name="rotate-ccw" size={17} /></button>
        </div>
      {/if}
      {#if host.permissions.length}<button class="clay-button small revoke" type="button" onclick={host.resetAccess} aria-label={text.revoke} title={text.revoke}><Icon name="lock" size={16} /><span>{text.revokeShort}</span></button>{/if}
    </div>
    {#if host.failure || host.timedOut}
      <div class="load-state"><ClayStatus state="error" title={text.failed} detail={`${host.timedOut ? text.timeout : text.errors[host.failure!.code]}${host.failure?.status ? ` (${host.failure?.status})` : ''}`}><button class="clay-button small" type="button" onclick={host.startTool}>{text.retry}</button></ClayStatus></div>
    {:else if host.frameDocument}
      <iframe bind:this={host.frame} title={tool.name} srcdoc={host.frameDocument} sandbox="allow-scripts" allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'" referrerpolicy="no-referrer" style:height={`${host.frameHeight}px`} onload={host.syncFrame}></iframe>
    {:else if host.loading}
      <div class="load-state"><ClayStatus state={host.progress ? 'working' : 'waiting'} title={`${text.loading} ${tool.name}…`} detail={host.progress ? `${text.progress}: ${host.progress.id}` : ''} progress={host.progress ? host.progress.bytes / host.progress.total * 100 : null} /></div>
    {/if}
  </section>
{/if}
{#if host.progress && host.frameDocument}<div class="runtime-notice"><ClayStatus state="working" title={text.progress} detail={host.progress.id} progress={host.progress.bytes / host.progress.total * 100} /></div>{/if}
{#if host.downloadProgress && host.frameDocument}
  <div class="runtime-notice" data-download-progress>
    <ClayStatus state={host.downloadProgress.phase === 'complete' ? 'done' : 'working'} title={host.downloadProgress.phase === 'complete' ? text.downloadDone : host.downloadProgress.phase === 'finishing' ? text.downloadFinishing : text.downloadSaving}
      detail={`${host.downloadProgress.filename} · ${host.formatBytes(host.downloadProgress.loaded)} / ${host.formatBytes(host.downloadProgress.total)} · ${Math.floor(host.downloadProgress.loaded / host.downloadProgress.total * 100)}%`}
      progress={host.downloadProgress.loaded / host.downloadProgress.total * 100}>
      {#if host.downloadProgress.phase === 'saving'}<button class="clay-button small" type="button" onclick={host.cancelDownload}>{text.downloadCancel}</button>{/if}
    </ClayStatus>
  </div>
{/if}
{#if host.warning}<p class="runtime-notice" role="status">{host.warning === 'cache-corrupt' ? text.corruptWarning : text.cachedWarning}</p>{/if}
{#if host.assetFailure}<div class="runtime-notice" role="alert"><p>{text.errors[host.assetFailure.code]}</p>{#if host.failedAsset}<button class="clay-button small" type="button" onclick={host.retryAssetDownload}>{text.retryAsset}</button>{/if}</div>{/if}
{#if host.recoveredAsset}<p class="runtime-notice" role="status">{text.assetReady}</p>{/if}

<dialog bind:this={host.operationDialog} class="operation-dialog surface" aria-labelledby="runtime-operation-title" oncancel={(event) => { event.preventDefault(); host.denyPending(); }}>
  {#if host.pending}
    <h2 id="runtime-operation-title">{text.confirm}</h2>
    <p><strong>{tool.name}: {text.labels[(host.pending.operation === 'download-begin' ? 'downloads' : host.pending.operation) as keyof typeof text.labels]}</strong></p>
    <p>{host.pendingAsk ? text.rememberHelp : text.confirmHelp}</p>
    {#if host.pendingService && host.pendingInput}<p>{host.pendingService.handler === 'tracker-audit' ? (locale === 'id' ? 'URL publik akan diperiksa oleh Google PageSpeed Insights dan Worker trick-it. Google dapat memuat skrip halaman dalam browser uji terisolasi. Jangan gunakan URL privat atau bertanda tangan.' : 'The public URL is sent to Google PageSpeed Insights and inspected by the trick-it Worker. Google may load page scripts in an isolated test browser. Do not submit private or signed URLs.') : text.seoHelp}</p><pre>{host.pendingInput.url}</pre><p>{host.pendingInput.strategy === 'mobile' ? text.seoMobile : text.seoDesktop} · {text.serviceLimit}: {host.pendingService.rateLimit.limit} / {host.pendingService.rateLimit.periodSeconds}s</p>{#if host.pendingService.turnstile}<ServiceChallenge endpoint={host.serviceEndpoint(host.pendingService.id)} version={tool.version} sha256={tool.bundle.sha256} {locale} onToken={(token) => host.verificationToken = token} />{/if}{/if}
    {#if host.pending.operation === 'clipboard-write'}<pre>{(host.pending.payload as string).slice(0, 240)}</pre>{/if}
    {#if host.pending.operation === 'dns-query'}<p>{locale === 'id' ? 'Nama host dikirim ke resolver DNS-over-HTTPS publik (Cloudflare, termasuk resolver keamanannya, dan Google). Situs itu sendiri tidak dihubungi.' : 'The hostname is sent to public DNS-over-HTTPS resolvers (Cloudflare, including its security-filtering resolver, and Google). The site itself is not contacted.'}</p>{/if}
    {#if host.pending.operation === 'wiki-read'}<p>{locale === 'id' ? 'Situs tujuan akan menerima permintaan dari browser Anda. Tidak ada proxy server.' : 'Your browser will contact this wiki directly. No server proxy is used.'}</p><pre>{(host.pending.payload as WikiReadRequest).site}
{(host.pending.payload as WikiReadRequest).title}</pre>{/if}
    {#if host.pending.operation === 'download-begin'}<p>{(host.pending.payload as StreamStart).filename} · {host.formatBytes((host.pending.payload as StreamStart).size)}</p><p>{host.nativeDownloads() ? text.downloadNative : text.downloadBuffered} {text.downloadLimit}: {host.formatBytes(host.nativeDownloads() ? DOWNLOAD_LIMITS.maxBytes : DOWNLOAD_LIMITS.bufferedMaxBytes)}.</p>{/if}
    {#if host.pending.operation === 'downloads'}<p>{(host.pending.payload as { filename: string }).filename} · {(host.pending.payload as { mime: string }).mime} · {((host.pending.payload as { bytes: ArrayBuffer }).bytes.byteLength / 1024).toFixed(1)} KiB</p>{/if}
    {#if host.pending.operation === 'camera-capture' && host.cameraStage !== 'off'}
      <p>{locale === 'id' ? 'Foto hanya dikirim ke alat setelah Anda menekan Ambil foto.' : 'Only the photo you capture is sent to this tool.'}</p>
      <video bind:this={host.cameraVideo} autoplay muted playsinline class="camera-preview" aria-label={locale === 'id' ? 'Pratinjau kamera' : 'Camera preview'}></video>
    {/if}
    {#if host.locationActive}
      {#if host.locationStage === 'locating'}<p role="status">{text.location.locating}</p>{/if}
      {#if host.locationStage === 'blocked'}<p role="alert">{text.location.blocked}</p>{/if}
      {#if host.locationStage === 'ready' && host.locationFix}
        <p>{text.location.preview}</p>
        <pre>{host.locationFix.latitude.toFixed(5)}, {host.locationFix.longitude.toFixed(5)} · ±{Math.round(host.locationFix.accuracy)} m</pre>
        <p class="hint">{text.location.precisionHelp}</p>
      {/if}
    {/if}
    <div class="dialog-actions">
      <button class="clay-button" type="button" onclick={host.denyPending}>{host.cameraStage === 'off' && !host.locationActive ? text.deny : locale === 'id' ? 'Batal' : 'Cancel'}</button>
      {#if host.locationActive}
        {#if host.locationStage === 'blocked'}<button class="clay-button primary" type="button" onclick={() => host.pending && host.startLocation(host.pending)}>{text.location.retry}</button>{/if}
        {#if host.locationStage === 'locating'}<button class="clay-button primary" type="button" disabled>{text.location.locatingShort}</button>{/if}
        {#if host.locationStage === 'ready'}
          <button class="clay-button" type="button" onclick={() => host.shareLocation(false)}>{text.location.approximate}</button>
          <button class="clay-button primary" type="button" onclick={() => host.shareLocation(true)}>{text.location.precise}</button>
        {/if}
      {:else if host.pending.operation === 'camera-capture' && host.cameraStage !== 'off'}
        <button class="clay-button primary" type="button" disabled={host.cameraStage !== 'ready'} onclick={host.captureCamera}>{host.cameraStage === 'ready' ? locale === 'id' ? 'Ambil foto' : 'Capture photo' : locale === 'id' ? 'Menyiapkan kamera…' : 'Starting camera…'}</button>
      {:else}
        <button class="clay-button primary" type="button" disabled={host.pendingService?.turnstile && !host.verificationToken} onclick={host.approvePending}>{text.allow}</button>
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
  .runtime-zoom-controls { display: flex; flex: 0 0 auto; align-items: center; gap: 4px; margin-left: auto; padding: 4px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); }
  .runtime-zoom-controls button { display: grid; place-items: center; flex: 0 0 auto; width: 44px; height: 44px; border: 0; border-radius: 12px; color: var(--text); background: transparent; cursor: pointer; }
  .runtime-zoom-controls button:hover:not(:disabled) { background: var(--peach); }
  .runtime-zoom-controls button:focus-visible { outline: 2px solid var(--accent-strong); outline-offset: 2px; }
  .runtime-zoom-controls button:disabled { opacity: .35; cursor: not-allowed; }
  .runtime-zoom-controls .zoom-level { display: block; min-width: 49px; text-align: center; color: var(--text-secondary); font-weight: 900; font-size: 13px; font-variant-numeric: tabular-nums; }
  .runtime-zoom-controls .zoom-reset { border-left: 1px solid var(--line); border-radius: 0 12px 12px 0; }
  @media (max-width: 600px) {
    .runtime-topline { flex-wrap: wrap; }
    .runtime-zoom-controls { order: 3; width: 100%; margin: 2px 0 0; justify-content: center; }
  }
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
