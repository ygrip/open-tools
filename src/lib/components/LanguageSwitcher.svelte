<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { getLocale, locales } from '$lib/paraglide/runtime.js';
  import { localizedPath } from '$lib/i18n';
  import { m } from '$lib/paraglide/messages.js';

  // Reuse one selector on desktop and the existing compact choices in mobile quick settings.
  let { dropdown = false }: { dropdown?: boolean } = $props();
  const labels: Record<string, string> = { en: 'English', id: 'Bahasa Indonesia' };
  const flags: Record<string, string> = { en: '🇬🇧', id: '🇮🇩' };
  const uid = $props.id();
  const listId = `${uid}-languages`;
  let open = $state(false);
  let root: HTMLElement | undefined;
  let trigger: HTMLButtonElement | undefined;

  function localeHref(locale: (typeof locales)[number]) {
    return `${localizedPath(page.url.pathname, locale)}${browser ? page.url.search + page.url.hash : ''}`;
  }

  function onOutsideClick(event: MouseEvent) {
    if (dropdown && open && root && !root.contains(event.target as Node)) open = false;
  }

  function onKeydown(event: KeyboardEvent) {
    if (!dropdown || !open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      open = false;
      trigger?.focus();
    }
  }
</script>

<svelte:window onclick={onOutsideClick} onkeydown={onKeydown} />

<nav bind:this={root} class="language-switcher" class:language-dropdown={dropdown} aria-label={m.languages()}>
  {#if dropdown}
    <button
      bind:this={trigger}
      class="language-trigger"
      type="button"
      aria-label={`${m.languages()}: ${labels[getLocale()]}`}
      aria-expanded={open}
      aria-controls={listId}
      onclick={() => (open = !open)}
    >
      <span class="language-flag" aria-hidden="true">{flags[getLocale()]}</span>
      <span class="language-caret" aria-hidden="true">⌄</span>
    </button>
    {#if open}
      <div class="language-menu" id={listId}>
        {#each locales as locale}
          <a
            href={localeHref(locale)}
            aria-current={getLocale() === locale ? 'page' : undefined}
            hreflang={locale}
            lang={locale}
            data-sveltekit-reload
            onclick={() => (open = false)}
          >
            <span class="language-flag" aria-hidden="true">{flags[locale]}</span>
            <span class="language-label">{labels[locale]}</span>
            {#if getLocale() === locale}<span class="language-check" aria-hidden="true">✓</span>{/if}
          </a>
        {/each}
      </div>
    {/if}
  {:else}
    {#each locales as locale}
      <a
        href={localeHref(locale)}
        aria-current={getLocale() === locale ? 'page' : undefined}
        hreflang={locale}
        lang={locale}
        data-sveltekit-reload
      >
        <span class="language-flag" aria-hidden="true">{flags[locale]}</span>
        <span class="language-code">{locale.toUpperCase()}</span>
        <span class="sr-only"> {labels[locale]}</span>
      </a>
    {/each}
  {/if}
</nav>

<style>
  .language-switcher { display: flex; align-items: center; gap: 2px; padding: 4px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); white-space: nowrap; }
  .language-switcher:not(.language-dropdown) a { min-width: 40px; min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 3px; padding: 0 3px; border-radius: 10px; font-size: 11px; font-weight: 850; color: var(--muted); text-decoration: none; }
  .language-switcher:not(.language-dropdown) a[aria-current='page'] { background: var(--peach); color: var(--text); }
  .language-flag { font-family: system-ui, sans-serif; font-size: 19px; line-height: 1; }
  .language-code { font-size: 10px; }
  .language-switcher a:focus-visible, .language-trigger:focus-visible { outline: 2px solid var(--accent-strong); outline-offset: 2px; }
  .language-dropdown { position: relative; padding: 0; border: 0; background: transparent; }
  .language-trigger { min-width: 48px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 3px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); color: var(--text); box-shadow: 0 3px 0 var(--line), inset 1px 2px 2px var(--highlight); cursor: pointer; }
  .language-caret { margin-top: -5px; font-size: 17px; color: var(--muted); }
  .language-menu { position: absolute; top: calc(100% + 10px); right: 0; z-index: 90; width: 214px; padding: 7px; border: 1px solid var(--line); border-radius: 16px; background: var(--surface); color: var(--text); box-shadow: 0 10px 26px var(--shadow); }
  .language-menu a { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 8px 11px; border-radius: 11px; color: var(--text); text-decoration: none; font-size: 13px; font-weight: 800; }
  .language-menu a:hover, .language-menu a[aria-current='page'] { background: var(--peach); }
  .language-label { flex: 1; }
  .language-check { color: var(--accent-strong); }
  /* Add text for screen readers without making the compact mobile control wider. */
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
