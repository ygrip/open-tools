<script lang="ts">
  import type { ToolManifest } from '$lib/registry/types';

  let { open = $bindable(false), tools }: { open?: boolean; tools: ToolManifest[] } = $props();

  let inputEl = $state<HTMLInputElement | null>(null);
  let query = $state('');

  const results = $derived(
    query.trim().length === 0
      ? tools.slice(0, 8)
      : tools.filter((tool) =>
          [tool.name, tool.description, tool.category, ...(tool.capabilities ?? [])]
            .join(' ')
            .toLowerCase()
            .includes(query.trim().toLowerCase())
        ).slice(0, 10)
  );

  $effect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => inputEl?.focus(), 40);
    } else {
      document.body.style.overflow = '';
      query = '';
    }
  });

  function close() {
    open = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') close();
  }
</script>

{#if open}
  <div class="search-overlay" role="dialog" aria-modal="true" aria-label="Search tools" onkeydown={handleKeydown}>
    <button class="search-backdrop" aria-label="Close search" onclick={close}></button>

    <div class="search-panel surface">
      <div class="search-panel-header">
        <span aria-hidden="true">⌕</span>
        <input
          bind:this={inputEl}
          bind:value={query}
          type="search"
          placeholder="Search tools, formats, capabilities…"
          autocomplete="off"
          aria-label="Search tools"
        />
        <button type="button" class="search-kbd" onclick={close}>Esc</button>
      </div>

      <div class="search-results">
        {#if results.length}
          {#each results as tool}
            <a class="search-result" href={tool.path} onclick={close}>
              <span class="search-result-icon">{tool.icon ?? tool.name.slice(0, 2).toUpperCase()}</span>
              <span class="search-result-copy">
                <strong>{tool.name}</strong>
                <small>{tool.description}</small>
              </span>
              <span class="search-result-meta">{tool.category}</span>
            </a>
          {/each}
        {:else}
          <div class="search-empty">
            No tools match “{query}”.
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
