<script lang="ts">
  import { base } from '$app/paths';
  import { m } from '$lib/paraglide/messages.js';
  import { localizedPath } from '$lib/i18n';
  import Icon from './Icon.svelte';
  import LanguageSwitcher from './LanguageSwitcher.svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import ShareButton from './ShareButton.svelte';
  import QuickSettings from './QuickSettings.svelte';
  import type { ToolManifest } from '$lib/registry/types';

  let { onsearch, catalog = [] }: { onsearch: () => void; catalog?: ToolManifest[] } = $props();

  // Highlight the section in view: "How it works" once its top passes mid-screen, else the toolbox.
  let active = $state<'tools' | 'how'>('tools');
  $effect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const how = document.getElementById('how-it-works');
      active = how && how.getBoundingClientRect().top < window.innerHeight * 0.5 ? 'how' : 'tools';
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); };
  });
</script>

<header class="topbar">
  <a class="brand" href={localizedPath('/')} aria-label={m.brand_home()}>
    <img src={`${base}/brand/logo.svg`} width="46" height="46" alt="" />
    <span class="brand-text"><strong>trick<span class="brand-accent">-it</span></strong><small>{m.brand_tagline()}</small></span>
  </a>
  <nav class="topnav" aria-label={m.nav_primary()}>
    <a class="nav-link" class:active={active === 'tools'} aria-current={active === 'tools' ? 'location' : undefined} href="#tools"><Icon name="grid" size={17} /> {m.nav_toolbox()}</a>
    <a class="nav-link about-link" class:active={active === 'how'} aria-current={active === 'how' ? 'location' : undefined} href="#how-it-works">{m.nav_how()}</a>
    <a class="nav-link mobile-github" href="https://github.com/ygrip/open-tools" target="_blank" rel="noreferrer"><Icon name="github" size={17} /> GitHub</a>
  </nav>
  <div class="header-actions">
    <button class="icon-button search-nav" type="button" onclick={onsearch} aria-label={m.search_label()}><Icon name="search" /></button>
    <LanguageSwitcher popover />
    <ThemeToggle />
    <QuickSettings share {catalog} />
    <ShareButton {catalog} />
    <a class="clay-button small github-link" aria-label="GitHub" href="https://github.com/ygrip/open-tools" target="_blank" rel="noreferrer"><Icon name="github" size={19} /><span>GitHub</span><Icon name="external" size={15} /></a>
  </div>
</header>

<style>
  /* Share + GitHub are compact icon buttons; they leave the header on phones (footer and nav keep them). */
  .header-actions :global(.share-button) { width: 44px; padding: 0; }
  .header-actions :global(.share-button span), .github-link span, .github-link :global(svg:last-child) { display: none; }
  .github-link { width: 44px; padding: 0; }
  .header-actions { padding-left: 14px; margin-left: 4px; border-left: 2px dashed var(--line); }
  .header-actions > :global(.quick-settings) { display: none; }
  @media (max-width: 760px) {
    .header-actions { padding-left: 0; margin-left: 0; border-left: 0; }
    .header-actions :global(.share-button) { display: none; }
    /* Phones: language + theme collapse into the gooey quick-settings button. */
    .header-actions > :global(.language-switcher), .header-actions > :global(.theme-toggle) { display: none; }
    .header-actions > :global(.quick-settings) { display: block; }
  }
</style>
