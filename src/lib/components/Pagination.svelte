<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { getPagination } from '$lib/pagination.js';

  let { totalItems, pageSize, currentPage, onPageChange }: {
    totalItems: number;
    pageSize: number;
    currentPage: number;
    onPageChange: (page: number) => void;
  } = $props();

  const pagination = $derived(getPagination(totalItems, pageSize, currentPage));
</script>

{#if totalItems > 0}
  <nav class="pagination" aria-label={m.pagination_label()}>
    <p class="range" role="status">{m.pagination_showing()} {pagination.start}–{pagination.end} {m.pagination_of()} {totalItems} {totalItems === 1 ? m.pagination_tool() : m.pagination_tools()}</p>
    <div class="page-controls">
      <button class="clay-button direction" type="button" aria-label={m.pagination_previous_page()} disabled={!pagination.hasPrevious} onclick={() => onPageChange(pagination.page - 1)}>
        <Icon name="arrow-left" size={18} /><span>{m.pagination_previous()}</span>
      </button>
      <div class="page-numbers">
        {#each pagination.pages as number, index (typeof number === 'number' ? number : `ellipsis-${index}`)}
          {#if number === 'ellipsis'}
            <span class="ellipsis" aria-hidden="true">…</span>
          {:else}
            <button class="clay-button page-number" class:current={number === pagination.page} type="button" aria-label={`${m.pagination_page()} ${number}`} aria-current={number === pagination.page ? 'page' : undefined} onclick={() => onPageChange(number)}>{number}</button>
          {/if}
        {/each}
      </div>
      <span class="compact-page">{m.pagination_page()} {pagination.page} {m.pagination_of()} {pagination.totalPages}</span>
      <button class="clay-button direction" type="button" aria-label={m.pagination_next_page()} disabled={!pagination.hasNext} onclick={() => onPageChange(pagination.page + 1)}>
        <span>{m.pagination_next()}</span><Icon name="arrow-right" size={18} />
      </button>
    </div>
  </nav>
{/if}

<style>
  .pagination { display: grid; justify-items: center; gap: 14px; margin-top: 28px; }
  .range { color: var(--muted); font-size: 14px; text-align: center; }
  .page-controls, .page-numbers { display: flex; align-items: center; justify-content: center; gap: 8px; }
  .page-controls { flex-wrap: wrap; width: 100%; }
  .pagination button { min-width: 44px; min-height: 44px; padding: 10px 14px; font-size: 14px; border-radius: 15px; }
  .page-number { padding-inline: 10px; }
  .page-number.current { background: var(--peach); border-color: var(--accent-strong); }
  .pagination button:disabled { cursor: not-allowed; opacity: .55; }
  .ellipsis { display: grid; place-items: center; min-width: 20px; color: var(--muted); }
  .compact-page { display: none; font-size: 14px; font-weight: 800; text-align: center; }

  @media (max-width: 760px) {
    .page-numbers { display: none; }
    .compact-page { display: block; }
    .page-controls { justify-content: space-between; gap: 8px; }
  }

  @media (max-width: 380px) {
    .direction span { display: none; }
    .pagination .direction { width: 44px; padding: 10px; }
  }
</style>
