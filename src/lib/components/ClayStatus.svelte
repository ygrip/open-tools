<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  /** Reusable clay status card: waiting, working (optional progress %), done or error. Mirrors `trickIt.ui.status`. */
  let { state = 'waiting', title, detail = '', progress = null, children }:
    { state?: 'waiting' | 'working' | 'done' | 'error'; title: string; detail?: string; progress?: number | null; children?: Snippet } = $props();
  const percent = $derived(progress === null || !Number.isFinite(progress) ? null : Math.max(0, Math.min(100, Math.round(progress))));
</script>

<div class="clay-status" data-state={state} role={state === 'error' ? 'alert' : 'status'} aria-busy={state === 'waiting' || state === 'working'}>
  <span class="orb" aria-hidden="true">
    {#if state === 'waiting'}<span class="dots"><i></i><i></i><i></i></span>
    {:else if state === 'working'}<span class="ring"></span>
    {:else}<Icon name={state === 'done' ? 'check' : 'x'} size={24} />{/if}
  </span>
  <span class="copy">
    <strong>{title}</strong>
    {#if detail}<span class="detail">{detail}</span>{/if}
    {#if state === 'working' && percent !== null}
      <span class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={percent}><i style:width={`${percent}%`}></i></span>
    {/if}
    {#if children}<span class="actions">{@render children()}</span>{/if}
  </span>
</div>

<style>
  .clay-status { --tone: var(--peach); display: flex; align-items: flex-start; gap: 16px; width: 100%; max-width: 560px; margin: 0 auto; padding: 20px; border: 1px solid var(--line); border-radius: 24px; background: var(--surface); box-shadow: var(--clay-shadow); text-align: left; overflow-wrap: anywhere; animation: rise var(--duration-slow) var(--ease-smooth-out); }
  .clay-status[data-state='done'] { --tone: var(--mint); }
  .clay-status[data-state='error'] { --tone: #f6d3cb; animation: shake .4s ease-in-out; }
  .orb { flex: 0 0 56px; height: 56px; border-radius: 20px; display: grid; place-items: center; background: var(--tone); color: var(--text); box-shadow: 0 4px 0 var(--line), inset 2px 3px 2px var(--highlight); }
  .dots { display: flex; gap: 5px; }
  .dots i { width: 9px; height: 9px; border-radius: 50%; background: var(--accent); animation: bounce .7s var(--ease-smooth-out) infinite alternate; }
  .dots i:nth-child(2) { animation-delay: .14s; background: #8fc3a3; }
  .dots i:nth-child(3) { animation-delay: .28s; background: #b9a6d8; }
  .ring { width: 28px; height: 28px; border-radius: 50%; border: 4px solid color-mix(in srgb, var(--accent) 30%, transparent); border-top-color: var(--accent-strong); animation: spin .8s linear infinite; }
  .copy { flex: 1; min-width: 0; display: grid; gap: 4px; padding-top: 4px; }
  .copy strong { font-size: 17px; font-weight: 900; line-height: 1.3; }
  .detail { color: var(--muted); font-size: 14px; line-height: 1.5; }
  .bar { height: 12px; margin-top: 8px; border-radius: 99px; background: var(--bg); box-shadow: inset 1px 2px 3px var(--shadow); overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(180deg, color-mix(in srgb, var(--accent), #fff 30%), var(--accent)); box-shadow: inset 0 2px 0 rgba(255,255,255,.45); transition: width var(--duration-slow) var(--ease-smooth-out); }
  .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
  @keyframes rise { from { opacity: 0; transform: translateY(8px) scale(.98); } }
  @keyframes bounce { to { transform: translateY(-8px); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes shake { 20%, 60% { transform: translateX(-5px); } 40%, 80% { transform: translateX(5px); } }
  @media (prefers-reduced-motion: reduce) { .clay-status, .dots i, .ring { animation: none; } }
</style>
