<script lang="ts">
  import { base } from '$app/paths';
  import { m } from '$lib/paraglide/messages.js';
  import { localizedPath } from '$lib/i18n';
  import Icon from './Icon.svelte';
  import LanguageSwitcher from './LanguageSwitcher.svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import ShareButton from './ShareButton.svelte';
  import type { ToolManifest } from '$lib/registry/types';

  let { onsearch, catalog = [] }: { onsearch: () => void; catalog?: ToolManifest[] } = $props();
</script>

<header class="topbar">
  <a class="brand" href={localizedPath('/')} aria-label={m.brand_home()}>
    <img src={`${base}/brand/logo.svg`} width="46" height="46" alt="" />
    <span><strong>trick<span class="brand-accent">-it</span></strong><small>{m.brand_tagline()}</small></span>
  </a>
  <nav class="topnav" aria-label={m.nav_primary()}>
    <a class="nav-link" href="#tools"><Icon name="grid" size={17} /> {m.nav_toolbox()}</a>
    <a class="nav-link about-link" href="#how-it-works">{m.nav_how()}</a>
    <a class="nav-link mobile-github" href="https://github.com/ygrip/open-tools" target="_blank" rel="noreferrer"><Icon name="github" size={17} /> GitHub</a>
  </nav>
  <div class="header-actions">
    <button class="icon-button search-nav" type="button" onclick={onsearch} aria-label={m.search_label()}><Icon name="search" /></button>
    <LanguageSwitcher />
    <ThemeToggle />
    <ShareButton {catalog} />
    <a class="clay-button small github-link" href="https://github.com/ygrip/open-tools" target="_blank" rel="noreferrer"><Icon name="github" size={19} /><span>GitHub</span><Icon name="external" size={15} /></a>
  </div>
</header>

<style>
  @media (max-width: 760px) {
    .header-actions :global(.share-button span) { display: none; }
    .header-actions :global(.share-button) { width: 44px; padding: 0; }
  }
  @media (max-width: 1000px) and (min-width: 761px) {
    .header-actions :global(.share-button span), .github-link span { display: none; }
    .header-actions :global(.share-button) { width: 44px; padding: 0; }
  }
</style>
