<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import { localizedPath } from '$lib/i18n';
  import { m } from '$lib/paraglide/messages.js';
  import { sandboxDocument, themeMessageType } from '$lib/registry/sandbox';
  import { documentTheme } from '$lib/theme';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let frameDocument = $state('');
  let frame = $state<HTMLIFrameElement | null>(null);
  let failure = $state('');
  let retry = $state(0);
  let mounted = $state(false);

  function syncFrameTheme() {
    // An opaque-origin srcdoc requires '*'. Address only this frame; the injected
    // receiver independently checks event.source === parent and the message enum.
    frame?.contentWindow?.postMessage({
      type: themeMessageType,
      version: 1,
      theme: documentTheme(window.document)
    }, '*');
  }

  onMount(() => {
    mounted = true;
    const observer = new MutationObserver(syncFrameTheme);
    observer.observe(window.document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  });

  $effect(() => {
    if (!mounted) return;
    const tool = data.tool;
    void retry;
    const controller = new AbortController();
    frameDocument = '';
    failure = '';
    const timeout = setTimeout(() => {
      controller.abort();
      failure = m.bundle_timeout();
    }, 30_000);
    async function loadBundle() {
      try {
        const response = await fetch(`${base}/bundles/${tool.id}/${tool.bundle.sha256}.json`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Bundle request failed (${response.status})`);
        const bundle = await response.json();
        if (typeof bundle.html !== 'string') throw new Error(m.bundle_invalid());
        if (!controller.signal.aborted) frameDocument = sandboxDocument(bundle.html, documentTheme(window.document));
      } catch (error) {
        if (!controller.signal.aborted) failure = error instanceof Error ? error.message : m.bundle_unavailable();
      } finally {
        clearTimeout(timeout);
      }
    }
    void loadBundle();
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  });
</script>

<svelte:head>
  <title>{data.tool.name} · Open Tools</title>
  <meta name="description" content={data.tool.description} />
</svelte:head>

<main id="main-content" class="page-shell tool-shell">
  <header class="surface tool-header">
    <a class="tool-back" href={localizedPath('/')}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10 6-6 6 6 6M4 12h16"/></svg>
      <span>{m.tool_back()}</span>
    </a>
    <div class="tool-header-actions">
      <span class="workspace-label">{m.tool_tagline()}</span>
      <LanguageSwitcher />
      <ThemeToggle />
    </div>
  </header>

  <section class="tool-intro">
    <div class="intro-copy">
      <p class="eyebrow">{m.tool_category_prefix()} {data.tool.category} {m.tool_category_suffix()}</p>
      <h1>{data.tool.name}</h1>
      <p>{data.tool.description}</p>
    </div>
    <div class="workspace-note surface">
      <span class="note-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></svg>
      </span>
      <div><strong>{m.tool_welcome()}</strong><span>{m.tool_browser()}</span></div>
    </div>
  </section>

  <section class="workspace surface" aria-label={`${data.tool.name} ${m.tool_workspace()}`}>
    <div class="workspace-topline">
      <span class="workspace-dots" aria-hidden="true"><i></i><i></i><i></i></span>
      <span>{m.tool_sorted()}</span>
      <span class="workspace-version">v{data.tool.version}</span>
    </div>
    {#if failure}
      <div class="load-state" role="alert">
        <span class="state-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5m0 4h.01M10.3 4.9 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.9a2 2 0 0 0-3.4 0Z"/></svg>
        </span>
        <h2>{m.tool_retry_title()}</h2>
        <p>{failure}</p>
        <button class="clay-button" type="button" onclick={() => retry++}>{m.tool_retry()}</button>
      </div>
    {:else if frameDocument}
      <iframe bind:this={frame} title={data.tool.name} srcdoc={frameDocument} sandbox="allow-scripts" referrerpolicy="no-referrer" onload={syncFrameTheme}></iframe>
    {:else}
      <div class="load-state" role="status">
        <span class="state-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="14" rx="4"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18m-11 0v3h4v-3"/></svg>
        </span>
        <h2>{m.tool_getting_ready()}</h2>
        <p>{m.tool_loading()} {data.tool.name}…</p>
      </div>
    {/if}
  </section>

  <footer class="workspace-footer">
    <p>{m.tool_isolated()}</p>
    <a href={localizedPath('/policy/')}>How tools work here <span aria-hidden="true">↗</span></a>
  </footer>
  <noscript>{m.tool_noscript()}</noscript>
</main>

<style>
  .tool-shell { padding-bottom: 2rem; }
  .tool-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.75rem 1rem; border-radius: 24px; }
  .tool-back { display: inline-flex; align-items: center; gap: 0.65rem; min-height: 48px; padding: 0.5rem; font-size: 0.95rem; font-weight: 750; }
  .tool-header-actions { display: flex; align-items: center; gap: 1rem; }
  .workspace-label { font-size: 0.82rem; color: var(--muted); }
  .tool-intro { display: flex; align-items: center; justify-content: space-between; gap: 2rem; padding: 2.75rem 0 2rem; }
  .intro-copy { min-width: 0; }
  h1 { font-size: clamp(2rem, 4vw, 3.5rem); line-height: 1.1; letter-spacing: -0.055em; margin: 0.6rem 0 0.75rem; overflow-wrap: anywhere; }
  .intro-copy > p:last-child { max-width: 57ch; color: var(--muted); line-height: 1.6; margin: 0; overflow-wrap: anywhere; }
  .workspace-note { display: flex; align-items: center; gap: 0.8rem; padding: 1rem 1.2rem; border-radius: 24px; flex: 0 0 auto; }
  .note-icon, .state-icon { display: inline-grid; place-items: center; background: var(--mint-soft, var(--surface)); color: var(--text); border-radius: 16px; width: 48px; height: 48px; }
  .workspace-note strong, .workspace-note span:not(.note-icon) { display: block; }
  .workspace-note strong { font-size: 0.87rem; margin-bottom: 0.3rem; }
  .workspace-note div > span { font-size: 0.76rem; color: var(--muted); }
  .workspace { border-radius: 28px; overflow: hidden; }
  .workspace-topline { display: flex; align-items: center; gap: 0.8rem; padding: 1rem 1.4rem; border-bottom: 1px solid var(--line); font-size: 0.75rem; font-weight: 700; color: var(--muted); }
  .workspace-dots { display: inline-flex; gap: 5px; }
  .workspace-dots i { width: 8px; height: 8px; border-radius: 50%; background: var(--line); }
  .workspace-dots i:first-child { background: #eaa585; }
  .workspace-dots i:nth-child(2) { background: #d4c492; }
  .workspace-dots i:last-child { background: #9abbaa; }
  .workspace-version { margin-left: auto; }
  iframe { display: block; width: 100%; height: 82vh; min-height: 790px; border: 0; background: var(--surface); }
  .load-state { min-height: 790px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 0.8rem; padding: 2rem; }
  .state-icon { width: 68px; height: 68px; border-radius: 23px; margin-bottom: 0.5rem; }
  .load-state h2 { margin: 0; font-size: clamp(1.3rem, 3vw, 1.8rem); letter-spacing: -0.035em; }
  .load-state p { margin: 0 0 0.75rem; color: var(--muted); overflow-wrap: anywhere; }
  .load-state button { min-height: 48px; padding: 0.8rem 1.3rem; }
  .workspace-footer { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.25rem 0.3rem; font-size: 0.78rem; color: var(--muted); }
  .workspace-footer p { margin: 0; }
  .workspace-footer a { min-height: 44px; display: inline-flex; align-items: center; gap: 0.35rem; }
  @media (max-width: 850px) {
    .tool-intro { flex-direction: column; align-items: flex-start; gap: 1.25rem; padding: 2rem 0 1.5rem; }
    .workspace-note { width: 100%; }
  }
  @media (max-width: 520px) {
    .tool-header { padding: 0.6rem; border-radius: 21px; }
    .tool-back { font-size: 0.82rem; gap: 0.4rem; }
    .workspace-label { display: none; }
    .workspace-topline { padding: 0.9rem 1rem; }
    .workspace { border-radius: 23px; }
    iframe, .load-state { min-height: 1100px; }
    .workspace-footer { align-items: flex-start; flex-direction: column; gap: 0.1rem; }
  }
</style>
