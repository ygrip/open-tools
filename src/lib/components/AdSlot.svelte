<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { adsConfig } from '$lib/ads/settings.js';
  import { canRequestAd, requestAd } from '$lib/ads/client';

  let { placement }: { placement: 'home' | 'tool' } = $props();
  const slot = $derived(adsConfig.placements[placement]);
  let element = $state<HTMLElement>();
  const testAttribute = $derived.by(() => {
    if (adsConfig.testMode) return 'on';
    return undefined;
  });

  $effect(() => {
    if (!adsConfig.enabled || !slot || !element) return;
    const ad = element;
    let pending = false;
    let finished = false;
    const observer = new ResizeObserver(() => initialize());
    const visibility = new MutationObserver(() => initialize());
    function disconnect() {
      observer.disconnect();
      visibility.disconnect();
    }
    function initialize() {
      if (pending || finished || !canRequestAd(ad)) return;
      pending = true;
      void requestAd(ad, adsConfig.client).then((requested) => {
        pending = false;
        if (requested) {
          finished = true;
          disconnect();
        }
      }).catch((error) => {
        finished = true;
        disconnect();
        // Ad blockers and provider failures must never prevent a tool from loading.
        console.warn('Optional advertising could not start', error);
      });
    }
    observer.observe(ad);
    visibility.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open'] });
    initialize();
    return disconnect;
  });
</script>

{#if adsConfig.enabled && slot}
  <aside class="ad-placement" aria-label={m.ads_label()} data-ad-placement={placement}>
    <span class="ad-label">{m.ads_label()}</span>
    <ins bind:this={element} class="adsbygoogle" data-ad-client={adsConfig.client} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" data-adtest={testAttribute}></ins>
  </aside>
{/if}

<style>
  .ad-placement { min-width: 0; margin-block: 40px; padding: 16px; border-block: 1px solid var(--line); }
  .ad-label { display: block; margin-bottom: 12px; color: var(--muted); font-size: 12px; text-align: center; }
  .adsbygoogle { display: block; width: 100%; min-height: 250px; }
</style>
