<script lang="ts">
  import { onMount } from 'svelte';
  import DotField from '$lib/components/DotField.svelte';
  import SearchOverlay from '$lib/components/SearchOverlay.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { categories, tools } from '$lib/registry/tools';

  let selectedCategory = $state('all');
  let heroVisual: HTMLDivElement | null = $state(null);
  let searchOpen = $state(false);

  const filteredTools = $derived(
    selectedCategory === 'all' ? tools : tools.filter((tool) => tool.category === selectedCategory)
  );

  onMount(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if ((event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) && !typing) {
        event.preventDefault();
        searchOpen = true;
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  });
</script>

<svelte:head>
  <title>Open Tools · Small utilities, one place</title>
  <meta
    name="description"
    content="Discover small, focused open-source web utilities from one manifest-driven catalog."
  />
</svelte:head>

<SearchOverlay bind:open={searchOpen} {tools} />

<main class="page-shell">
  <header class="topbar surface">
    <a class="brand" href="/" aria-label="Open Tools home">
      <span class="brand-mark" aria-hidden="true">OT</span>
      <span>
        <strong>Open Tools</strong>
        <small>small utilities, one place</small>
      </span>
    </a>

    <nav class="topnav" aria-label="Primary navigation">
      <a href="#tools">Tools</a>
      <a href="/policy">Policy</a>
      <ThemeToggle />
      <a
        class="github-link"
        href="https://github.com/ygrip/open-tools"
        target="_blank"
        rel="noreferrer"
      >
        GitHub <span aria-hidden="true">↗</span>
      </a>
    </nav>
  </header>

  <section class="hero surface">
    <DotField
      images={['/icons/tool.svg', '/icons/time.svg']}
      anchor={heroVisual}
      className="hero-dot-field"
    />

    <div class="hero-copy">
      <p class="eyebrow"><span class="status-dot"></span> Open source utility hub</p>
      <h1>Find the tool. Do the thing. Move on.</h1>
      <p class="lede">
        Small, focused utilities in one searchable catalog. Each tool can live in its own
        repository while Open Tools handles discovery and presentation.
      </p>

      <button class="hero-search-trigger" type="button" onclick={() => (searchOpen = true)}>
        <span class="hero-search-icon" aria-hidden="true">⌕</span>
        <span class="hero-search-placeholder">Search tools, formats, or capabilities</span>
        <kbd>/</kbd>
      </button>
    </div>

    <div class="hero-visual" bind:this={heroVisual} aria-hidden="true"></div>
  </section>

  <section class="controls surface" aria-label="Tool filters">
    <div class="chips" aria-label="Categories">
      <button class:active={selectedCategory === 'all'} onclick={() => (selectedCategory = 'all')}>
        All
      </button>
      {#each categories as category}
        <button
          class:active={selectedCategory === category}
          onclick={() => (selectedCategory = category)}
        >
          {category}
        </button>
      {/each}
    </div>
  </section>

  <section class="catalog" id="tools">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Catalog</p>
        <h2>Tools</h2>
      </div>
      <span>{filteredTools.length} shown · {tools.length} registered</span>
    </div>

    {#if filteredTools.length > 0}
      <div class="tool-grid">
        {#each filteredTools as tool}
          <a class="tool-card surface" href={tool.path}>
            <div class="tool-card-top">
              <div class="tool-icon">{tool.icon ?? tool.name.slice(0, 2).toUpperCase()}</div>
              <span class="tool-status">{tool.status ?? 'stable'}</span>
            </div>
            <div>
              <h3>{tool.name}</h3>
              <p>{tool.description}</p>
            </div>
            <div class="tool-meta">
              <span>{tool.category}</span>
              <span aria-hidden="true">→</span>
            </div>
          </a>
        {/each}
      </div>
    {:else if tools.length === 0}
      <div class="empty-state surface">
        <div class="empty-glyph" aria-hidden="true">+</div>
        <div>
          <h3>No tools have opted in yet.</h3>
          <p>
            Repositories owned by a trusted owner are discovered automatically when they add the
            <code>open-tools</code> topic and a valid <code>tool.manifest.json</code> at the repo root.
          </p>
        </div>
        <a href="https://github.com/ygrip/open-tools#automatic-registration" target="_blank" rel="noreferrer">
          Registration guide ↗
        </a>
      </div>
    {:else}
      <div class="empty-state surface empty-filter">
        <div class="empty-glyph" aria-hidden="true">⌕</div>
        <div>
          <h3>No tools in this category.</h3>
          <p>Try another category. Taxonomy remains humanity's favorite way to misplace things.</p>
        </div>
        <button class="empty-action" onclick={() => (selectedCategory = 'all')}>Show all</button>
      </div>
    {/if}
  </section>

  <footer>
    <span>Open Tools</span>
    <nav class="footer-links" aria-label="Legal">
      <a href="/terms">Terms</a>
      <a href="/privacy">Privacy</a>
      <a href="/policy">Tool policy</a>
      <a href="https://github.com/ygrip/open-tools" target="_blank" rel="noreferrer">GitHub ↗</a>
    </nav>
  </footer>
</main>
