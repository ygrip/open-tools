<script lang="ts">
  import './app.css';
  import { page } from '$app/state';
  import { locales } from '$lib/paraglide/runtime.js';
  import { localizedPath } from '$lib/i18n';
  import { m } from '$lib/paraglide/messages.js';
  import fontUrl from '@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2?url';

  let { children } = $props();
</script>

<svelte:head>
  <title>Open Tools</title>
  {#each locales as locale}
    <link rel="alternate" hreflang={locale} href={localizedPath(page.url.pathname, locale)} />
  {/each}
  <link rel="preload" href={fontUrl} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<a class="skip-link" href="#main-content">{m.skip_content()}</a>
{@render children()}
