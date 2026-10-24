<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { getLocale } from '$lib/paraglide/runtime.js';
  import { localizedTool } from '$lib/registry/presentation';
  import { localizedPath } from '$lib/i18n';
  import SiteHeader from '$lib/components/SiteHeader.svelte';
  import SiteFooter from '$lib/components/SiteFooter.svelte';
  import SupportSection from '$lib/components/SupportSection.svelte';
  import { base } from '$app/paths';
  import Icon from '$lib/components/Icon.svelte';
  import HeroArt from '$lib/components/HeroArt.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import Pagination from '$lib/components/Pagination.svelte';
  import { getPagination } from '$lib/pagination.js';
  import type { PageData } from './$types';
  import ToolArt from '$lib/components/ToolArt.svelte';
  import { readRecentEntries, relativeTime, clearRecentTools, readToolSort, saveToolSort, sortTools, toolSorts, type ToolSort } from '$lib/recent';

  // Stable per-tool hue: the visual accent follows the tool, not its sort position.
  function toolHue(id: string) {
    let hash = 0;
    for (const character of id) hash = (hash * 33 + character.charCodeAt(0)) >>> 0;
    return (hash % 12) * 30 + 12;
  }

  let { data }: { data: PageData } = $props();
  const categories = $derived(data.categories);
  const tools = $derived(data.tools);
  const pageSize = 6;
  let currentPage = $state(1);
  let selectedCategory = $state('all');
  let query = $state('');
  let searchOpen = $state(false);
  let searchError = $state('');
  let SearchOverlay = $state<typeof import('$lib/components/SearchOverlay.svelte').default | null>(null);
  const categoryNames: Record<string, string> = $derived({ all: m.category_all(), data: m.category_data(), developer: m.category_developer(), media: m.category_media(), productivity: m.category_productivity(), other: m.category_other() });
  const catalog = $derived(data.tools.map((tool) => localizedTool(tool, getLocale())));
  // Browser-only preferences: hydrated after mount so prerendered HTML stays deterministic.
  let recentEntries = $state<{ id: string; at?: number }[]>([]);
  let sortOrder = $state<ToolSort>('az');
  const sortNames: Record<ToolSort, string> = $derived({ az: m.sort_az(), za: m.sort_za(), newest: m.sort_newest(), oldest: m.sort_oldest() });
  const recentTools = $derived(recentEntries.flatMap((entry) => { const tool = catalog.find((item) => item.id === entry.id); return tool ? [{ tool, when: relativeTime(entry.at, getLocale()) }] : []; }));
  const filteredTools = $derived(sortTools(catalog, sortOrder, getLocale()).filter((tool) =>
    (selectedCategory === 'all' || tool.category === selectedCategory) &&
    [tool.name, tool.description, ...tool.capabilities].join(' ').toLowerCase().includes(query.trim().toLowerCase())
  ));

  const pageState = $derived(getPagination(filteredTools.length, pageSize, currentPage));
  const pagedTools = $derived(filteredTools.slice(pageState.offset, pageState.end));

  function changeSort(value: ToolSort) {
    sortOrder = value;
    currentPage = 1;
    saveToolSort(value);
  }

  function clearRecent() {
    clearRecentTools();
    recentEntries = [];
  }

  function selectCategory(category: string) {
    selectedCategory = category;
    currentPage = 1;
  }

  async function changePage(page: number) {
    currentPage = page;
    await tick();
    const heading = document.getElementById('catalog-title');
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ block: 'start' });
  }

  async function openSearch() {
    searchError = '';
    try {
      SearchOverlay ??= (await import('$lib/components/SearchOverlay.svelte')).default;
      searchOpen = true;
    } catch {
      searchError = m.search_error();
      document.getElementById('tool-search')?.focus();
    }
  }

  onMount(() => {
    recentEntries = readRecentEntries();
    sortOrder = readToolSort();
    function shortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select') || target?.isContentEditable) return;
      if (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        void openSearch();
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  });
</script>

<Seo title={m.home_title()} description={m.home_description()} path="/" />
<svelte:head>
  <link rel="preload" as="image" href={`${base}/illustrations/clay-workbench-768.webp`} imagesrcset={`${base}/illustrations/clay-workbench-448.webp 448w, ${base}/illustrations/clay-workbench-768.webp 768w`} imagesizes="(max-width: 760px) calc(100vw - 64px), 480px" />
</svelte:head>

{#if SearchOverlay}<SearchOverlay bind:open={searchOpen} tools={catalog} />{/if}

<div class="page-shell">
  <SiteHeader onsearch={openSearch} catalog={catalog} />

  <main id="main-content">
    <section class="hero-bento" aria-labelledby="hero-title">
      <div class="hero-copy surface">
        <span class="eyebrow friendly-pill"><Icon name="sparkles" size={16} /> {m.hero_eyebrow()}</span>
        <h1 id="hero-title">{m.hero_small()}<br />{m.hero_big()} <span class="headline-highlight">{m.hero_wins()}</span></h1>
        <p class="hero-description">{m.hero_description()}</p>
        <div class="hero-actions">
          <a class="clay-button primary" href="#tools">{m.hero_explore()} <Icon name="arrow-right" size={20} /></a>
          <span class="no-account"><Icon name="check" size={16} /> {m.hero_no_account()}</span>
        </div>
        <div class="hero-proof"><span class="tiny-clay-icon"><Icon name="grid" size={17} /></span><span>{tools.length === 0 ? m.hero_proof_empty() : tools.length === 1 ? m.hero_proof_one({ count: tools.length }) : m.hero_proof({ count: tools.length })}</span></div>
      </div>
      <HeroArt />
      <div class="benefit-tile surface mint"><span class="clay-icon"><Icon name="lock" size={23} /></span><div><strong>{m.benefit_private()}</strong><p>{m.benefit_private_desc()}</p></div></div>
      <div class="benefit-tile surface lavender"><span class="clay-icon"><Icon name="bolt" size={23} /></span><div><strong>{m.benefit_setup()}</strong><p>{m.benefit_setup_desc()}</p></div></div>
      <div class="benefit-tile surface butter"><span class="clay-icon"><Icon name="grid" size={23} /></span><div><strong>{m.benefit_collection()}</strong><p>{m.benefit_collection_desc()}</p></div></div>
    </section>

    {#if recentTools.length}
      <section class="recent-section surface" aria-labelledby="recent-title">
        <div class="recent-heading">
          <span class="recent-orb" aria-hidden="true"><Icon name="bolt" size={22} /></span>
          <div><p class="eyebrow">{m.recent_eyebrow()}</p><h2 id="recent-title">{m.recent_heading()}</h2></div>
          <button class="clay-button small recent-clear" type="button" onclick={clearRecent} aria-label={m.recent_clear()} title={m.recent_clear()}><Icon name="x" size={16} /></button>
        </div>
        <ul class="recent-list">
          {#each recentTools as { tool, when }, index (tool.id)}
            <li style:--delay={`${index * 50}ms`}>
              <a class="recent-card" href={localizedPath(`${tool.path}/`)}>
                <span class="recent-art"><ToolArt id={tool.id} icon={tool.icon} size={56} /></span>
                <span class="recent-copy">
                  <strong>{tool.name}</strong>
                  <small>{categoryNames[tool.category] ?? tool.category}</small>
                  {#if when}<span class="recent-when">{when}</span>{/if}
                </span>
                <span class="recent-go" aria-hidden="true"><Icon name="arrow-right" size={16} /></span>
                <span class="sr-only">{m.recent_open()}</span>
              </a>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section class="catalog-section" id="tools" aria-labelledby="catalog-title">
      <div class="section-heading"><div><p class="eyebrow">{m.catalog_eyebrow()}</p><h2 id="catalog-title" tabindex="-1">{m.catalog_heading()}</h2></div><span class="count-pill">{tools.length} {tools.length === 1 ? m.handy_tool() : m.handy_tools()} {m.count_and_counting()}</span></div>
      <div class="catalog-controls surface">
        <div class="search-input-wrap"><Icon name="search" size={21} /><label class="sr-only" for="tool-search">{m.search_toolbox()}</label><input id="tool-search" type="search" bind:value={query} oninput={() => currentPage = 1} placeholder={m.search_placeholder()} /><kbd>/</kbd></div>
        <div class="chips" aria-label={m.nav_categories()}>
          <button type="button" class:active={selectedCategory === 'all'} aria-pressed={selectedCategory === 'all'} onclick={() => selectCategory('all')}><Icon name="grid" size={16} /> {m.category_all()}</button>
          {#each categories as category}<button type="button" class:active={selectedCategory === category} aria-pressed={selectedCategory === category} onclick={() => selectCategory(category)}>{categoryNames[category]}</button>{/each}
        </div>
        <label class="sort-control"><Icon name="sliders" size={16} /><span class="sr-only">{m.sort_label()}</span><select value={sortOrder} onchange={(event) => changeSort(event.currentTarget.value as ToolSort)}>{#each toolSorts as sort}<option value={sort}>{sortNames[sort]}</option>{/each}</select></label>
      </div>
      {#if searchError}<p role="status">{searchError}</p>{/if}
      <p class="sr-only" role="status">{filteredTools.length} {m.tools_found()}</p>
      <div class="tool-grid" class:single-result={filteredTools.length === 1}>
        {#each pagedTools as tool (tool.id)}
          <a class="tool-card surface" style:--tool-hue={toolHue(tool.id)} href={localizedPath(`${tool.path}/`)}>
            <div class="tool-card-top"><ToolArt id={tool.id} icon={tool.icon} size={60} /><span class="tool-status"><span class="status-dot"></span> {m.tool_ready()}</span></div>
            <div class="tool-card-copy"><span class="eyebrow">{categoryNames[tool.category]}</span><h3>{tool.name}</h3><p>{tool.description}</p></div>
            <div class="tool-capabilities">{#each tool.capabilities as capability}<span>{capability.replaceAll('-', ' ')}</span>{/each}</div>
            <div class="tool-card-bottom"><span>{m.open_tool()} {tool.name}</span><span class="round-arrow"><Icon name="arrow-right" size={21} /></span></div>
          </a>
        {:else}
          <div class="empty-state surface"><span class="clay-icon lavender"><Icon name="search" size={30} /></span><h3>{tools.length ? m.empty_title() : m.empty_title_no_tools()}</h3><p>{tools.length ? m.empty_desc() : m.empty_desc_no_tools()}</p>{#if tools.length}<button class="clay-button" type="button" onclick={() => { query = ''; selectCategory('all'); }}>{m.empty_show_all()} <Icon name="arrow-right" size={18} /></button>{/if}</div>
        {/each}
        {#if filteredTools.length <= 1 && !query && selectedCategory === 'all'}
          <aside class="collection-card surface lavender"><div class="mini-tool-scene" aria-hidden="true"><span class="mini-block one"><Icon name="toolbox" size={38} /></span><span class="mini-block two"><Icon name="sparkles" size={30} /></span><span class="mini-block three"><Icon name="braces" size={26} /></span></div><span class="eyebrow">{m.collection_eyebrow()}</span><h3>{m.collection_title_1()}<br />{m.collection_title_2()}</h3><p>{m.collection_desc()}</p><a class="text-link" href="https://github.com/ygrip/open-tools" target="_blank" rel="noreferrer">{m.collection_feedback()} <Icon name="arrow-right" size={18} /></a></aside>
        {/if}
      </div>
      <Pagination totalItems={filteredTools.length} {pageSize} {currentPage} onPageChange={changePage} />
    </section>

    <section class="how-section surface" id="how-it-works" aria-labelledby="how-title">
      <div class="how-heading"><span class="eyebrow">{m.how_eyebrow()}</span><h2 id="how-title">{m.how_title_1()}<br />{m.how_title_2()}</h2><p>{m.how_intro()}</p></div>
      <ol class="how-steps"><li><span class="step-number peach">01</span><div><h3>{m.step_find()}</h3><p>{m.step_find_desc()}</p></div></li><li><span class="step-number mint">02</span><div><h3>{m.step_use()}</h3><p>{m.step_use_desc()}</p></div></li><li><span class="step-number lavender">03</span><div><h3>{m.step_done()}</h3><p>{m.step_done_desc()}</p></div></li></ol>
    </section>

    <SupportSection />
  </main>

  <SiteFooter />
</div>
