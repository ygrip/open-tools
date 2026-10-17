<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { getLocale, locales } from '$lib/paraglide/runtime.js';
  import { localizedPath } from '$lib/i18n';
  import { m } from '$lib/paraglide/messages.js';

  const labels: Record<string, string> = { en: 'English', id: 'Bahasa Indonesia' };
</script>

<nav class="language-switcher" aria-label={m.languages()}>
  {#each locales as locale}
    <a
      href={`${localizedPath(page.url.pathname, locale)}${browser ? page.url.search + page.url.hash : ''}`}
      aria-current={getLocale() === locale ? 'page' : undefined}
      hreflang={locale}
      lang={locale}
      data-sveltekit-reload
    >{locale.toUpperCase()}<span class="sr-only"> {labels[locale]}</span></a>
  {/each}
</nav>

<style>
  .language-switcher { display: flex; align-items: center; gap: 2px; padding: 4px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); white-space: nowrap; }
  .language-switcher a { min-width: 36px; min-height: 36px; display: grid; place-items: center; border-radius: 10px; font-size: 11px; font-weight: 850; color: var(--muted); text-decoration: none; }
  .language-switcher a[aria-current='page'] { background: var(--peach); color: var(--text); }
  .language-switcher a:focus-visible { outline: 2px solid var(--accent-strong); outline-offset: 1px; }
  /* Accessible name starts with the visible code (WCAG 2.5.3 label-in-name) and adds the full language name. */
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
