<script lang="ts">
  import SiteFooter from '$lib/components/SiteFooter.svelte';
  import ShareButton from '$lib/components/ShareButton.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import QuickSettings from '$lib/components/QuickSettings.svelte';
  import ToolRuntime from '$lib/components/ToolRuntime.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import ToolArt from '$lib/components/ToolArt.svelte';
  import { recordRecentTool } from '$lib/recent';
  import Seo from '$lib/components/Seo.svelte';
  import { localizedPath } from '$lib/i18n';
  import { localizedTool } from '$lib/registry/presentation';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { m } from '$lib/paraglide/messages.js';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const tool = $derived(localizedTool(data.tool, getLocale()));
  $effect(() => recordRecentTool(data.tool.id));
</script>

<Seo title={tool.seo.title} description={tool.seo.description} path={`${tool.path}/`} keywords={tool.seo.keywords} robots={tool.seo.robots} {tool} />

<main id="main-content" class="page-shell tool-shell">
  <header class="surface tool-header">
    <a class="tool-back" href={localizedPath('/')}><span class="tool-back-icon"><Icon name="arrow-left" size={20} /></span><span class="back-long">{m.tool_back()}</span><span class="back-short">{m.nav_toolbox()}</span></a>
    <div class="tool-header-actions"><LanguageSwitcher /><ThemeToggle /><ShareButton {tool} /><QuickSettings /></div>
  </header>
  <section class="tool-intro" aria-labelledby="tool-name">
    <ToolArt id={tool.id} icon={tool.icon} size={84} eager />
    <div><p class="eyebrow">trick-it</p><h1 id="tool-name">{tool.name}</h1><p>{tool.description}</p></div>
  </section>
  <ToolRuntime {tool} locale={getLocale()} />
  <aside class="workspace-note surface" aria-label={m.tool_policy_link()}>
    <span class="clay-icon mint" aria-hidden="true"><Icon name="shield" size={24} /></span>
    <p>{m.tool_isolated()}</p>
    <a class="clay-button small" href={localizedPath('/policy/')}>{m.tool_policy_link()} <Icon name="arrow-right" size={18} /></a>
  </aside>
  <noscript>{m.tool_noscript()}</noscript>
  <SiteFooter />
</main>

<style>
  /* Positioned above the quick-settings backdrop (z-index 29) so its menu stays usable. */
  .tool-header { position: relative; z-index: 30; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px; border-radius: 24px; }
  .tool-back, .tool-header-actions { display: flex; align-items: center; gap: 10px; }
  .tool-back { min-height: 44px; font-weight: 800; }
  .tool-back-icon { line-height: 0; }
  .back-short, .tool-header-actions > :global(.quick-settings) { display: none; }
  .tool-intro { display: flex; align-items: center; gap: 18px; padding: 32px 0; }
  .tool-intro > div { min-width: 0; }
  h1 { font-size: clamp(30px, 5vw, 52px); letter-spacing: -.05em; margin: 8px 0; overflow-wrap: anywhere; }
  .tool-intro p:last-child { overflow-wrap: anywhere; max-width: 65ch; color: var(--muted); }
  /* Isolation note: icon + one-line explanation + a real button into the policy page (internal link, so no external icon). */
  .workspace-note { display: flex; align-items: center; gap: 16px; margin-top: 20px; padding: 16px 18px; border-radius: 24px; }
  .workspace-note .clay-icon { width: 48px; height: 48px; border-radius: 16px; }
  .workspace-note p { flex: 1; min-width: 0; font-size: 14px; font-weight: 700; line-height: 1.5; color: var(--text-secondary, var(--muted)); }
  .workspace-note a { flex-shrink: 0; gap: 8px; }
  .workspace-note a :global(svg) { transition: transform var(--duration-quick) var(--ease-smooth-out); }
  .workspace-note a:hover :global(svg) { transform: translateX(3px); }
  @media (max-width: 560px) {
    .tool-intro > :global(.tool-art) { width: 64px; height: 64px; }
    .workspace-note { flex-wrap: wrap; }
    .workspace-note p { flex-basis: calc(100% - 64px); }
    .workspace-note a { width: 100%; }
  }
  /* Phones: same pattern as the home header — round share button + gooey quick-settings for language/theme. */
  @media (max-width: 760px) {
    .tool-header { padding: 12px 12px 12px 14px; border-radius: 26px; }
    .back-long, .tool-header-actions > :global(.language-switcher), .tool-header-actions > :global(.theme-toggle) { display: none; }
    .back-short { display: inline; font-size: 16px; }
    .tool-header-actions > :global(.quick-settings) { display: block; }
    .tool-back { gap: 10px; }
    .tool-back-icon { width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--line); border-radius: 999px; background: var(--surface); }
    .tool-header-actions > :global(.share-button) { width: 48px; height: 48px; padding: 0; border-radius: 999px; }
    .tool-header-actions > :global(.share-button span) { display: none; }
  }
</style>
