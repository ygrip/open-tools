<script lang="ts">
  import SiteFooter from '$lib/components/SiteFooter.svelte';
  import ShareButton from '$lib/components/ShareButton.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import ToolRuntime from '$lib/components/ToolRuntime.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import { localizedPath } from '$lib/i18n';
  import { localizedTool } from '$lib/registry/presentation';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { m } from '$lib/paraglide/messages.js';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const tool = $derived(localizedTool(data.tool, getLocale()));
</script>

<Seo title={tool.seo.title} description={tool.seo.description} path={`${tool.path}/`} keywords={tool.seo.keywords} robots={tool.seo.robots} {tool} />

<main id="main-content" class="page-shell tool-shell">
  <header class="surface tool-header">
    <a class="tool-back" href={localizedPath('/')}><Icon name="arrow-left" size={20} /><span>{m.tool_back()}</span></a>
    <div class="tool-header-actions"><LanguageSwitcher /><ThemeToggle /><ShareButton {tool} /></div>
  </header>
  <section class="tool-intro" aria-labelledby="tool-name">
    <span class="clay-icon peach"><Icon name={tool.icon} size={30} /></span>
    <div><p class="eyebrow">trick-it · {m.tool_version()} {tool.version}</p><h1 id="tool-name">{tool.name}</h1><p>{tool.description}</p></div>
  </section>
  <ToolRuntime {tool} locale={getLocale()} />
  <footer class="workspace-footer"><p>{m.tool_isolated()}</p><a href={localizedPath('/policy/')}>{m.tool_policy_link()} <Icon name="external" size={16} /></a></footer>
  <noscript>{m.tool_noscript()}</noscript>
  <SiteFooter {tool} />
</main>

<style>
  .tool-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px; border-radius: 24px; }
  .tool-back, .tool-header-actions { display: flex; align-items: center; gap: 10px; }
  .tool-back { min-height: 44px; font-weight: 800; }
  .tool-intro { display: flex; align-items: center; gap: 18px; padding: 32px 0; }
  .tool-intro > div { min-width: 0; }
  h1 { font-size: clamp(30px, 5vw, 52px); letter-spacing: -.05em; margin: 8px 0; overflow-wrap: anywhere; }
  .tool-intro p:last-child { overflow-wrap: anywhere; max-width: 65ch; color: var(--muted); }
  .workspace-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; color: var(--muted); font-size: 13px; margin-top: 20px; }
  .workspace-footer a { display: inline-flex; align-items: center; gap: 8px; min-height: 44px; }
  @media(max-width: 380px) { .tool-header { flex-wrap: wrap; } .tool-header-actions { margin-left: auto; } }
</style>
