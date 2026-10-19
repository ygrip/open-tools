<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { getLocale, locales } from '$lib/paraglide/runtime.js';
  import { localizedPath } from '$lib/i18n';
  import { m } from '$lib/paraglide/messages.js';

  let { dropdown = false }: { dropdown?: boolean } = $props();
  const labels: Record<string, string> = { en: 'English', id: 'Bahasa Indonesia' };
  const flags: Record<string, string> = { en: '🇬🇧', id: '🇮🇩' };

  function href(locale: (typeof locales)[number]) {
    return `${localizedPath(page.url.pathname, locale)}${browser ? page.url.search + page.url.hash : ''}`;
  }

  function selectLanguage(event: Event) {
    const locale = (event.currentTarget as HTMLSelectElement).value as (typeof locales)[number];
    window.location.assign(href(locale));
  }
</script>

<nav class="language-switcher" class:language-dropdown={dropdown} aria-label={m.languages()}>
  {#if dropdown}
    <label class="language-native-select">
      <span class="language-flag" aria-hidden="true">{flags[getLocale()]}</span>
      <span class="language-caret" aria-hidden="true">⌄</span>
      <select aria-label={`${m.languages()}: ${labels[getLocale()]}`} value={getLocale()} onchange={selectLanguage}>
        {#each locales as locale}
          <option value={locale}>{flags[locale]} {labels[locale]}</option>
        {/each}
      </select>
    </label>
  {:else}
    {#each locales as locale}
      <a href={href(locale)} aria-current={getLocale() === locale ? 'page' : undefined}
        hreflang={locale} lang={locale} data-sveltekit-reload>
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
  .language-switcher a:focus-visible, .language-native-select:focus-within { outline: 2px solid var(--accent-strong); outline-offset: 2px; }
  .language-dropdown { padding: 0; border: 0; background: transparent; }
  .language-native-select { position: relative; min-width: 48px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; gap: 3px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); color: var(--text); box-shadow: 0 3px 0 var(--line), inset 1px 2px 2px var(--highlight); cursor: pointer; }
  .language-native-select select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
  .language-caret { margin-top: -5px; font-size: 17px; color: var(--muted); }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
