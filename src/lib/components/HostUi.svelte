<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import Icon from './Icon.svelte';
  import ToolArt from './ToolArt.svelte';
  import { hostUi, closeDialog, dismissToast } from '$lib/ui/host-ui.svelte';
  import type { ToolIcon } from '$lib/registry/types';

  let element = $state<HTMLDialogElement | null>(null);
  let phase = $state('');
  let returnFocus: HTMLElement | null = null;
  let closing: ReturnType<typeof setTimeout> | undefined;
  const dialog = $derived(hostUi.dialog);

  function dismissDialog(value: boolean) {
    if (closing) return;
    phase = 'is-closing';
    let duration = 150;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) duration = 0;
    closing = setTimeout(() => {
      closing = undefined;
      element?.close();
      phase = '';
      if (returnFocus?.isConnected) returnFocus.focus();
      // Reply only after the modal releases focus. Otherwise its delayed close
      // overwrites the tool control restored by the SDK's response handler.
      closeDialog(value);
    }, duration);
  }

  $effect(() => {
    if (!element) return;
    if (dialog) {
      // A follow-up popup can arrive while the previous one is still animating out.
      if (closing) { clearTimeout(closing); closing = undefined; }
      if (!element.open) {
        returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        element.showModal();
      }
      requestAnimationFrame(() => { phase = 'is-open'; });
    } else if (element.open && !closing) {
      phase = 'is-closing';
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      closing = setTimeout(() => { closing = undefined; element?.close(); phase = ''; if (returnFocus?.isConnected) returnFocus.focus(); }, reduced ? 0 : 150);
    }
  });
</script>

<div class="toast-stack" role="region" aria-label={m.ui_notifications()} aria-live="polite">
  {#each hostUi.toasts as toast (toast.id)}
    <div class="toast surface" data-tone={toast.tone} role={toast.tone === 'error' ? 'alert' : 'status'}>
      <span class="toast-orb" aria-hidden="true"><Icon name={toast.tone === 'success' ? 'check' : toast.tone === 'error' ? 'x' : 'sparkles'} size={16} /></span>
      <span class="toast-copy">{#if toast.source}<small>{m.ui_from_tool({ tool: toast.source.name })}</small>{/if}{toast.message}</span>
      <button type="button" class="toast-close" aria-label={m.ui_dismiss()} onclick={() => dismissToast(toast.id)}><Icon name="x" size={14} /></button>
    </div>
  {/each}
</div>

<dialog bind:this={element} class="host-dialog surface t-modal {phase}" aria-labelledby="host-dialog-title" data-tone={dialog?.tone ?? 'default'}
  oncancel={(event) => { event.preventDefault(); dismissDialog(false); }}>
  {#if dialog}
    {#if dialog.source}
      <p class="host-dialog-source"><ToolArt id={dialog.source.id} icon={(dialog.source.icon ?? 'sparkles') as ToolIcon} size={28} /> {m.ui_from_tool({ tool: dialog.source.name })}</p>
    {/if}
    <h2 id="host-dialog-title">{dialog.title}</h2>
    {#if dialog.message}<p class="host-dialog-message">{dialog.message}</p>{/if}
    {#if dialog.items?.length}
      <svelte:element this={dialog.ordered ? 'ol' : 'ul'} class="host-dialog-list" class:ordered={dialog.ordered}>
        {#each dialog.items as item, index}<li><span class="step" aria-hidden="true">{dialog.ordered ? index + 1 : '•'}</span><span>{item}</span></li>{/each}
      </svelte:element>
    {/if}
    <div class="host-dialog-actions">
      {#if dialog.kind === 'confirm'}<button class="clay-button" type="button" onclick={() => dismissDialog(false)}>{dialog.cancelLabel || m.ui_cancel()}</button>{/if}
      <button class="clay-button primary" class:danger={dialog.tone === 'danger'} type="button" onclick={() => dismissDialog(true)}>{dialog.confirmLabel || (dialog.kind === 'info' ? m.ui_got_it() : m.ui_continue())}</button>
    </div>
  {/if}
</dialog>

<style>
  .toast-stack { position: fixed; left: 50%; bottom: max(16px, env(safe-area-inset-bottom)); z-index: 80; display: grid; gap: 10px; width: min(440px, calc(100vw - 24px)); transform: translateX(-50%); pointer-events: none; }
  .toast { --tone: var(--peach); pointer-events: auto; display: flex; align-items: center; gap: 12px; padding: 10px 10px 10px 12px; border-radius: 20px; font-weight: 750; font-size: 14px; overflow-wrap: anywhere; animation: toast-in var(--duration-fast) var(--ease-smooth-out); }
  .toast[data-tone='success'] { --tone: var(--mint); }
  .toast[data-tone='error'] { --tone: #f6d3cb; }
  .toast-orb { flex: 0 0 34px; height: 34px; border-radius: 12px; display: grid; place-items: center; background: var(--tone); color: var(--text); box-shadow: 0 3px 0 var(--line), inset 1px 2px 2px var(--highlight); }
  .toast-copy { flex: 1; min-width: 0; line-height: 1.4; }
  .toast-copy small { display: block; font-size: 11px; font-weight: 800; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .toast-close { flex: 0 0 36px; height: 36px; border: 0; border-radius: 12px; background: none; color: var(--muted); cursor: pointer; display: grid; place-items: center; }
  .toast-close:hover { background: var(--bg); color: var(--text); }
  .host-dialog { width: min(480px, calc(100vw - 24px)); max-height: calc(100dvh - 32px); overflow: auto; margin: auto; padding: 26px; color: var(--text); overflow-wrap: anywhere; }
  .host-dialog::backdrop { background: rgb(56 47 43 / .45); backdrop-filter: blur(4px); }
  .host-dialog-source { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 14px; padding: 4px 12px 4px 4px; border: 1px solid var(--line); border-radius: 99px; background: var(--bg); font-size: 12px; font-weight: 800; color: var(--muted); }
  .host-dialog h2 { font-size: 23px; font-weight: 900; letter-spacing: -.03em; line-height: 1.2; }
  .host-dialog-message { margin-top: 10px; color: var(--text-secondary); line-height: 1.6; }
  .host-dialog-list { list-style: none; margin: 18px 0 0; padding: 0; display: grid; gap: 10px; }
  .host-dialog-list li { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border: 1px solid var(--line); border-radius: 18px; background: var(--bg); color: var(--text-secondary); line-height: 1.5; font-size: 15px; }
  .step { flex: 0 0 28px; height: 28px; border-radius: 10px; display: grid; place-items: center; background: var(--peach); color: var(--accent-strong); font-weight: 900; font-size: 13px; box-shadow: 0 3px 0 var(--line), inset 1px 2px 2px var(--highlight); }
  .host-dialog-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
  .host-dialog-actions .clay-button { flex: 1 1 140px; max-width: 220px; }
  .clay-button.danger { background: #e7826f; border-color: #c4604d; box-shadow: 0 4px 0 #b0533f, inset 1px 2px 2px rgba(255,255,255,.4); }
  @keyframes toast-in { from { opacity: 0; transform: translateY(12px) scale(.97); } }
  @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }
  @media (max-width: 520px) { .host-dialog { padding: 22px; } .host-dialog-actions .clay-button { max-width: none; } }
</style>
