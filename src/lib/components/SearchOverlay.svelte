<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { localizedPath } from '$lib/i18n';
  import Icon from './Icon.svelte';
  import type { ToolManifest } from '$lib/registry/types';

  let { open = $bindable(false), tools }: { open?: boolean; tools: ToolManifest[] } = $props();
  let dialog = $state<HTMLDialogElement | null>(null);
  let input = $state<HTMLInputElement | null>(null);
  let query = $state('');
  let phase = $state('');
  let returnFocus: HTMLElement | null = null;
  const results = $derived(tools.filter((tool) => [tool.name, tool.description, tool.category, ...tool.capabilities].join(' ').toLowerCase().includes(query.trim().toLowerCase())).slice(0, 10));

  $effect(() => {
    const node = dialog;
    if (!node) return;
    if (open) {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const overflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      if (!node.open) node.showModal();
      const frame = requestAnimationFrame(() => { phase = 'is-open'; input?.focus(); });
      return () => { cancelAnimationFrame(frame); document.body.style.overflow = overflow; };
    }
    if (!node.open) return;
    phase = 'is-closing';
    const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : parseFloat(getComputedStyle(node).getPropertyValue('--modal-close-dur')) || 150;
    const timer = setTimeout(() => {
      node.close();
      phase = '';
      query = '';
      if (returnFocus?.isConnected) returnFocus.focus();
    }, delay);
    return () => clearTimeout(timer);
  });

  // A stale native `close` event can arrive after the dialog was re-opened (e.g. fast Escape then `/`); ignore it while open.
  function close() { open = false; }
</script>

<dialog bind:this={dialog} class="search-dialog surface t-modal {phase}" aria-label={m.search_label()} onkeydown={(event) => { if (event.key === 'Escape') { event.preventDefault(); close(); } }} oncancel={(event) => { event.preventDefault(); close(); }} onclick={(event) => { if (event.target === dialog) close(); }} onclose={() => { if (!dialog?.open) close(); }}>
  <div class="search-panel-header">
    <Icon name="search" />
    <input bind:this={input} bind:value={query} type="search" placeholder={m.overlay_placeholder()} autocomplete="off" aria-label="Search tools" />
    <button type="button" class="icon-button" aria-label={m.overlay_close()} onclick={close}><Icon name="x" size={18} /></button>
  </div>
  <div class="search-results">
    {#each results as tool}
      <a class="search-result" href={localizedPath(`${tool.path}/`)} onclick={close}><span class="clay-icon peach"><Icon name="braces" size={24} /></span><span class="search-result-copy"><strong>{tool.name}</strong><small>{tool.description}</small></span><Icon name="arrow-right" size={20} /></a>
    {:else}
      <div class="search-empty"><strong>{m.overlay_empty_prefix()} “{query}” {m.overlay_empty_suffix()}</strong><p>{m.overlay_empty_tip()}</p></div>
    {/each}
  </div>
  <p class="search-tip">{m.overlay_tip()}</p>
</dialog>
