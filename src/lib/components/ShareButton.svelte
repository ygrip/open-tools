<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import Icon from './Icon.svelte';
  import { generateShareImage, nativeShare, copyLink, downloadBlob, type SharePayload } from '$lib/share';
  import type { ToolManifest } from '$lib/registry/types';

  let { tool = null, catalog = [], variant = 'button' }: { tool?: ToolManifest | null; catalog?: ToolManifest[]; variant?: 'button' | 'link' | 'none' } = $props();

  let dialog = $state<HTMLDialogElement | null>(null);
  let open = $state(false);
  let phase = $state('');
  let blob = $state<Blob | null>(null);
  let previewUrl = $state('');
  let loading = $state(false);
  let failed = $state(false);
  let status = $state('');
  let canShare = $state(false);
  let payload: SharePayload | null = null;
  let returnFocus: HTMLElement | null = null;

  const title = $derived(tool ? m.share_title_tool() : m.share_title());

  function buildPayload(): SharePayload {
    const url = new URL(location.href);
    url.hash = '';
    if (tool) {
      return {
        title: tool.name,
        description: tool.description,
        eyebrow: tool.category,
        icon: tool.icon,
        chips: tool.capabilities.slice(0, 4).map((c) => c.replaceAll('-', ' ')),
        footnote: m.share_card_private(),
        brandTagline: m.brand_tagline(),
        url: url.href
      };
    }
    return {
      title: `${m.hero_small()} ${m.hero_big()} ${m.hero_wins()}`.replace(/\s+/g, ' ').trim(),
      description: m.hero_description(),
      icon: 'toolbox',
      icons: catalog.slice(0, 3).map((t) => t.icon),
      chips: catalog.slice(0, 4).map((t) => t.name),
      footnote: m.share_card_private(),
      brandTagline: m.brand_tagline(),
      url: url.href
    };
  }

  // Exported so a host (e.g. the mobile quick-settings menu) can open the dialog with variant="none".
  export async function openDialog() {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    status = '';
    failed = false;
    payload = buildPayload();
    open = true;
    dialog?.showModal();
    requestAnimationFrame(() => { phase = 'is-open'; });
    loading = true;
    try {
      blob = await generateShareImage(payload);
      if (blob) previewUrl = URL.createObjectURL(blob);
      else failed = true;
    } catch {
      failed = true;
    } finally {
      loading = false;
    }
  }

  function close() {
    if (!open) return;
    open = false;
    phase = 'is-closing';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      dialog?.close();
      phase = '';
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = '';
      blob = null;
      if (returnFocus?.isConnected) returnFocus.focus();
    }, reduced ? 0 : 150);
  }

  async function share() {
    if (!payload) return;
    const ok = await nativeShare(payload, tool ? m.share_tool_text() : m.share_home_text(), blob);
    if (ok) close();
  }

  async function copy() {
    if (!payload) return;
    status = (await copyLink(payload.url)) ? m.share_copied() : m.share_copy_failed();
  }

  function save() {
    if (blob) downloadBlob(blob, `trick-it-${tool?.id ?? 'home'}.png`);
  }
</script>

{#if variant === 'link'}
  <button class="share-link" type="button" onclick={openDialog}><Icon name="share" size={18} /> {m.share_label()}</button>
{:else if variant === 'button'}
  <button class="clay-button small share-button" type="button" onclick={openDialog} aria-haspopup="dialog" aria-label={m.share_label()}><Icon name="share" size={18} /><span>{m.share_label()}</span></button>
{/if}

<dialog bind:this={dialog} class="share-dialog surface t-modal {phase}" aria-label={title} oncancel={(event) => { event.preventDefault(); close(); }} onclick={(event) => { if (event.target === dialog) close(); }}>
  <div class="share-head">
    <h2>{title}</h2>
    <button type="button" class="icon-button" aria-label={m.share_close()} onclick={close}><Icon name="x" size={18} /></button>
  </div>
  <div class="share-preview" aria-busy={loading}>
    {#if previewUrl}
      <img src={previewUrl} alt={m.share_preview_alt()} width="540" height="540" />
    {:else if failed}
      <p role="alert">{m.share_failed()}</p>
    {:else}
      <div class="share-loading" role="status"><span class="share-blob"></span><span class="share-blob b"></span><span class="share-blob c"></span><p>{m.share_generating()}</p></div>
    {/if}
  </div>
  <div class="share-actions">
    {#if canShare}<button class="clay-button primary" type="button" onclick={share}><Icon name="share" size={18} /> {m.share_native()}</button>{/if}
    <button class="clay-button" class:primary={!canShare} type="button" onclick={copy}><Icon name="link" size={18} /> {m.share_copy()}</button>
    <button class="clay-button" type="button" onclick={save} disabled={!blob}><Icon name="download" size={18} /> {m.share_download()}</button>
  </div>
  <p class="share-status" role="status" aria-live="polite">{status}</p>
</dialog>

<style>
  .share-link { display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 4px; font: inherit; font-weight: 800; color: inherit; background: none; border: 0; cursor: pointer; }
  .share-link:hover { color: var(--accent-strong); }
  .share-dialog { width: min(560px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); overflow: auto; padding: 18px; color: var(--text); margin: auto; }
  .share-dialog::backdrop { background: rgba(56, 47, 43, .45); backdrop-filter: blur(4px); }
  .share-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
  .share-head h2 { font-size: 20px; font-weight: 900; letter-spacing: -.03em; }
  .share-preview { aspect-ratio: 1; border-radius: 22px; overflow: hidden; background: var(--bg); border: 1px solid var(--line); display: grid; place-items: center; }
  .share-preview img { width: 100%; height: 100%; display: block; animation: share-pop .35s var(--ease-smooth-out); }
  .share-preview p { padding: 24px; text-align: center; color: var(--muted); font-weight: 700; }
  .share-loading { display: grid; justify-items: center; gap: 12px; position: relative; }
  .share-loading p { font-size: 13px; }
  .share-loading { grid-template-columns: repeat(3, auto); justify-content: center; }
  .share-loading p { grid-column: 1 / -1; }
  .share-blob { width: 22px; height: 22px; border-radius: 50%; background: var(--peach); box-shadow: 0 4px 0 var(--line); animation: share-bounce .8s var(--ease-smooth-out) infinite alternate; }
  .share-blob.b { background: var(--mint); animation-delay: .15s; }
  .share-blob.c { background: var(--lavender); animation-delay: .3s; }
  .share-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
  .share-actions .clay-button { flex: 1 1 120px; }
  .share-actions .clay-button:disabled { opacity: .55; pointer-events: none; }
  .share-status { min-height: 22px; margin-top: 8px; font-size: 13px; font-weight: 800; color: var(--accent-strong); text-align: center; }
  @keyframes share-pop { from { opacity: 0; transform: scale(.94) rotate(-1deg); } }
  @keyframes share-bounce { to { transform: translateY(-14px); } }
  @media (prefers-reduced-motion: reduce) { .share-preview img, .share-blob { animation: none; } }
</style>
