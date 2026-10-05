<script lang="ts">
  import { onMount } from 'svelte';

  let theme = $state<'light' | 'dark'>('dark');

  function apply(next: 'light' | 'dark') {
    theme = next;
    document.documentElement.dataset.theme = next;
    localStorage.setItem('open-tools-theme', next);
  }

  onMount(() => {
    const current = document.documentElement.dataset.theme;
    theme = current === 'light' ? 'light' : 'dark';
  });

  function toggle() {
    apply(theme === 'dark' ? 'light' : 'dark');
  }
</script>

<button class="theme-toggle" type="button" onclick={toggle} aria-label="Switch to {theme === 'dark' ? 'light' : 'dark'} theme" title="Switch theme">
  {#if theme === 'dark'}
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>
  {:else}
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
  {/if}
</button>
