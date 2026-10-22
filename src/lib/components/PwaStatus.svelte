<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { updated } from '$app/state';
  import { dev, version } from '$app/environment';
  import { m } from '$lib/paraglide/messages.js';
  import { applyPwaUpdate, canAutoRefreshCatalog } from '$lib/pwa-update.js';
  type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
  let prompt = $state<InstallEvent | null>(null);
  let waiting = $state<ServiceWorker | null>(null);
  let refresh = $state(false);
  let spaUpdate = $state(false);
  let controlled = $state(false);
  let installed = $state(false);
  let mobile = $state(false);
  let iosSafari = $state(false);
  let message = $state('');
  let updating = $state(false);
  type InstallProgress = { completed: number; total: number };
  let installingWorker = $state(false);
  let installProgress = $state<InstallProgress | null>(null);
  let updateError = $state('');
  let updateDismissed = $state(false);
  let installDismissed = $state(false);
  let manualInstructions = $state(false);
  // Only offer install where it helps: a phone/tablet browser tab that can actually install (native prompt, or iOS Add to Home Screen).
  // Chromium may offer native installation on desktop; iOS needs manual guidance.
  const showInstall = $derived(!installed && !installDismissed && (prompt !== null || (mobile && iosSafari)));
  const hasUpdate = $derived(waiting !== null || refresh || spaUpdate || updated.current || installingWorker);
  const updateBusy = $derived(updating || installingWorker);
  function updateDetail() {
    if (!installProgress) return m.pwa_updating_description();
    if (installProgress.completed === installProgress.total) return m.pwa_update_activating();
    return m.pwa_update_files({ done: String(installProgress.completed), total: String(installProgress.total) });
  }
  // A controlling worker may still serve an old offline shell. Activate it before reloading.
  const readyToReload = $derived(refresh || (!controlled && !waiting && (spaUpdate || updated.current)));

  onMount(() => {
    let disposed = false;
    const cleanup: (() => void)[] = [];
    // Check both build version metadata and the worker itself. A registry-only
    // change can produce a new offline shell without any user navigation.
    // The previous implementation waited for focus after one minute and then
    // polled only every five minutes, leaving installed catalogs stale.
    let lastUpdateCheck = 0;
    const checkDeployment = () => {
      if (disposed || dev || !navigator.onLine || document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastUpdateCheck < 60_000) return;
      lastUpdateCheck = now;
      void updated.check().then((isNew) => {
        if (!disposed && isNew) { spaUpdate = true; updateDismissed = false; }
      }).catch(() => { /* Offline or transient network failures are nonfatal. */ });
      // Do not rely on the SPA version probe alone: check for a waiting worker
      // even when an old release's version.json was once cached locally.
      if (navigator.serviceWorker?.controller) {
        void navigator.serviceWorker.getRegistration().then((registration) => {
          if (!disposed && registration && !registration.waiting && !registration.installing) return registration.update();
        }).catch(() => { /* Keep the currently working offline release. */ });
      }
    };
    const resumedOnline = () => { lastUpdateCheck = 0; checkDeployment(); };
    window.addEventListener('focus', checkDeployment);
    document.addEventListener('visibilitychange', checkDeployment);
    window.addEventListener('online', resumedOnline);
    const versionTimer = window.setInterval(checkDeployment, 60_000);
    // Do not delay the initial check for an entire poll interval on a stale tab.
    if (document.readyState === 'complete') checkDeployment();
    else window.addEventListener('load', checkDeployment, { once: true });
    cleanup.push(() => {
      window.removeEventListener('focus', checkDeployment);
      document.removeEventListener('visibilitychange', checkDeployment);
      window.removeEventListener('online', resumedOnline);
      window.removeEventListener('load', checkDeployment);
      clearInterval(versionTimer);
    });
    controlled = Boolean(navigator.serviceWorker?.controller);
    const standalone = matchMedia('(display-mode: standalone)');
    const touch = matchMedia('(hover: none) and (pointer: coarse)');
    const syncInstalled = () => { installed = standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true; if (installed) { prompt = null; manualInstructions = false; } };
    const syncMobile = () => { mobile = touch.matches; };
    syncInstalled();
    syncMobile();
    iosSafari = /iP(hone|ad|od)/.test(navigator.userAgent) && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
    standalone.addEventListener('change', syncInstalled);
    touch.addEventListener('change', syncMobile);
    cleanup.push(() => { standalone.removeEventListener('change', syncInstalled); touch.removeEventListener('change', syncMobile); });
    const install = (event: Event) => { event.preventDefault(); prompt = event as InstallEvent; installDismissed = false; };
    const appInstalled = () => { installed = true; prompt = null; manualInstructions = false; };
    const offline = () => { message = navigator.onLine ? '' : m.pwa_offline(); };
    const ready = () => navigator.serviceWorker.controller?.postMessage({ type: 'trick-it:client-ready', appVersion: version });
    const controllerChanged = () => {
      controlled = true; refresh = true; waiting = null;
      installingWorker = false; installProgress = null;
      updateDismissed = false; ready();
    };
    const failed = (event: MessageEvent) => {
      const source = event.source;
      if (!source || !('scriptURL' in source) || source.scriptURL !== new URL(`${base}/service-worker.js`, location.origin).href) return;
      if (event.data?.type === 'trick-it:version-request') source.postMessage({ type: 'trick-it:client-ready', appVersion: version });
      if (event.data?.type === 'trick-it:install-progress') {
        const { completed, total } = event.data;
        if (Number.isSafeInteger(completed) && Number.isSafeInteger(total) &&
            total > 0 && total <= 10_000 && completed >= 0 && completed <= total) {
          installProgress = { completed, total };
        }
      }
    };
    window.addEventListener('beforeinstallprompt', install);
    window.addEventListener('appinstalled', appInstalled);
    window.addEventListener('offline', offline);
    window.addEventListener('online', offline);
    offline();
    if (!dev && 'serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.addEventListener('controllerchange', controllerChanged);
      navigator.serviceWorker.addEventListener('message', failed);
      const register = () => { void navigator.serviceWorker.register(`${base}/service-worker.js`, { scope: `${base}/`, updateViaCache: 'none' }).then((registration) => {
        if (disposed) return;
        waiting = registration.waiting;
        if (waiting) updateDismissed = false;
        ready();
        const watch = () => {
          const worker = registration.installing;
          if (!worker) return;
          const state = () => {
            installingWorker = worker.state === 'installing' && Boolean(navigator.serviceWorker.controller);
            if (worker.state === 'installed' && navigator.serviceWorker.controller && registration.waiting) {
              waiting = registration.waiting; updateDismissed = false;
            }
            if (worker.state === 'redundant') { installingWorker = false; installProgress = null; }
          };
          worker.addEventListener('statechange', state);
          state();
          cleanup.push(() => worker.removeEventListener('statechange', state));
        };
        registration.addEventListener('updatefound', watch);
        cleanup.push(() => registration.removeEventListener('updatefound', watch));
        watch();
      }).catch((error) => { if (!disposed) console.warn('[trick-it] Service worker registration failed', error); }); };
      // Do not compete with the first page's image/font loading.
      if (document.readyState === 'complete') register();
      else window.addEventListener('load', register, { once: true });
      cleanup.push(() => window.removeEventListener('load', register));
    }
    return () => {
      disposed = true;
      window.removeEventListener('beforeinstallprompt', install);
      window.removeEventListener('appinstalled', appInstalled);
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', offline);
      navigator.serviceWorker?.removeEventListener('controllerchange', controllerChanged);
      navigator.serviceWorker?.removeEventListener('message', failed);
      for (const remove of cleanup) remove();
    };
  });

  // A homepage/catalog has no running tool frame. Apply newly published tools
  // without forcing visitors to clear caches or click an update button. When a
  // tool is open, or a search/modal is in use, the normal approval UI remains.
  let automaticAttempted = false;
  $effect(() => {
    if (!hasUpdate) { automaticAttempted = false; return; }
    if (automaticAttempted || updating || updateError || updateDismissed || !navigator.onLine || document.visibilityState !== 'visible') return;
    const focused = document.activeElement;
    const busyWithInput = Boolean(focused?.matches('input, textarea, select, [contenteditable], [contenteditable] *') || document.querySelector('dialog[open], [aria-modal="true"]'));
    if (!canAutoRefreshCatalog(location.pathname, base, busyWithInput)) return;
    automaticAttempted = true;
    void prepareUpdate();
  });

  async function prepareUpdate() {
    if (updating) return;
    if (!navigator.onLine) { updateError = m.pwa_update_offline(); return; }
    updating = true;
    updateError = '';
    if (!installingWorker) installProgress = null;
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration) await applyPwaUpdate(registration);
      // The browser keeps the installed PWA window open. Reload this window
      // only after the new shell is fully installed and activated.
      location.reload();
    } catch (error) {
      console.warn('[trick-it] Update failed', error);
      updateError = m.pwa_update_failed();
    } finally {
      updating = false;
    }
  }

  async function install() {
    if (!prompt) { manualInstructions = true; return; }
    // Keep the one-shot event locally: appinstalled may clear shared state while it resolves.
    const offer = prompt;
    prompt = null;
    try {
      await offer.prompt();
      const choice = await offer.userChoice;
      if (choice.outcome === 'accepted') installed = true;
      else installDismissed = true;
    } catch { manualInstructions = true; }
  }
</script>


{#if hasUpdate && !updateDismissed}
  <aside class="pwa-card pwa-update" role="region" aria-label={m.pwa_update()}>
    <div class="pwa-icon" aria-hidden="true">✦</div>
    <div class="pwa-copy">
      <strong>{updateBusy ? m.pwa_updating_title() : readyToReload ? m.pwa_ready_title() : m.pwa_update()}</strong>
      <p aria-live="polite">{updateError || (updateBusy ? updateDetail() : readyToReload ? m.pwa_ready() : m.pwa_update_description())}</p>
      {#if updateBusy}
        <progress class="pwa-progress" aria-label={m.pwa_update_progress()} max={installProgress?.total ?? 1} value={installProgress?.completed}></progress>
      {/if}
      <div class="pwa-actions" aria-busy={updateBusy}>
        {#if updateBusy}
          <button class="clay-button primary small" type="button" disabled>{m.pwa_updating()}</button>
        {:else if readyToReload}
          <button class="clay-button primary small" type="button" onclick={() => location.reload()}>{m.pwa_reload()}</button>
        {:else}
          <button class="clay-button primary small" type="button" onclick={prepareUpdate}>{updateError ? m.pwa_retry() : m.pwa_activate()}</button>
        {/if}
        {#if !updateBusy}
          <button class="pwa-quiet" type="button" onclick={() => updateDismissed = true}>{m.pwa_later()}</button>
        {/if}
      </div>
    </div>
    {#if !updateBusy}
      <button class="pwa-close" type="button" aria-label={m.pwa_later()} onclick={() => updateDismissed = true}>×</button>
    {/if}
  </aside>
{:else if hasUpdate}
  <button type="button" class="pwa-mini" onclick={() => updateDismissed = false}>✦ {readyToReload ? m.pwa_ready_title() : m.pwa_update()}</button>
{:else if showInstall}
  <aside class="pwa-card pwa-install" aria-label={m.pwa_title()}>
    <div class="pwa-copy">
      <strong>{m.pwa_install_title()}</strong>
      <p>{m.pwa_install_description()}</p>
    </div>
    <button class="clay-button primary small pwa-install-button" type="button" onclick={install}>{m.pwa_install()}</button>
    <button class="pwa-close" type="button" aria-label={m.pwa_later()} onclick={() => installDismissed = true}>×</button>
  </aside>
{/if}

{#if manualInstructions && !installed}
  <div class="pwa-shade">
    <div class="pwa-manual" role="dialog" aria-modal="true" aria-labelledby="pwa-manual-title">
      <h2 id="pwa-manual-title">{m.pwa_install_title()}</h2>
      <p>{m.pwa_manual()}</p>
      <button class="clay-button primary" type="button" onclick={() => manualInstructions = false}>{m.pwa_close()}</button>
    </div>
  </div>
{/if}

{#if message}<p class="pwa-message" role="status">{message}</p>{/if}

<style>
  .pwa-card, .pwa-mini, .pwa-message { position: fixed; z-index: 65; right: max(14px, env(safe-area-inset-right)); bottom: max(18px, env(safe-area-inset-bottom)); }
  .pwa-card { display: flex; align-items: center; gap: 14px; width: min(465px, calc(100vw - 28px)); border: 1px solid var(--line); border-radius: 22px; padding: 18px 46px 18px 18px; background: var(--surface); color: var(--text); box-shadow: 0 6px 0 -2px var(--line), 0 20px 45px var(--shadow); backdrop-filter: blur(14px); }
  .pwa-copy { min-width: 0; flex: 1; }
  .pwa-copy strong { display: block; font-size: 16px; font-weight: 900; line-height: 1.2; }
  .pwa-copy p { font-size: 13px; color: var(--text-secondary); margin-top: 6px; line-height: 1.55; }
  .pwa-progress { display: block; width: 100%; height: 8px; margin-top: 10px; border: 0; border-radius: 999px; overflow: hidden; accent-color: var(--accent-strong); }
  .pwa-progress::-webkit-progress-bar { background: var(--line); border-radius: 999px; }
  .pwa-progress::-webkit-progress-value { background: var(--accent-strong); border-radius: 999px; }
  .pwa-progress::-moz-progress-bar { background: var(--accent-strong); border-radius: 999px; }
  .pwa-icon { display: grid; place-items: center; flex: none; width: 40px; height: 40px; border-radius: 14px; background: var(--peach); color: var(--accent-strong); font-size: 24px; }
  .pwa-install-button { flex: none; white-space: nowrap; }
  .pwa-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 12px; }
  .pwa-quiet { min-height: 44px; border: 0; background: transparent; color: var(--text-secondary); border-radius: 12px; padding: 8px 10px; font-size: 13px; font-weight: 800; }
  .pwa-quiet:hover { background: var(--peach); }
  .pwa-close { position: absolute; right: 7px; top: 7px; width: 40px; height: 40px; border: 0; background: transparent; color: var(--muted); border-radius: 12px; font-size: 24px; line-height: 1; }
  .pwa-close:hover { background: var(--peach); }
  .pwa-mini { display: inline-flex; align-items: center; gap: 8px; padding: 11px 15px; min-height: 44px; border: 1px solid var(--line); border-radius: 15px; background: var(--accent); color: var(--on-accent); font-weight: 850; box-shadow: var(--clay-shadow); }
  .pwa-shade { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; background: rgba(0, 0, 0, .45); padding: 20px; }
  .pwa-manual { display: grid; gap: 18px; width: min(430px, 100%); border: 1px solid var(--line); border-radius: 22px; padding: 24px; background: var(--surface); color: var(--text); box-shadow: var(--clay-shadow); }
  .pwa-manual h2 { font-size: 23px; }
  .pwa-manual p { font-size: 14px; line-height: 1.65; color: var(--text-secondary); }
  .pwa-message { bottom: 105px; max-width: min(430px, calc(100vw - 28px)); padding: 10px 14px; background: var(--surface); color: var(--text-secondary); border: 1px solid var(--line); border-radius: 12px; font-size: 13px; }
  @media (max-width: 520px) {
    .pwa-card { align-items: flex-start; flex-wrap: wrap; padding: 16px 45px 16px 16px; }
    .pwa-install-button { width: 100%; }
    .pwa-install .pwa-copy { flex-basis: 100%; }
    .pwa-update .pwa-icon { width: 36px; height: 36px; }
    .pwa-update .pwa-copy { flex: 1; }
  }
</style>
