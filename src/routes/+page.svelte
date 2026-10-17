<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import Icon from '$lib/components/Icon.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { categories, tools } from '$lib/registry/tools';

  let selectedCategory = $state('all');
  let query = $state('');
  let searchOpen = $state(false);
  let searchError = $state('');
  let SearchOverlay = $state<typeof import('$lib/components/SearchOverlay.svelte').default | null>(null);
  const categoryNames: Record<string, string> = { all: 'All tools', data: 'Data & formats', developer: 'Developer', media: 'Images & media', productivity: 'Everyday work', other: 'A little of everything' };
  const filteredTools = $derived(tools.filter((tool) =>
    (selectedCategory === 'all' || tool.category === selectedCategory) &&
    [tool.name, tool.description, ...tool.capabilities].join(' ').toLowerCase().includes(query.trim().toLowerCase())
  ));

  async function openSearch() {
    searchError = '';
    try {
      SearchOverlay ??= (await import('$lib/components/SearchOverlay.svelte')).default;
      searchOpen = true;
    } catch {
      searchError = 'Quick search could not open. You can still search the tools below.';
      document.getElementById('tool-search')?.focus();
    }
  }

  onMount(() => {
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

<svelte:head>
  <title>Open Tools · Little tools. Lovely results.</title>
  <meta name="description" content="Your friendly little toolbox for the web. Format JSON, find what you need, and turn tricky data into a small win. No account needed." />
  <link rel="preload" as="image" href={`${base}/illustrations/clay-workbench-768.webp`} imagesrcset={`${base}/illustrations/clay-workbench-448.webp 448w, ${base}/illustrations/clay-workbench-768.webp 768w`} imagesizes="(max-width: 760px) calc(100vw - 64px), 480px" />
</svelte:head>

{#if SearchOverlay}<SearchOverlay bind:open={searchOpen} {tools} />{/if}

<div class="page-shell">
  <header class="topbar">
    <a class="brand" href={`${base}/`} aria-label="Open Tools home">
      <img src={`${base}/brand/logo.svg`} width="46" height="46" alt="" />
      <span><strong>open<span class="brand-accent">tools</span></strong><small>little tools. lovely results.</small></span>
    </a>
    <nav class="topnav" aria-label="Primary navigation">
      <a class="nav-link" href="#tools">The toolbox</a>
      <a class="nav-link about-link" href="#how-it-works">How it works</a>
      <button class="icon-button search-nav" type="button" onclick={openSearch} aria-label="Search tools"><Icon name="search" /></button>
      <ThemeToggle />
      <a class="clay-button small github-link" href="https://github.com/ygrip/open-tools" target="_blank" rel="noreferrer"><Icon name="github" size={19} /><span>GitHub</span><Icon name="external" size={15} /></a>
    </nav>
  </header>

  <main id="main-content">
    <section class="hero-bento" aria-labelledby="hero-title">
      <div class="hero-copy surface">
        <span class="eyebrow friendly-pill"><Icon name="sparkles" size={16} /> A little less busywork</span>
        <h1 id="hero-title">Small tools.<br />Big <span class="headline-highlight">little wins.</span></h1>
        <p class="hero-description">Untangle your data. Tidy up a task. Get on with the good stuff. Your next shortcut is right here.</p>
        <div class="hero-actions">
          <a class="clay-button primary" href="#tools">Explore the toolbox <Icon name="arrow-right" size={20} /></a>
          <span class="no-account"><Icon name="check" size={16} /> No account. No fuss.</span>
        </div>
        <div class="hero-proof"><span class="tiny-clay-icon"><Icon name="shield" size={17} /></span><span>Thoughtful little utilities. One happy home.</span></div>
      </div>
      <div class="hero-art surface">
        <div class="art-caption"><span class="status-dot"></span> Your handy little sidekick</div>
        <img src={`${base}/illustrations/clay-workbench-768.webp`} srcset={`${base}/illustrations/clay-workbench-448.webp 448w, ${base}/illustrations/clay-workbench-768.webp 768w`} sizes="(max-width: 760px) calc(100vw - 64px), 480px" width="768" height="768" fetchpriority="high" decoding="async" alt="A smiling orange clay toolbox with a lavender code tile, mint data stack, and yellow magnifying glass." />
        <span class="art-sticker"><Icon name="heart" size={16} /> Made for your everyday</span>
      </div>
      <div class="benefit-tile surface mint"><span class="clay-icon"><Icon name="lock" size={23} /></span><div><strong>Your data stays yours</strong><p>Our first tools work right in your browser.</p></div></div>
      <div class="benefit-tile surface lavender"><span class="clay-icon"><Icon name="bolt" size={23} /></span><div><strong>Skip the setup</strong><p>Pick a tool. Drop in your data. Done.</p></div></div>
      <div class="benefit-tile surface butter"><span class="clay-icon"><Icon name="grid" size={23} /></span><div><strong>A growing little collection</strong><p>Independent tools, brought together.</p></div></div>
    </section>

    <section class="catalog-section" id="tools" aria-labelledby="catalog-title">
      <div class="section-heading"><div><p class="eyebrow">Make room for a shortcut</p><h2 id="catalog-title">What can we help with?</h2></div><span class="count-pill">{tools.length} {tools.length === 1 ? 'handy tool' : 'handy tools'} & counting</span></div>
      <div class="catalog-controls surface">
        <div class="search-input-wrap"><Icon name="search" size={21} /><label class="sr-only" for="tool-search">Search the toolbox</label><input id="tool-search" type="search" bind:value={query} placeholder="Try “JSON”, “XML”, or a task…" /><kbd>/</kbd></div>
        <div class="chips" aria-label="Tool categories">
          <button type="button" class:active={selectedCategory === 'all'} aria-pressed={selectedCategory === 'all'} onclick={() => selectedCategory = 'all'}><Icon name="grid" size={16} /> All tools</button>
          {#each categories as category}<button type="button" class:active={selectedCategory === category} aria-pressed={selectedCategory === category} onclick={() => selectedCategory = category}>{categoryNames[category]}</button>{/each}
        </div>
      </div>
      {#if searchError}<p role="status">{searchError}</p>{/if}
      <p class="sr-only" role="status">{filteredTools.length} tools found</p>
      <div class="tool-grid">
        {#each filteredTools as tool}
          <a class="tool-card surface" href={`${base}${tool.path}/`}>
            <div class="tool-card-top"><span class="clay-icon peach"><Icon name={tool.category === 'data' || tool.category === 'developer' ? 'braces' : 'toolbox'} size={30} /></span><span class="tool-status"><span class="status-dot"></span> Ready to help</span></div>
            <div class="tool-card-copy"><span class="eyebrow">{categoryNames[tool.category]}</span><h3>{tool.name}</h3><p>{tool.id === 'json-tools' ? 'Messy JSON? Make it readable, find just the bits you need, or turn it into XML. All in one tidy spot.' : tool.description}</p></div>
            <div class="tool-capabilities">{#each tool.capabilities.slice(0, 3) as capability}<span>{capability.replaceAll('-', ' ')}</span>{/each}</div>
            <div class="tool-card-bottom"><span>Open {tool.name}</span><span class="round-arrow"><Icon name="arrow-right" size={21} /></span></div>
          </a>
        {:else}
          <div class="empty-state surface"><span class="clay-icon lavender"><Icon name="search" size={30} /></span><h3>{tools.length ? 'No little helpers found. Yet.' : 'The toolbox is getting ready.'}</h3><p>{tools.length ? 'Try a different word, or clear your filters to see the whole toolbox.' : 'Our first tools are on their way. Check back for a fresh little shortcut.'}</p>{#if tools.length}<button class="clay-button" type="button" onclick={() => { query = ''; selectedCategory = 'all'; }}>Show all tools <Icon name="arrow-right" size={18} /></button>{/if}</div>
        {/each}
        {#if !query && selectedCategory === 'all'}
          <aside class="collection-card surface lavender"><div class="mini-tool-scene" aria-hidden="true"><span class="mini-block one"><Icon name="toolbox" size={38} /></span><span class="mini-block two"><Icon name="sparkles" size={30} /></span><span class="mini-block three"><Icon name="braces" size={26} /></span></div><span class="eyebrow">Small collection. Big heart.</span><h3>Good things come<br />in little toolboxes.</h3><p>We’re starting small and making each helper count. More useful little things are on the way.</p><a class="text-link" href="https://github.com/ygrip/open-tools" target="_blank" rel="noreferrer">Have a tool in mind? <Icon name="arrow-right" size={18} /></a></aside>
        {/if}
      </div>
    </section>

    <section class="how-section surface" id="how-it-works" aria-labelledby="how-title">
      <div class="how-heading"><span class="eyebrow">Less figuring out. More getting done.</span><h2 id="how-title">A shortcut, not<br />another learning curve.</h2><p>No downloads. No account to remember. Just a small, useful thing when you need it.</p></div>
      <ol class="how-steps"><li><span class="step-number peach">01</span><div><h3>Find your little helper</h3><p>Browse the toolbox or search for your task.</p></div></li><li><span class="step-number mint">02</span><div><h3>Make yourself at home</h3><p>Open a tool and add what you’re working on.</p></div></li><li><span class="step-number lavender">03</span><div><h3>Take your small win</h3><p>Copy your result. Get back to your day.</p></div></li></ol>
    </section>
  </main>

  <footer class="site-footer"><a class="brand footer-brand" href={`${base}/`}><img src={`${base}/brand/logo.svg`} alt="" width="36" height="36" /><strong>opentools</strong></a><span>A little help goes a long way.</span><nav aria-label="Legal"><a href={`${base}/privacy`}>Privacy</a><a href={`${base}/terms`}>Terms</a><a href={`${base}/policy`}>Tool policy</a><a href="https://github.com/ygrip/open-tools" aria-label="Open Tools on GitHub" target="_blank" rel="noreferrer"><Icon name="github" size={20} /></a></nav></footer>
</div>
