<script lang="ts">
  import { base } from '$app/paths';
  import { languages } from '$lib/languages.js';
  let { locale, size = 28 }: { locale: string; size?: number } = $props();
  const flag = $derived(languages.find((item) => item.code === locale)?.flag ?? '🌐');
</script>

{#if locale === 'en' || locale === 'id'}
  <img class="clay-flag" src={base + '/brand/flag-' + locale + '.svg'}
    width={size} height={Math.round(size * 0.7)} alt="" aria-hidden="true" draggable="false" />
{:else}
  <span class="clay-flag flag-emoji" aria-hidden="true" style:font-size={Math.round(size * .78) + 'px'}
    style:width={size + 'px'} style:height={Math.round(size * .76) + 'px'}>{flag}</span>
{/if}

<style>
  .clay-flag { display: block; flex: 0 0 auto; filter: drop-shadow(0 1.5px 1px rgb(45 35 38 / .24)); transform: rotate(-2deg); }
  .flag-emoji { display: inline-grid; place-items: center; line-height: 1; border-radius: 5px; background: var(--surface); box-shadow: inset 0 1px 1px rgb(255 255 255 / .6), 0 2px 2px rgb(45 35 38 / .12); overflow: hidden; }
  @media (forced-colors: active) { .clay-flag { filter: none; } }
</style>
