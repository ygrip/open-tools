<script lang="ts">
  import './app.css';
  import { page } from '$app/state';
  import { getLocale, localizeHref } from '$lib/paraglide/runtime.js';
  import { m } from '$lib/paraglide/messages.js';
  import fontUrl from '@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2?url';

  let { children } = $props();
</script>

<svelte:head>
  <title>Open Tools</title>
  {#each ['en', 'id'] as locale}
    <link rel="alternate" hreflang={locale} href={new URL(localizeHref(page.url.pathname, { locale }), page.url.origin).href} />
  {/each}
  <link rel="preload" href={fontUrl} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<a class="skip-link" href="#main-content">{m.skip_content()}</a>
{@render children()}
