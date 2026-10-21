<script lang="ts">
  import { base } from '$app/paths';
  import { localizedPath } from '$lib/i18n';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';

  let { data }: { data: {
    kind: 'terms' | 'policy';
    title: string;
    eyebrow: string;
    intro: string;
    updated: string;
    shortTitle: string;
    summary: string;
    illustrationAlt: string;
    sections: { title: string; text: string }[];
    relatedAria: string;
    relatedTitle: string;
    related: { path: string; label: string }[];
  }} = $props();
</script>

<main id="main-content" class="page-shell legal-shell">
  <div class="legal-top">
    <a class="legal-back" href={localizedPath('/')}>← trick-it</a>
    <LanguageSwitcher />
  </div>
  <article class="legal-card legal-feature surface">
    <header class="legal-hero">
      <div class="legal-hero-copy">
        <p class="eyebrow">{data.eyebrow}</p>
        <h1>{data.title}</h1>
        <p class="legal-lede">{data.intro}</p>
        <p class="legal-updated">{data.updated}</p>
      </div>
      <img class="legal-hero-art" src={`${base}/illustrations/${data.kind}-clay.svg`} alt={data.illustrationAlt} width="360" height="270" decoding="async" />
    </header>
    <aside class="legal-summary" aria-label={data.shortTitle}>
      <strong>{data.shortTitle}</strong>
      <p>{data.summary}</p>
    </aside>
    <div class="legal-sections">
      {#each data.sections as section, index}
        <section class="legal-section">
          <span class="legal-section-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <div><h2>{section.title}</h2><p>{section.text}</p></div>
        </section>
      {/each}
    </div>
    <nav class="legal-related" aria-label={data.relatedAria}>
      <strong>{data.relatedTitle}</strong>
      <div class="legal-related-links">
        {#each data.related as link}
          <a href={localizedPath(link.path)}>{link.label} <span aria-hidden="true">↗</span></a>
        {/each}
      </div>
    </nav>
  </article>
</main>
