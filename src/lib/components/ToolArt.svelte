<script lang="ts">
  import config from '$lib/seo/generated.json';
  import Icon from './Icon.svelte';
  import type { ToolIcon } from '$lib/registry/types';

  /** Host-owned clay art per tool, falling back to the manifest's line icon. */
  let { id, icon, size = 56, eager = false }: { id: string; icon: ToolIcon; size?: number; eager?: boolean } = $props();
  const icons: Record<string, string> = (config as { icons?: Record<string, string> }).icons ?? {};
  const src = $derived(icons[id]);
  let failed = $state(false);
</script>

{#if src && !failed}
  <img class="tool-art" {src} width={size} height={size} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" onerror={() => failed = true} />
{:else}
  <span class="clay-icon peach"><Icon name={icon} size={Math.round(size * 0.54)} /></span>
{/if}

<style>
  .tool-art { display: block; flex-shrink: 0; object-fit: contain; filter: drop-shadow(0 4px 6px rgb(67 46 32 / .14)); }
</style>
