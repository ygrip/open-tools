<script lang="ts">
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import { getLocale, localizeHref, locales } from '$lib/paraglide/runtime.js';

  const labels: Record<string, string> = { en: 'English', id: 'Bahasa Indonesia' };
</script>

<nav class="language-switcher" aria-label="Languages">
  {#each locales as locale}
    <a
      href={`${base}${localizeHref(page.url.pathname.slice(base.length) || '/', { locale })}`}
      aria-label={labels[locale]}
      aria-current={getLocale() === locale ? 'page' : undefined}
      hreflang={locale}
      lang={locale}
      data-sveltekit-reload
    >{locale.toUpperCase()}</a>
  {/each}
</nav>

<style>
  .language-switcher { display: flex; align-items: center; gap: 2px; padding: 4px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); white-space: nowrap; }
  .language-switcher a { min-width: 36px; min-height: 36px; display: grid; place-items: center; border-radius: 10px; font-size: 11px; font-weight: 850; color: var(--muted); text-decoration: none; }
  .language-switcher a[aria-current='page'] { background: var(--peach); color: var(--text); }
  .language-switcher a:focus-visible { outline: 2px solid var(--accent-strong); outline-offset: 1px; }
</style>
