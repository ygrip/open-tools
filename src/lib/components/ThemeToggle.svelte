<script lang="ts">
  import { onMount } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { applyTheme, documentTheme, type Theme } from '$lib/theme';

  let theme = $state<Theme>('light');
  let storageNotice = $state('');

  onMount(() => {
    const sync = () => { theme = documentTheme(document); };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  });

  function toggle() {
    const next = documentTheme(document) === 'dark' ? 'light' : 'dark';
    theme = next;
    const persisted = applyTheme(document, next);
    storageNotice = persisted ? '' : m.theme_unsaved();
  }
</script>

<button class="theme-toggle clay-button" type="button" onclick={toggle} aria-label="{m.theme_switch()} {theme === 'dark' ? m.theme_light() : m.theme_dark()} {m.theme_theme()}" title="{m.theme_switch()} {theme === 'dark' ? m.theme_light() : m.theme_dark()} {m.theme_theme()}">
  <span class="t-icon-swap" data-state={theme === 'dark' ? 'a' : 'b'} aria-hidden="true">
    <span class="t-icon" data-icon="a">
      <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>
    </span>
    <span class="t-icon" data-icon="b">
      <svg viewBox="0 0 24 24" width="22" height="22"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
    </span>
  </span>
</button>
{#if storageNotice}<span class="theme-storage-notice" role="status">{storageNotice}</span>{/if}

<style>
  .theme-toggle { display: inline-grid; place-items: center; width: 48px; height: 48px; padding: 0; flex: 0 0 auto; }
  .t-icon { line-height: 0; }
  .theme-storage-notice { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
</style>
