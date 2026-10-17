<script lang="ts">
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import Icon from '$lib/components/Icon.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { errorPresentation } from '$lib/errors';

  const presentation = $derived(errorPresentation(page.status));
  const incidentId = $derived(page.error?.incidentId);
</script>

<svelte:head>
  <title>{page.status} · A little detour · Open Tools</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main id="main-content" class="page-shell illustrated-error">
  <header class="topbar">
    <a class="brand" href={`${base}/`} aria-label="Open Tools home"><img src={`${base}/brand/logo.svg`} alt="" width="46" height="46" /><span><strong>open<span class="brand-accent">tools</span></strong><small>little tools. lovely results.</small></span></a>
    <ThemeToggle />
  </header>
  <section class="error-bento" aria-labelledby="error-title">
    <div class="error-copy surface">
      <span class="error-status"><Icon name={page.status >= 500 ? 'toolbox' : 'search'} size={18} /> Error {page.status}</span>
      <p class="eyebrow">{presentation.eyebrow}</p>
      <h1 id="error-title">{presentation.title}</h1>
      <p class="error-description">{presentation.description}</p>
      <div class="error-actions">
        {#if presentation.retry}<button class="clay-button primary" type="button" onclick={() => window.location.reload()}>Try again <Icon name="arrow-right" size={19} /></button>{/if}
        <a class:primary={!presentation.retry} class="clay-button" href={`${base}/`}><Icon name="arrow-left" size={19} /> Back to the toolbox</a>
      </div>
      {#if incidentId}<p class="error-reference">If you report this, include reference <code>{incidentId}</code>.</p>{/if}
      <a class="text-link error-report" href="https://github.com/ygrip/open-tools/issues" target="_blank" rel="noreferrer">Tell us what happened <Icon name="external" size={15} /></a>
    </div>
    <div class="error-illustration surface">
      <img src={`${base}/illustrations/error-${presentation.illustration}-640.webp`} srcset={`${base}/illustrations/error-${presentation.illustration}-384.webp 384w, ${base}/illustrations/error-${presentation.illustration}-640.webp 640w`} sizes="(max-width: 760px) calc(100vw - 32px), 50vw" width="640" height="640" fetchpriority="high" alt={presentation.illustrationAlt} />
      <span class="error-art-note"><Icon name="heart" size={16} /> A small detour. You’re still welcome.</span>
    </div>
  </section>
  <aside class="error-reassurance surface"><span class="clay-icon mint"><Icon name="shield" size={24} /></span><div><strong>A little help is still close by.</strong><p>Head back to the toolbox whenever you’re ready.</p></div><a href={`${base}/privacy`}>Your privacy <Icon name="arrow-right" size={17} /></a></aside>
</main>

<style>
  .illustrated-error { padding-bottom: 40px; }
  .error-bento { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 36px; }
  .error-copy { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding: clamp(28px, 4vw, 48px); }
  .error-status { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--line); border-radius: 100px; background: var(--peach); padding: 7px 12px; margin-bottom: 25px; font-size: 12px; font-weight: 900; }
  h1 { font-size: clamp(35px, 4.5vw, 55px); font-weight: 900; letter-spacing: -.05em; margin: 10px 0 20px; }
  .error-description { font-size: 15px; line-height: 1.8; color: var(--text-secondary); max-width: 43ch; }
  .error-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: 26px; }
  .error-reference { font-size: 11px; color: var(--muted); margin-top: 24px; overflow-wrap: anywhere; }
  code { font: inherit; font-weight: 800; }
  .error-report { margin-top: 20px; }
  .error-illustration { overflow: hidden; position: relative; background: #fae5c6; }
  .error-illustration img { width: 100%; height: 100%; object-fit: cover; }
  .error-art-note { position: absolute; bottom: 18px; left: 50%; transform: translateX(-50%); display: inline-flex; align-items: center; gap: 7px; border: 1px solid #e6c8a1; padding: 8px 12px; white-space: nowrap; border-radius: 100px; background: #fff4df; color: #62442d; font-size: 10px; font-weight: 850; }
  .error-reassurance { display: flex; align-items: center; gap: 16px; margin-top: 22px; padding: 22px 25px; border-radius: 23px; }
  .error-reassurance strong { font-size: 14px; font-weight: 900; }
  .error-reassurance p { color: var(--muted); font-size: 12px; margin-top: 4px; }
  .error-reassurance a { display: inline-flex; align-items: center; gap: 7px; min-height: 44px; margin-left: auto; font-size: 12px; font-weight: 850; white-space: nowrap; }
  @media (max-width: 760px) {
    .error-bento { grid-template-columns: 1fr; margin-top: 20px; }
    .error-copy { padding: 30px 26px; }
    .error-illustration { aspect-ratio: 1.05; }
    .error-reassurance { flex-wrap: wrap; padding: 21px; }
    .error-reassurance div { flex: 1; min-width: 180px; }
    .error-reassurance a { margin-left: 0; }
  }
</style>
