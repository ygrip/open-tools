<script lang="ts">
  import './app.css';
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import { getLocale, getLocaleForUrl, overwriteGetLocale } from '$lib/paraglide/runtime.js';
  import PwaStatus from '$lib/components/PwaStatus.svelte';
  import HostUi from '$lib/components/HostUi.svelte';
  import { base } from '$app/paths';
  import { m } from '$lib/paraglide/messages.js';
  import fontUrl from '@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2?url';

  let { children } = $props();
  // Read SvelteKit's reactive URL so client-side locale navigation updates
  // translations without replacing a running tool's iframe.
  if (browser) overwriteGetLocale(() => getLocaleForUrl(page.url));
  $effect(() => { document.documentElement.lang = getLocale(); });
</script>

<svelte:head>
  <link rel="manifest" href={`${base}/manifest.webmanifest`} />
  <meta name="application-name" content="trick-it" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-title" content="trick-it" />
  <link rel="apple-touch-icon" href={`${base}/pwa/apple-touch-icon.png`} />
  <link rel="preload" href={fontUrl} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<a class="skip-link" href="#main-content">{m.skip_content()}</a>
{@render children()}
<PwaStatus />
<HostUi />
