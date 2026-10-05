<script lang="ts">
  let {
    href,
    title,
    description,
    eyebrow = '',
    meta = '',
    children
  }: {
    href?: string;
    title: string;
    description?: string;
    eyebrow?: string;
    meta?: string;
    children?: import('svelte').Snippet;
  } = $props();
</script>

{#if href}
  <a class="ui-card surface" {href}>
    {#if eyebrow}<span class="ui-card-eyebrow">{eyebrow}</span>{/if}
    <h3>{title}</h3>
    {#if description}<p>{description}</p>{/if}
    {#if children}{@render children()}{/if}
    {#if meta}<span class="ui-card-meta">{meta}</span>{/if}
  </a>
{:else}
  <article class="ui-card surface">
    {#if eyebrow}<span class="ui-card-eyebrow">{eyebrow}</span>{/if}
    <h3>{title}</h3>
    {#if description}<p>{description}</p>{/if}
    {#if children}{@render children()}{/if}
    {#if meta}<span class="ui-card-meta">{meta}</span>{/if}
  </article>
{/if}
