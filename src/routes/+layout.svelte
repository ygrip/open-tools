<script lang="ts">
  import './app.css';
  import fontUrl from '@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2?url';

  let { children } = $props();
</script>

<svelte:head>
  <title>Open Tools</title>
  <link rel="preload" href={fontUrl} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<a class="skip-link" href="#main-content">Skip to content</a>
{@render children()}
