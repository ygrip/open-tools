<script lang="ts">
  import { getLocale } from '$lib/paraglide/runtime.js';
  import config from '$lib/seo/generated.json';
  import { seoMetadata, safeJsonLd } from '$lib/seo/metadata.js';

  let { title, description, path, image, keywords = [], robots = 'index', tool, locale }: {
    title: string;
    description: string;
    path: string;
    image?: string;
    keywords?: string[];
    robots?: 'index' | 'noindex';
    tool?: { id: string; name: string; version: string; category: string; description?: string; locales?: string[] };
    locale?: 'en' | 'id';
  } = $props();
  const generatedImages: Record<string, string> = config.images;
  const language = $derived(locale ?? getLocale());
  const socialImage = $derived(image ?? generatedImages[`${tool ? `tools/${tool.id}` : 'home'}-${language}`]);
  const metadata = $derived(seoMetadata({ title, description, path, image: socialImage, keywords, robots, tool, locale: language, origin: config.origin, base: config.base }));
</script>

<svelte:head>
  <title>{metadata.title}</title>
  <meta name="description" content={metadata.description} />
  {#if metadata.keywords}<meta name="keywords" content={metadata.keywords} />{/if}
  <meta name="robots" content={metadata.robots} />
  {#if metadata.canonical}
    <link rel="canonical" href={metadata.canonical} />
    {#each metadata.alternates as alternate}<link rel="alternate" hreflang={alternate.locale} href={alternate.href} />{/each}
    <link rel="alternate" hreflang="x-default" href={metadata.defaultHref} />
    <meta property="og:url" content={metadata.canonical} />
  {/if}
  <meta property="og:site_name" content="trick-it" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content={metadata.title} />
  <meta property="og:description" content={metadata.description} />
  <meta property="og:locale" content={metadata.locale} />
  <meta property="og:locale:alternate" content={metadata.alternateLocale} />
  <meta property="og:image" content={metadata.image} />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content={metadata.imageAlt} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={metadata.title} />
  <meta name="twitter:description" content={metadata.description} />
  <meta name="twitter:image" content={metadata.image} />
  <meta name="twitter:image:alt" content={metadata.imageAlt} />
  {#if metadata.schema}{@html `<script type="application/ld+json">${safeJsonLd(metadata.schema)}</script>`}{/if}
</svelte:head>
