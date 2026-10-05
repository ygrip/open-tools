<script lang="ts">
  import { categories, tools } from '$lib/registry/tools';

  let query = $state('');
  let selectedCategory = $state('all');

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
</script>

<main class="page-shell">
  <header class="topbar surface">
    <a class="brand" href="/" aria-label="Open Tools home">
      <span class="brand-mark" aria-hidden="true">OT</span>
      <span>
        <strong>Open Tools</strong>
        <small>small utilities, one place</small>
      </span>
    </a>

    <a
      class="github-link"
      href="https://github.com/ygrip/open-tools"
      target="_blank"
      rel="noreferrer"
    >
      GitHub
      <span aria-hidden="true">↗</span>
    </a>
  </header>

  <section class="hero surface">
    <div class="hero-copy">
      <p class="eyebrow"><span class="status-dot"></span> Open source utility hub</p>
      <h1>Useful tools without the clutter.</h1>
      <p class="lede">
        Small, focused web utilities registered through a safe manifest contract.
        Each tool can live in its own repository and release on its own schedule.
      </p>
    </div>

    <div class="hero-orbit" aria-hidden="true">
      <div class="orbit orbit-one"></div>
      <div class="orbit orbit-two"></div>
      <div class="orbit-core">+</div>
    </div>
  </section>

  <section class="controls surface" aria-label="Tool filters">
    <label class="search">
      <span aria-hidden="true">⌕</span>
      <input bind:value={query} placeholder="Search tools or capabilities" aria-label="Search tools" />
    </label>

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

  <section class="catalog">
    <div class="section-heading">
      <div>
        <p class="eyebrow">Catalog</p>
        <h2>Tools</h2>
      </div>
      <span>{filteredTools.length} registered</span>
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
    {:else}
      <div class="empty-state surface">
        <div class="empty-glyph" aria-hidden="true">+</div>
        <div>
          <h3>No tools registered yet.</h3>
          <p>
            Add a trusted manifest to the registry. The catalog and filters populate from metadata,
            so the shell does not need hand-edited cards for every new utility.
          </p>
        </div>
        <a href="https://github.com/ygrip/open-tools" target="_blank" rel="noreferrer">
          View registry contract ↗
        </a>
      </div>
    {/if}
  </section>

  <footer>
    <span>Open Tools</span>
    <span>Manifest-driven · static-friendly · no account required</span>
  </footer>
</main>
