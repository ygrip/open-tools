<script lang="ts">
  import { tick } from 'svelte';
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { getLocale, locales } from '$lib/paraglide/runtime.js';
  import { localizedPath } from '$lib/i18n';
  import { m } from '$lib/paraglide/messages.js';
  import ClayFlag from './ClayFlag.svelte';
  import Icon from './Icon.svelte';

  // Desktop gets a compact, accessible popover. The mobile quick-settings
  // control continues to use the two direct language links.
  let { popover = false }: { popover?: boolean } = $props();
  type Locale = (typeof locales)[number];
  const labels: Record<Locale, string> = { en: 'English', id: 'Bahasa Indonesia' };
  const panelId = $props.id() + '-language-panel';
  let open = $state(false);
  let root: HTMLElement;
  let trigger: HTMLButtonElement;

  function href(locale: Locale) {
    return localizedPath(page.url.pathname, locale) + (browser ? page.url.search + page.url.hash : '');
  }

  function close(restoreFocus = false) {
    open = false;
    if (restoreFocus) trigger?.focus();
  }

  async function openWithKeyboard(last = false) {
    open = true;
    await tick();
    const options = root.querySelectorAll<HTMLAnchorElement>('.language-option');
    (last ? options[options.length - 1] : options[0])?.focus();
  }

  function onKeydown(event: KeyboardEvent) {
    if (!popover) return;
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      close(true);
      return;
    }
    if (!open && event.target === trigger && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      void openWithKeyboard(event.key === 'ArrowUp');
      return;
    }
    if (!open || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const options = Array.from(root.querySelectorAll<HTMLAnchorElement>('.language-option'));
    if (!options.length) return;
    const index = options.indexOf(document.activeElement as HTMLAnchorElement);
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? options.length - 1
      : event.key === 'ArrowDown' ? (index + 1) % options.length
      : (index < 0 ? options.length - 1 : (index - 1 + options.length) % options.length);
    event.preventDefault();
    options[next].focus();
  }

  function onFocusOut(event: FocusEvent) {
    if (popover && open && (!event.relatedTarget || !root.contains(event.relatedTarget as Node))) {
      close();
    }
  }

  function onOutsidePointerDown(event: PointerEvent) {
    if (popover && open && !root.contains(event.target as Node)) close();
  }
</script>

<svelte:window onpointerdowncapture={onOutsidePointerDown} />

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<nav bind:this={root} class="language-switcher" class:language-popover={popover} aria-label={m.languages()} onkeydown={onKeydown} onfocusout={onFocusOut}>
  {#if popover}
    <button bind:this={trigger} class="language-trigger" type="button"
      aria-label={m.languages() + ': ' + labels[getLocale()]} title={m.languages() + ': ' + labels[getLocale()]}
      aria-expanded={open} aria-controls={panelId}
      onclick={() => (open = !open)}>
      <span class="trigger-globe"><Icon name="globe" size={22} /></span>
      <span class="trigger-flag"><ClayFlag locale={getLocale()} size={23} /></span>
    </button>
    {#if open}
      <div id={panelId} class="language-panel" role="group" aria-label={m.languages()}>
        <span class="language-title">{m.languages()}</span>
        {#each locales as locale}
          <a class="language-option" href={href(locale)} hreflang={locale} lang={locale}
            aria-current={getLocale() === locale ? 'page' : undefined} data-sveltekit-reload>
            <ClayFlag {locale} size={34} />
            <span class="option-label">{labels[locale]}</span>
            {#if getLocale() === locale}<Icon name="check" size={17} />{/if}
          </a>
        {/each}
      </div>
    {/if}
  {:else}
    {#each locales as locale}
      <a href={href(locale)} aria-current={getLocale() === locale ? 'page' : undefined}
        hreflang={locale} lang={locale} data-sveltekit-reload>
        <ClayFlag {locale} size={28} />
        <span class="language-code">{locale.toUpperCase()}</span>
        <span class="sr-only"> {labels[locale]}</span>
      </a>
    {/each}
  {/if}
</nav>

<style>
  .language-switcher {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
    white-space: nowrap;
  }
  .language-switcher:not(.language-popover) a {
    min-width: 40px;
    min-height: 40px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 0 3px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 850;
    color: var(--muted);
    text-decoration: none;
  }
  .language-switcher:not(.language-popover) a[aria-current='page'] {
    background: var(--peach);
    color: var(--text);
  }
  .language-code { font-size: 10px; }
  .language-switcher a:focus-visible, .language-trigger:focus-visible {
    outline: 3px solid var(--accent-strong);
    outline-offset: 2px;
  }

  .language-popover {
    position: relative;
    padding: 0;
    border: 0;
    background: transparent;
    flex: 0 0 auto;
  }
  .language-trigger {
    position: relative;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 3px 0 var(--line), inset 1px 2px 2px var(--highlight);
    cursor: pointer;
    transition: transform var(--duration-quick) var(--ease-smooth-out), background var(--duration-quick) var(--ease-smooth-out);
  }
  .language-trigger:hover { transform: translateY(-2px); background: var(--surface-strong); }
  .language-trigger:active { transform: translateY(2px); }
  .language-trigger[aria-expanded='true'] { background: var(--peach); }
  .trigger-globe { display: grid; place-items: center; transform: translate(-3px, -3px); }
  .trigger-flag {
    position: absolute;
    right: 2px;
    bottom: 2px;
    padding: 2px 1px;
    background: var(--surface);
    border-radius: 5px;
    pointer-events: none;
  }

  .language-panel {
    position: absolute;
    z-index: 50;
    top: calc(100% + 13px);
    right: 0;
    width: max-content;
    min-width: 246px;
    padding: 10px;
    border: 1px solid var(--line);
    border-radius: 20px;
    background: var(--surface-strong);
    color: var(--text);
    box-shadow: 0 5px 0 -1px var(--line), 0 20px 35px -14px var(--shadow), inset 2px 3px 2px var(--highlight);
    transform-origin: right top;
    animation: language-in var(--duration-fast) var(--ease-smooth-out);
  }
  .language-title {
    display: block;
    padding: 4px 11px 9px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 850;
  }
  .language-option {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    padding: 9px 10px;
    border-radius: 13px;
    color: var(--text);
    font-size: 14px;
    font-weight: 850;
    text-decoration: none;
    transition: background var(--duration-quick) var(--ease-smooth-out);
  }
  .language-option:hover, .language-option:focus-visible { background: var(--peach); }
  .language-option[aria-current='page'] { background: var(--peach); }
  .option-label { flex: 1; }
  .language-option :global(svg:last-child:not(:first-child)) { color: var(--accent-strong); }
  @keyframes language-in {
    from { opacity: 0; transform: translateY(-5px) scale(.97); }
    to { opacity: 1; transform: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    .language-panel { animation: none; }
    .language-trigger, .language-option { transition: none; }
  }
  @media (forced-colors: active) {
    .language-trigger, .language-panel, .language-option[aria-current='page'] { border: 1px solid ButtonText; }
  }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
