<script lang="ts">
  import { tick } from 'svelte';
  import { m } from '$lib/paraglide/messages.js';
  import Icon from './Icon.svelte';
  import LanguageSwitcher from './LanguageSwitcher.svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import ShareButton from './ShareButton.svelte';
  import type { ToolManifest } from '$lib/registry/types';

  // Compact mobile control: one liquid "goo" button that drips out language, theme and (optionally) share.
  // While open it behaves modally: a blurred backdrop covers the page and everything outside the menu is inert.
  let { share = false, tool = null, catalog = [] }: { share?: boolean; tool?: ToolManifest | null; catalog?: ToolManifest[] } = $props();

  const uid = $props.id();
  const panelId = `${uid}-panel`;
  let open = $state(false);
  let root: HTMLDivElement;
  let trigger: HTMLButtonElement;
  let panel: HTMLDivElement;
  let backdrop: HTMLDivElement;
  let shareDialog = $state<ReturnType<typeof ShareButton>>();

  // Make every element outside the menu's ancestor chain inert (keyboard, pointer, assistive tech); restore on close.
  $effect(() => {
    if (!open) return;
    const host = root.closest('header');
    const changed: HTMLElement[] = [];
    for (let node: HTMLElement | null = root; node && node !== document.body; node = node.parentElement) {
      for (const sibling of node.parentElement?.children ?? []) {
        if (sibling === node || sibling === backdrop || !(sibling instanceof HTMLElement) || sibling.inert) continue;
        sibling.inert = true;
        if (host?.contains(sibling)) sibling.classList.add('qs-dimmed');
        changed.push(sibling);
      }
    }
    return () => {
      for (const element of changed) {
        element.inert = false;
        element.classList.remove('qs-dimmed');
      }
    };
  });

  function close(returnFocus = false) {
    open = false;
    if (returnFocus) trigger.focus();
  }

  function panelItems() {
    return Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
  }

  function focusables() {
    return [trigger, ...panelItems()];
  }

  // Arrow keys move through trigger + options; Tab wraps inside the menu while it is open.
  function moveFocus(event: KeyboardEvent) {
    const items = focusables();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const last = items.length - 1;
    if (event.key === 'Tab') {
      const next = event.shiftKey ? (current <= 0 ? last : current - 1) : current >= last ? 0 : current + 1;
      event.preventDefault();
      items[next].focus();
      return;
    }
    const next = { ArrowDown: current + 1, ArrowUp: current - 1, Home: 0, End: last }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    items[Math.max(0, Math.min(last, next))].focus();
  }

  async function openAndFocus(index: 'first' | 'last') {
    open = true;
    await tick();
    const items = panelItems();
    (index === 'first' ? items[0] : items.at(-1))?.focus();
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      close(true);
    } else if (!open && event.target === trigger && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      openAndFocus(event.key === 'ArrowDown' ? 'first' : 'last');
    } else if (open) {
      moveFocus(event);
    }
  }

  // Clicks on inert header parts are retargeted to their nearest live ancestor; treat any outside click as "close".
  // `click` (not pointerdown) so the closing tap is consumed and never activates what lies underneath.
  function onWindowClick(event: MouseEvent) {
    if (open && !root.contains(event.target as Node)) {
      event.preventDefault();
      close();
    }
  }

  async function openShare() {
    close(true); // focus returns to the trigger, which the share dialog restores focus to when it closes
    await tick();
    shareDialog?.openDialog();
  }

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }
</script>

<svelte:window onclickcapture={onWindowClick} />

<div class="qs-backdrop" class:open bind:this={backdrop} use:portal aria-hidden="true"></div>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="quick-settings" class:open class:has-share={share} bind:this={root} onkeydown={onKeydown}>
  <svg class="goo-defs" width="0" height="0" aria-hidden="true" focusable="false">
    <filter id="quick-settings-goo">
      <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
      <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8" result="goo" />
      <feComposite in="SourceGraphic" in2="goo" operator="atop" />
    </filter>
  </svg>
  <div class="goo-shadow" aria-hidden="true">
    <div class="goo">
      <span class="blob blob-trigger"></span>
      <span class="blob blob-lang"></span>
      <span class="blob blob-theme"></span>
      {#if share}<span class="blob blob-share"></span>{/if}
    </div>
  </div>

  <button
    bind:this={trigger}
    class="qs-trigger"
    type="button"
    aria-expanded={open}
    aria-controls={panelId}
    aria-label={m.quick_options()}
    title={m.quick_options()}
    onclick={() => (open ? close() : openAndFocus('first'))}
  >
    <span class="qs-icon" data-icon="settings"><Icon name="sliders" size={22} /></span>
    <span class="qs-icon" data-icon="close"><Icon name="x" size={22} /></span>
  </button>

  <div bind:this={panel} id={panelId} class="qs-panel" role="group" aria-label={m.quick_options()} inert={!open}>
    <div class="qs-item qs-lang"><LanguageSwitcher /></div>
    <div class="qs-item qs-theme"><ThemeToggle /></div>
    {#if share}
      <div class="qs-item qs-share">
        <button class="qs-share-button" type="button" aria-haspopup="dialog" aria-label={m.share_label()} title={m.share_label()} onclick={openShare}><Icon name="share" size={20} /></button>
      </div>
    {/if}
  </div>
  {#if share}<ShareButton bind:this={shareDialog} variant="none" {tool} {catalog} />{/if}
</div>

<style>
  .quick-settings {
    --size: 48px;
    --gap: 10px;
    /* Language pill: two 44px targets + 4px inset, so every option meets the 44px touch-target guideline. */
    --lang-width: 104px;
    --lang-height: 52px;
    --lang-y: calc(var(--size) + var(--gap));
    --theme-y: calc(var(--lang-y) + var(--lang-height) + var(--gap));
    --share-y: calc(var(--theme-y) + var(--size) + var(--gap));
    --last-y: var(--theme-y);
    --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
    width: var(--size);
    height: var(--size);
    flex: 0 0 auto;
  }
  .quick-settings.has-share { --last-y: var(--share-y); }
  .goo-defs { position: absolute; width: 0; height: 0; }

  /* Page-wide modal backdrop (portalled to <body>); the header sits above it at z-index 30. */
  .qs-backdrop {
    position: fixed;
    inset: 0;
    z-index: 29;
    background: color-mix(in srgb, var(--bg) 45%, transparent);
    backdrop-filter: blur(6px) saturate(0.9);
    -webkit-backdrop-filter: blur(6px) saturate(0.9);
    opacity: 0;
    pointer-events: none;
    transition: opacity var(--duration-fast) var(--ease-smooth-out);
  }
  .qs-backdrop.open { opacity: 1; pointer-events: auto; }
  /* Header parts made inert while the menu is open fade back so the options stand out. */
  :global(.qs-dimmed) { opacity: 0.35; filter: blur(1.5px); transition: opacity var(--duration-fast) var(--ease-smooth-out), filter var(--duration-fast) var(--ease-smooth-out); }

  /* Blob layer: blurred + thresholded so neighbouring blobs melt together. Controls sit on top, unfiltered, so text stays crisp. */
  .goo-shadow {
    position: absolute;
    top: -16px;
    right: -16px;
    width: calc(var(--lang-width) + 32px);
    height: calc(var(--last-y) + var(--size) + 32px);
    pointer-events: none;
    filter: drop-shadow(0 0 0.6px var(--line)) drop-shadow(0 4px 0 var(--line)) drop-shadow(0 10px 14px var(--shadow));
  }
  .goo { position: absolute; inset: 0; filter: url(#quick-settings-goo); }
  .blob {
    position: absolute;
    top: 16px;
    right: 16px;
    width: var(--size);
    height: var(--size);
    border-radius: 999px;
    background: var(--surface);
    transition: transform var(--duration-slow) var(--spring), width var(--duration-slow) var(--spring), height var(--duration-slow) var(--spring);
  }
  .blob-lang, .blob-theme, .blob-share { transform: translateY(0) scale(0.5); }
  .open .blob-lang { width: var(--lang-width); height: var(--lang-height); transform: translateY(var(--lang-y)); }
  .open .blob-theme { transform: translateY(var(--theme-y)); transition-delay: 60ms; }
  .open .blob-share { transform: translateY(var(--share-y)); transition-delay: 120ms; }
  .open .blob-trigger { background: var(--peach); }

  .qs-trigger, .qs-share-button {
    position: relative;
    z-index: 2;
    width: var(--size);
    height: var(--size);
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--text);
    cursor: pointer;
  }
  .qs-trigger:active, .qs-share-button:active { transform: translateY(2px); }
  .qs-icon { grid-area: 1 / 1; line-height: 0; transition: opacity var(--duration-fast) var(--ease-smooth-out), transform var(--duration-fast) var(--ease-smooth-out); }
  .qs-icon[data-icon='close'] { opacity: 0; transform: rotate(-90deg) scale(0.6); }
  .open .qs-icon[data-icon='settings'] { opacity: 0; transform: rotate(90deg) scale(0.6); }
  .open .qs-icon[data-icon='close'] { opacity: 1; transform: none; }

  .qs-panel { position: absolute; top: 0; right: 0; z-index: 3; }
  .qs-item {
    position: absolute;
    right: 0;
    top: 0;
    display: grid;
    place-items: center;
    height: var(--size);
    opacity: 0;
    visibility: hidden;
    transform: translateY(0) scale(0.6);
    transition: opacity var(--duration-fast) var(--ease-smooth-out), transform var(--duration-slow) var(--spring), visibility 0s linear var(--duration-slow);
  }
  .qs-lang { width: var(--lang-width); height: var(--lang-height); }
  .qs-theme, .qs-share { width: var(--size); }
  .open .qs-item { opacity: 1; visibility: visible; transition-delay: 80ms, 0s, 0s; }
  .open .qs-lang { transform: translateY(var(--lang-y)); }
  .open .qs-theme { transform: translateY(var(--theme-y)); transition-delay: 140ms, 60ms, 0s; }
  .open .qs-share { transform: translateY(var(--share-y)); transition-delay: 200ms, 120ms, 0s; }

  /* Reused controls drop their own chrome; the blob behind them is the surface. */
  .qs-item :global(.language-switcher) { padding: 4px; gap: 4px; border: 0; background: transparent; }
  .qs-item :global(.language-switcher a) { min-width: 44px; min-height: 44px; font-size: 14px; border-radius: 999px; }
  .qs-item :global(.theme-toggle) { width: var(--size); height: var(--size); border: 0; border-radius: 999px; background: transparent; box-shadow: none; }

  /* High-visibility focus: 3px ring with an inner surface gap so it reads on the blob and the page alike. */
  .qs-trigger:focus-visible,
  .qs-share-button:focus-visible,
  .qs-item :global(.theme-toggle:focus-visible),
  .qs-item :global(.language-switcher a:focus-visible) {
    outline: 3px solid var(--accent-strong);
    outline-offset: 2px;
    box-shadow: 0 0 0 2px var(--surface);
  }

  @media (prefers-reduced-motion: reduce) {
    .blob, .qs-icon, .qs-item, .qs-backdrop, :global(.qs-dimmed) { transition: none !important; }
  }

  /* Windows High Contrast drops backgrounds and filters: draw real borders instead of blobs. */
  @media (forced-colors: active) {
    .goo-shadow { display: none; }
    .qs-trigger, .qs-item { border: 1px solid ButtonText; border-radius: 999px; background: Canvas; }
  }
</style>
