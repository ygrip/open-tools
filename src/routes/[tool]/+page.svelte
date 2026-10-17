<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { sandboxDocument } from '$lib/registry/sandbox';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let document = $state('');
  let failure = $state('');
  let retry = $state(0);
  let mounted = $state(false);

  onMount(() => { mounted = true; });

  $effect(() => {
    if (!mounted) return;
    const tool = data.tool;
    void retry;
    const controller = new AbortController();
    document = '';
    failure = '';
    const timeout = setTimeout(() => {
      controller.abort();
      failure = 'Bundle request timed out. Try again.';
    }, 30_000);
    async function loadBundle() {
      try {
        const response = await fetch(`${base}/bundles/${tool.id}/${tool.bundle.sha256}.json`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Bundle request failed (${response.status})`);
        const bundle = await response.json();
        if (typeof bundle.html !== 'string') throw new Error('Invalid bundle response');
        if (!controller.signal.aborted) document = sandboxDocument(bundle.html);
      } catch (error) {
        if (!controller.signal.aborted) failure = error instanceof Error ? error.message : 'Bundle unavailable';
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

<main class="page-shell tool-shell">
  <header class="surface tool-header">
    <a href={`${base}/`}>← All tools</a>
    <ThemeToggle />
  </header>
  <section class="tool-intro">
    <p class="eyebrow">{data.tool.category} · v{data.tool.version} · {data.tool.status}</p>
    <h1>{data.tool.name}</h1>
    <p>{data.tool.description}</p>
    <small>Runs in an isolated browser frame with restricted network APIs. Source repositories may be private.</small>
  </section>
  {#if failure}
    <section class="surface load-state" role="alert">
      <h2>Tool could not load</h2>
      <p>{failure}</p>
      <button type="button" onclick={() => retry++}>Retry loading</button>
    </section>
  {:else if document}
    <iframe title={data.tool.name} srcdoc={document} sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe>
  {:else}
    <p class="surface load-state" role="status">Loading {data.tool.name}…</p>
  {/if}
  <noscript>This tool requires JavaScript to process data in your browser.</noscript>
</main>

<style>
  .tool-shell { padding-bottom: 2rem; }
  .tool-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem; }
  .tool-header a { padding: 0.75rem; }
  .tool-intro { padding: 2rem 0; }
  h1 { font-size: clamp(1.75rem, 4vw, 3rem); margin: 0.5rem 0; }
  .tool-intro p { max-width: 65ch; }
  small { display: block; margin-top: 1rem; }
  iframe { display: block; width: 100%; height: 80vh; min-height: 720px; border: 0; border-radius: 20px; background: #101114; }
  .load-state { padding: 2rem; }
  button { min-height: 44px; padding: 0.5rem 1rem; cursor: pointer; }
</style>
