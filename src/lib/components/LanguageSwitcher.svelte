<script lang="ts">
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { tick } from 'svelte';
  import { getLocale, locales, type Locale } from '$lib/paraglide/runtime.js';
  import { localizedPath } from '$lib/i18n';
  import { languages } from '$lib/languages.js';
  import { m } from '$lib/paraglide/messages.js';
  import ClayFlag from './ClayFlag.svelte';
  import Icon from './Icon.svelte';

  // Mobile quick settings closes before this modal opens. Both viewports use
  // this exact same searchable dialog, with one scrollable results area.
  let { onopen, onclose }: { onopen?: () => void; onclose?: () => void } = $props();
  const uid = $props.id();
  const titleId = uid + '-language-title';
  let dialog = $state<HTMLDialogElement | undefined>(undefined);
  let trigger = $state<HTMLButtonElement | undefined>(undefined);
  let searchInput = $state<HTMLInputElement | undefined>(undefined);
  let query = $state('');
  let open = $state(false);
  const current = $derived(languages.find((item) => item.code === getLocale()) ?? languages[0]);
  const visible = $derived(languages.filter((item) =>
    locales.includes(item.code as Locale) &&
    [item.native, item.english, item.code, item.aliases].join(' ').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(query.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  ));

  function href(locale: Locale) {
    return localizedPath(page.url.pathname, locale) + (browser ? page.url.search + page.url.hash : '');
  }

  async function show() {
    onopen?.();
    await tick();
    query = '';
    dialog?.showModal();
    open = true;
    await tick();
    searchInput?.focus();
  }

  function close() {
    dialog?.close();
    open = false;
    // On mobile the quick-settings menu has already collapsed, so its
    // language trigger is hidden. Restore focus to the visible settings button.
    if (onclose) onclose();
    else trigger?.focus();
  }

  // A modal nested inside a collapsed quick-settings item inherits its
  // visibility:hidden and inert state. Portalling the dialog into <body>
  // gives desktop and mobile identical top-layer focus/visibility behavior.
  function portal(node: HTMLDialogElement) {
    document.body.appendChild(node);
    return { destroy: () => node.remove() };
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const options = Array.from(dialog?.querySelectorAll<HTMLAnchorElement>('.language-option') ?? []);
    const selected = options.indexOf(document.activeElement as HTMLAnchorElement);
    if (!options.length) return;
    event.preventDefault();
    const next = selected < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1)
      : (selected + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options[next]?.focus();
  }
</script>

<nav class="language-switcher" aria-label={m.languages()}>
  <button bind:this={trigger} class="language-trigger" type="button"
    aria-label={m.languages() + ': ' + current.native} aria-haspopup="dialog" aria-expanded={open}
    onclick={show}>
    <span class="trigger-globe"><Icon name="globe" size={22} /></span>
    <span class="trigger-flag"><ClayFlag locale={getLocale()} size={23} /></span>
  </button>

  <dialog bind:this={dialog} use:portal class="language-dialog surface" aria-labelledby={titleId}
    onkeydown={onKeydown}
    oncancel={(event) => { event.preventDefault(); close(); }}
    onclick={(event) => { if (event.target === dialog) close(); }}
    onclose={() => { open = false; }}>
    <div class="language-dialog-inner">
      <div class="language-heading">
        <div class="language-heading-copy">
          <span class="language-heading-icon"><Icon name="globe" size={22} /></span>
          <h2 id={titleId}>{m.languages()}</h2>
        </div>
        <button type="button" class="language-close" aria-label={m.overlay_close()} onclick={close}><Icon name="x" size={19} /></button>
      </div>
      <label class="language-search">
        <Icon name="search" size={21} />
        <span class="sr-only">{m.language_search()}</span>
        <input bind:this={searchInput} type="search" bind:value={query} autocomplete="off"
          placeholder={m.language_search()} aria-label={m.language_search()} />
      </label>
      <div class="language-results" role="group" aria-label={m.languages()}>
        {#each visible as item (item.code)}
          <a class="language-option" href={href(item.code as Locale)} hreflang={item.code} lang={item.code}
            aria-current={getLocale() === item.code ? 'page' : undefined} data-sveltekit-reload>
            <span class="language-option-flag"><ClayFlag locale={item.code} size={37} /></span>
            <span class="language-option-copy"><strong>{item.native}</strong><small>{item.english === item.native ? item.code.toUpperCase() : item.english}</small></span>
            {#if getLocale() === item.code}<span class="language-selected"><Icon name="check" size={18} /></span>{/if}
          </a>
        {:else}
          <p class="language-empty" role="status">{m.language_empty()}</p>
        {/each}
      </div>
      <p class="language-tip">{m.language_hint()}</p>
    </div>
  </dialog>
</nav>

<style>
  .language-switcher { position: relative; flex: 0 0 auto; }
  .language-trigger {
    position: relative; display: grid; place-items: center; width: 48px; height: 48px;
    padding: 0; border: 1px solid var(--line); border-radius: 16px;
    background: var(--surface); color: var(--text);
    box-shadow: 0 3px 0 var(--line), inset 1px 2px 2px var(--highlight);
    cursor: pointer;
    transition: transform var(--duration-quick) var(--ease-smooth-out), background var(--duration-quick) var(--ease-smooth-out);
  }
  .language-trigger:hover { transform: translateY(-2px); background: var(--surface-strong); }
  .language-trigger:active { transform: translateY(1px); }
  .language-trigger:focus-visible, .language-close:focus-visible, .language-option:focus-visible,
  .language-search:focus-within { outline: 3px solid var(--accent-strong); outline-offset: 2px; }
  .trigger-globe { display: grid; place-items: center; transform: translate(-3px, -3px); }
  .trigger-flag { position: absolute; right: 2px; bottom: 2px; padding: 2px 1px; background: var(--surface); border-radius: 5px; pointer-events: none; }

  /* Native modal places the selector above quick-settings/backdrop and traps focus. */
  .language-dialog {
    position: fixed; inset: 0; margin: auto; box-sizing: border-box;
    width: min(480px, calc(100vw - 28px)); max-width: none;
    height: min(640px, calc(100dvh - 44px)); max-height: none;
    padding: 0; color: var(--text); background: var(--surface-strong);
    border: 1px solid var(--line); border-radius: 24px;
    box-shadow: 0 6px 0 -1px var(--line), 0 24px 60px -15px var(--shadow), inset 2px 3px 2px var(--highlight);
    overscroll-behavior: contain;
  }
  .language-dialog::backdrop { background: rgb(18 21 28 / .54); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); }
  .language-dialog[open] { animation: language-enter var(--duration-fast) var(--ease-smooth-out); }
  .language-dialog-inner { display: flex; flex-direction: column; min-height: 0; height: 100%; }
  .language-heading {
    flex: 0 0 auto; display: flex; justify-content: space-between; align-items: center;
    padding: 17px 18px 10px; gap: 12px;
  }
  .language-heading-copy { display: flex; align-items: center; gap: 11px; min-width: 0; }
  .language-heading-icon { display: grid; place-items: center; width: 38px; height: 38px; color: var(--accent-strong); background: var(--peach); border-radius: 13px; }
  .language-heading h2 { margin: 0; font-size: 18px; font-weight: 850; }
  .language-close { width: 42px; height: 42px; flex: 0 0 auto; border-radius: 13px; border: 1px solid var(--line); background: var(--surface); color: var(--text); display: grid; place-items: center; cursor: pointer; }
  .language-search {
    flex: 0 0 auto; display: flex; align-items: center; gap: 10px; margin: 5px 18px 10px; padding: 0 13px;
    min-height: 52px; border: 1px solid var(--line); border-radius: 15px; background: var(--surface); color: var(--muted);
  }
  .language-search input {
    width: 100%; min-width: 0; height: 50px; background: transparent; border: none;
    outline: none; color: var(--text); font: inherit; font-size: 15px;
  }
  .language-search input::placeholder { color: var(--muted); }
  .language-results {
    flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
    scrollbar-gutter: stable; padding: 2px 12px 12px 18px; display: flex; flex-direction: column; gap: 4px;
  }
  .language-option {
    display: flex; align-items: center; min-height: 63px; gap: 12px; padding: 9px 11px;
    border-radius: 15px; color: var(--text); text-decoration: none;
    transition: background var(--duration-quick) var(--ease-smooth-out);
  }
  .language-option:hover, .language-option:focus-visible, .language-option[aria-current='page'] { background: var(--peach); }
  .language-option-flag { width: 48px; height: 43px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 12px; background: var(--surface); box-shadow: inset 0 2px 2px var(--highlight), 0 2px 0 var(--line); }
  .language-option-copy { display: grid; gap: 3px; min-width: 0; flex: 1; }
  .language-option-copy strong { font-size: 15px; font-weight: 800; overflow-wrap: anywhere; }
  .language-option-copy small { font-size: 12px; color: var(--muted); }
  .language-selected { color: var(--accent-strong); flex: 0 0 auto; }
  .language-empty { padding: 28px 12px; text-align: center; color: var(--muted); }
  .language-tip { margin: 0; padding: 12px 20px 15px; flex: 0 0 auto; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; }
  @keyframes language-enter { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
  @media (max-width: 480px) {
    .language-dialog { height: min(620px, calc(100dvh - 24px)); border-radius: 20px; }
    .language-results { padding-left: 10px; padding-right: 6px; }
    .language-option { min-height: 61px; }
  }
  @media (prefers-reduced-motion: reduce) { .language-dialog[open] { animation: none; } .language-trigger, .language-option { transition: none; } }
  @media (forced-colors: active) { .language-trigger, .language-option[aria-current='page'], .language-dialog { border: 1px solid ButtonText; } }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
