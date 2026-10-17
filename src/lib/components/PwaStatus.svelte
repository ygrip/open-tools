<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { dev, version } from '$app/environment';
  import { m } from '$lib/paraglide/messages.js';
  type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
  let prompt = $state<InstallEvent | null>(null);
  let waiting = $state<ServiceWorker | null>(null);
  let refresh = $state(false);
  let installed = $state(false);
  let message = $state('');

  onMount(() => {
    let disposed = false;
    const cleanup: (() => void)[] = [];
    installed = matchMedia('(display-mode: standalone)').matches;
    const install = (event: Event) => { event.preventDefault(); prompt = event as InstallEvent; };
    const appInstalled = () => { installed = true; prompt = null; };
    const offline = () => { message = navigator.onLine ? '' : m.pwa_offline(); };
    const ready = () => navigator.serviceWorker.controller?.postMessage({ type: 'trick-it:client-ready', appVersion: version });
    const controllerChanged = () => { refresh = true; waiting = null; message = m.pwa_ready(); ready(); };
    const failed = (event: MessageEvent) => {
      const source = event.source;
      if (!source || !('scriptURL' in source) || source.scriptURL !== new URL(`${base}/service-worker.js`, location.origin).href) return;
      if (event.data?.type === 'trick-it:cache-failed') message = m.pwa_failed();
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
        ready();
        const watch = () => {
          const worker = registration.installing;
          if (!worker) return;
          const state = () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) waiting = registration.waiting;
            if (worker.state === 'redundant') message = m.pwa_failed();
          };
          worker.addEventListener('statechange', state);
          cleanup.push(() => worker.removeEventListener('statechange', state));
        };
        registration.addEventListener('updatefound', watch);
        cleanup.push(() => registration.removeEventListener('updatefound', watch));
        watch();
      }).catch(() => { if (!disposed) message = m.pwa_failed(); }); };
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

  async function install() {
    if (!prompt) { message = m.pwa_manual(); return; }
    try {
      await prompt.prompt();
      installed = (await prompt.userChoice).outcome === 'accepted';
      prompt = null;
    } catch { message = m.pwa_manual(); }
  }
</script>

<aside class="pwa-status" aria-label={m.pwa_title()}>
  {#if !installed}<button class="clay-button small" type="button" onclick={install}>{m.pwa_install()}</button>{/if}
  {#if waiting}<span>{m.pwa_update()}</span><button class="clay-button small" type="button" onclick={() => waiting?.postMessage({ type: 'trick-it:activate', version: 1 })}>{m.pwa_activate()}</button>{/if}
  {#if refresh}<button class="clay-button small" type="button" onclick={() => location.reload()}>{m.pwa_reload()}</button>{/if}
  {#if message}<p role="status">{message}</p>{/if}
</aside>

<style>
  .pwa-status { width: min(1160px, calc(100% - 32px)); margin: 12px auto 28px; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; font-size: 13px; color: var(--muted); }
  p { max-width: 70ch; }
</style>
