<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { getLocale, locales } from '$lib/paraglide/runtime.js';
  import { localizedPath } from '$lib/i18n';
  import { m } from '$lib/paraglide/messages.js';

  let { dropdown = false }: { dropdown?: boolean } = $props();
  const labels: Record<string, string> = { en: 'English', id: 'Bahasa Indonesia' };
  const flags: Record<string, string> = { en: '🇬🇧', id: '🇮🇩' };
  let details: HTMLDetailsElement | undefined;

  function href(locale: (typeof locales)[number]) {
    return `${localizedPath(page.url.pathname, locale)}${browser ? page.url.search + page.url.hash : ''}`;
  }

  function outside(event: MouseEvent) {
    if (dropdown && details?.open && !details.contains(event.target as Node)) details.open = false;
  }

  function escape(event: KeyboardEvent) {
    if (details?.open && event.key === 'Escape') {
      event.preventDefault();
      details.open = false;
      details.querySelector('summary')?.focus();
    }
  }
</script>

<svelte:window onclick={outside} />

{#snippet options()}
  {#each locales as locale}
    <a href={href(locale)} aria-label={`${locale.toUpperCase()} ${labels[locale]}`}
      aria-current={getLocale() === locale ? 'page' : undefined}
      hreflang={locale} lang={locale} data-sveltekit-reload>
      <span class="language-flag" aria-hidden="true">{flags[locale]}</span>
      <span class="language-code">{locale.toUpperCase()}</span>
      <span class="language-label">{labels[locale]}</span>
      {#if getLocale() === locale}<span class="language-check" aria-hidden="true">✓</span>{/if}
    </a>
  {/each}
{/snippet}

<nav class="language-switcher" class:language-dropdown={dropdown} aria-label={m.languages()}>
  {#if dropdown}
    <details bind:this={details} onkeydown={escape}>
      <summary class="language-trigger" aria-label={`${m.languages()}: ${labels[getLocale()]}`}>
        <span class="language-flag" aria-hidden="true">{flags[getLocale()]}</span>
        <span class="language-caret" aria-hidden="true">⌄</span>
      </summary>
      <div class="language-menu">{@render options()}</div>
    </details>
  {:else}
    {@render options()}
  {/if}
</nav>

<style>
  .language-switcher { display: flex; align-items: center; gap: 2px; padding: 4px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); white-space: nowrap; }
  .language-switcher:not(.language-dropdown) a { min-width: 40px; min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 3px; padding: 0 3px; border-radius: 10px; font-size: 11px; font-weight: 850; color: var(--muted); text-decoration: none; }
  .language-switcher:not(.language-dropdown) a[aria-current='page'] { background: var(--peach); color: var(--text); }
  .language-flag { font-family: system-ui, sans-serif; font-size: 19px; line-height: 1; }
  .language-code { font-size: 10px; }
  .language-switcher:not(.language-dropdown) .language-label, .language-switcher:not(.language-dropdown) .language-check { display: none; }
  .language-dropdown .language-code { display: none; }
  .language-switcher a:focus-visible, .language-trigger:focus-visible { outline: 2px solid var(--accent-strong); outline-offset: 2px; }
  .language-dropdown { position: relative; padding: 0; border: 0; background: transparent; }
  .language-trigger { list-style: none; min-width: 48px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 3px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); color: var(--text); box-shadow: 0 3px 0 var(--line), inset 1px 2px 2px var(--highlight); cursor: pointer; }
  .language-trigger::-webkit-details-marker { display: none; }
  .language-caret { margin-top: -5px; font-size: 17px; color: var(--muted); }
  .language-menu { position: absolute; top: calc(100% + 10px); right: 0; z-index: 90; width: 214px; padding: 7px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); color: var(--text); box-shadow: 0 10px 26px var(--shadow); }
  .language-menu a { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 8px 11px; border-radius: 11px; color: var(--text); text-decoration: none; font-size: 13px; font-weight: 800; }
  .language-menu a:hover, .language-menu a[aria-current='page'] { background: var(--peach); }
  .language-label { flex: 1; }
  .language-check { color: var(--accent-strong); }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
