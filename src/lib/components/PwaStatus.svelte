<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { updated } from '$app/state';
  import { dev, version } from '$app/environment';
  import { m } from '$lib/paraglide/messages.js';
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
  let updateDismissed = $state(false);
  let installDismissed = $state(false);
  let manualInstructions = $state(false);
  // Only offer install where it helps: a phone/tablet browser tab that can actually install (native prompt, or iOS Add to Home Screen).
  // Chromium may offer native installation on desktop; iOS needs manual guidance.
  const showInstall = $derived(!installed && !installDismissed && (prompt !== null || (mobile && iosSafari)));
  const hasUpdate = $derived(waiting !== null || refresh || spaUpdate || updated.current);
  // A controlling worker may still serve an old offline shell. Activate it before reloading.
  const readyToReload = $derived(refresh || (!controlled && !waiting && (spaUpdate || updated.current)));

  onMount(() => {
    let disposed = false;
    const cleanup: (() => void)[] = [];
    // SvelteKit version polling covers SPA-only releases; the worker owns offline-shell updates.
    let lastVersionCheck = Date.now();
    const checkSpaVersion = () => {
      if (disposed || dev || !navigator.onLine || document.visibilityState !== 'visible' || Date.now() - lastVersionCheck < 60_000) return;
      lastVersionCheck = Date.now();
      void updated.check().then((isNew) => {
        if (!disposed && isNew) {
          spaUpdate = true; updateDismissed = false;
          if (navigator.serviceWorker?.controller) void navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {});
        }
      }).catch(() => { /* Offline version checks must not interrupt a tool. */ });
    };
    window.addEventListener('focus', checkSpaVersion);
    document.addEventListener('visibilitychange', checkSpaVersion);
    const versionTimer = window.setInterval(checkSpaVersion, 5 * 60_000);
    cleanup.push(() => {
      window.removeEventListener('focus', checkSpaVersion);
      document.removeEventListener('visibilitychange', checkSpaVersion);
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
    const controllerChanged = () => { controlled = true; refresh = true; waiting = null; updateDismissed = false; ready(); };
    const failed = (event: MessageEvent) => {
      const source = event.source;
      if (!source || !('scriptURL' in source) || source.scriptURL !== new URL(`${base}/service-worker.js`, location.origin).href) return;
      if (event.data?.type === 'trick-it:version-request') source.postMessage({ type: 'trick-it:client-ready', appVersion: version });
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
            if (worker.state === 'installed' && navigator.serviceWorker.controller && registration.waiting) { waiting = registration.waiting; updateDismissed = false; }
          };
          worker.addEventListener('statechange', state);
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

  async function prepareUpdate() {
    if (waiting) { waiting.postMessage({ type: 'trick-it:activate', version: 1 }); return; }
    try {
      const registration = await navigator.serviceWorker?.getRegistration();
      if (registration) {
        await registration.update();
        if (registration.waiting) { waiting = registration.waiting; updateDismissed = false; }
      }
    } catch (error) { console.warn('[trick-it] Update failed', error); }
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
      <strong>{readyToReload ? m.pwa_ready_title() : m.pwa_update()}</strong>
      <p>{readyToReload ? m.pwa_ready() : m.pwa_update_description()}</p>
      <div class="pwa-actions">
        {#if waiting}
          <button class="clay-button primary small" type="button" onclick={prepareUpdate}>{m.pwa_activate()}</button>
        {:else if readyToReload}
          <button class="clay-button primary small" type="button" onclick={() => location.reload()}>{m.pwa_reload()}</button>
        {:else if spaUpdate || updated.current}
          <button class="clay-button primary small" type="button" onclick={prepareUpdate}>{m.pwa_activate()}</button>
        {/if}
        <button class="pwa-quiet" type="button" onclick={() => updateDismissed = true}>{m.pwa_later()}</button>
      </div>
    </div>
    <button class="pwa-close" type="button" aria-label={m.pwa_later()} onclick={() => updateDismissed = true}>×</button>
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
