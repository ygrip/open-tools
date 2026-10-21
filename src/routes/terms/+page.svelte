<script lang="ts">
  import { base } from '$app/paths';
  import { m } from '$lib/paraglide/messages.js';
  import Seo from '$lib/components/Seo.svelte';
  import { localizedPath } from '$lib/i18n';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';

  const sections = [
    { title: m.terms_use_title(), text: m.terms_use_text() },
    { title: m.terms_files_title(), text: m.terms_files_text() },
    { title: m.terms_availability_title(), text: m.terms_availability_text() },
    { title: m.terms_liability_title(), text: m.terms_liability_text() },
    { title: m.terms_third_title(), text: m.terms_third_text() }
  ];
</script>

<Seo title={m.terms_title()} description={m.terms_description()} path="/terms/" />
<main id="main-content" class="page-shell legal-shell">
  <div class="legal-top">
    <a class="legal-back" href={localizedPath('/')}>← trick-it</a>
    <LanguageSwitcher />
  </div>
  <article class="legal-card legal-feature surface">
    <header class="legal-hero">
      <div class="legal-hero-copy">
        <p class="eyebrow">{m.legal_label()}</p>
        <h1>{m.terms_title()}</h1>
        <p class="legal-lede">{m.terms_intro()}</p>
        <p class="legal-updated">{m.last_updated()}</p>
      </div>
      <img class="legal-hero-art" src={`${base}/illustrations/terms-clay.svg`} alt={m.terms_illustration_alt()} width="360" height="270" decoding="async" />
    </header>

    <aside class="legal-summary" aria-label={m.legal_in_short()}>
      <strong>{m.legal_in_short()}</strong>
      <p>{m.terms_summary()}</p>
    </aside>

    <div class="legal-sections">
      {#each sections as section, index}
        <section class="legal-section">
          <span class="legal-section-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <div><h2>{section.title}</h2><p>{section.text}</p></div>
        </section>
      {/each}
    </div>
    <nav class="legal-related" aria-label={m.legal_related_label()}>
      <strong>{m.legal_related_title()}</strong>
      <div class="legal-related-links">
        <a href={localizedPath('/privacy/')}>{m.footer_privacy()} <span aria-hidden="true">↗</span></a>
        <a href={localizedPath('/policy/')}>{m.footer_policy()} <span aria-hidden="true">↗</span></a>
      </div>
    </nav>
  </article>
</main>
