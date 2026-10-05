<script lang="ts">
  import { onMount } from 'svelte';
  import DotField from '$lib/components/DotField.svelte';
  import { categories, tools } from '$lib/registry/tools';

  let query = $state('');
  let selectedCategory = $state('all');
  let heroVisual: HTMLDivElement | null = $state(null);
  let searchInput: HTMLInputElement | null = $state(null);

  const filteredTools = $derived(
    tools.filter((tool) => {
      const haystack = [
        tool.name,
        tool.description,
        tool.category,
        ...(tool.capabilities ?? [])
      ]
        .join(' ')
        .toLowerCase();

      const matchesQuery = haystack.includes(query.trim().toLowerCase());
      const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
      return matchesQuery && matchesCategory;
    })
  );

  function clearFilters() {
    query = '';
    selectedCategory = 'all';
  }

  onMount(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (event.key === '/' && !typing) {
        event.preventDefault();
        searchInput?.focus();
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
    <DotField images={['/icons/tool.svg', '/icons/time.svg']} anchor={heroVisual} className="hero-dot-field" />

    <div class="hero-copy">
      <p class="eyebrow"><span class="status-dot"></span> Open source utility hub</p>
      <h1>Find the tool. Do the thing. Move on.</h1>
      <p class="lede">
        Small, focused utilities in one searchable catalog. Each tool can live in its own
        repository while Open Tools handles discovery and presentation.
      </p>

      <label class="hero-search">
        <span class="hero-search-icon" aria-hidden="true">⌕</span>
        <input
          bind:this={searchInput}
          bind:value={query}
          placeholder="Search tools, formats, or capabilities"
          aria-label="Search tools"
        />
        <kbd>/</kbd>
      </label>

      {#if query.trim()}
        <p class="search-summary">
          {filteredTools.length} {filteredTools.length === 1 ? 'tool' : 'tools'} match “{query.trim()}”
        </p>
      {/if}
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
          <h3>No tools match that search.</h3>
          <p>
            Try a broader term or clear the category filter. Apparently even utilities can be difficult to locate.
          </p>
        </div>
        <button class="empty-action" onclick={clearFilters}>Clear search</button>
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
