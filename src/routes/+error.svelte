<script lang="ts">
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import Icon from '$lib/components/Icon.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import { errorPresentation } from '$lib/errors';
  import { localizedPath } from '$lib/i18n';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
  import { m } from '$lib/paraglide/messages.js';

  const presentation = $derived(errorPresentation(page.status));
  const incidentId = $derived(page.error?.incidentId);
  const group = $derived(page.status === 404 ? '404' : [401, 403].includes(page.status) ? '403' : page.status === 429 ? '429' : page.status === 503 ? '503' : page.status >= 500 ? '500' : 'other');
  const copy = $derived({
    '404': [m.error_404_eyebrow(), m.error_404_title(), m.error_404_desc()],
    '403': [m.error_403_eyebrow(), m.error_403_title(), m.error_403_desc()],
    '429': [m.error_429_eyebrow(), m.error_429_title(), m.error_429_desc()],
    '503': [m.error_503_eyebrow(), m.error_503_title(), m.error_503_desc()],
    '500': [m.error_500_eyebrow(), m.error_500_title(), m.error_500_desc()],
    other: [m.error_other_eyebrow(), m.error_other_title(), m.error_other_desc()]
  }[group]);
</script>

<svelte:head>
  <title>{page.status} · {m.error_title()} · Open Tools</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main id="main-content" class="page-shell illustrated-error">
  <header class="topbar">
    <a class="brand" href={localizedPath('/')} aria-label={m.brand_home()}><img src={`${base}/brand/logo.svg`} alt="" width="46" height="46" /><span><strong>open<span class="brand-accent">tools</span></strong><small>{m.brand_tagline()}</small></span></a>
    <div class="error-header-actions"><LanguageSwitcher /><ThemeToggle /></div>
  </header>
  <section class="error-bento" aria-labelledby="error-title">
    <div class="error-copy surface">
      <span class="error-status"><Icon name={page.status >= 500 ? 'toolbox' : 'search'} size={18} /> Error {page.status}</span>
      <p class="eyebrow">{copy[0]}</p>
      <h1 id="error-title">{copy[1]}</h1>
      <p class="error-description">{copy[2]}</p>
      <div class="error-actions">
        {#if presentation.retry}<button class="clay-button primary" type="button" onclick={() => window.location.reload()}>Try again <Icon name="arrow-right" size={19} /></button>{/if}
        <a class:primary={!presentation.retry} class="clay-button" href={`${base}/`}><Icon name="arrow-left" size={19} /> Back to the toolbox</a>
      </div>
      {#if incidentId}<p class="error-reference">{m.error_reference()} <code>{incidentId}</code>.</p>{/if}
      <a class="text-link error-report" href="https://github.com/ygrip/open-tools/issues" target="_blank" rel="noreferrer">Tell us what happened <Icon name="external" size={15} /></a>
    </div>
    <div class="error-illustration surface">
      <img src={`${base}/illustrations/error-${presentation.illustration}-640.webp`} srcset={`${base}/illustrations/error-${presentation.illustration}-384.webp 384w, ${base}/illustrations/error-${presentation.illustration}-640.webp 640w`} sizes="(max-width: 760px) calc(100vw - 32px), 50vw" width="640" height="640" fetchpriority="high" alt={presentation.illustration === '404' ? m.error_404_alt() : m.error_500_alt()} />
      <span class="error-art-note"><Icon name="heart" size={16} /> A small detour. You’re still welcome.</span>
    </div>
  </section>
  <aside class="error-reassurance surface"><span class="clay-icon mint"><Icon name="shield" size={24} /></span><div><strong>{m.error_reassurance()}</strong><p>{m.error_reassurance_desc()}</p></div><a href={localizedPath('/privacy/')}>Your privacy <Icon name="arrow-right" size={17} /></a></aside>
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
  .error-header-actions { display: flex; align-items: center; gap: 10px; }
  @media (max-width: 500px) { .illustrated-error .topbar { flex-wrap: wrap; } .error-header-actions { margin-left: auto; } }
</style>
