<script lang="ts">
  import { base } from '$app/paths';
  import { m } from '$lib/paraglide/messages.js';
  import Seo from '$lib/components/Seo.svelte';
  import { localizedPath } from '$lib/i18n';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';

  const sections = [
    { title: m.policy_register_title(), text: m.policy_register_text() },
    { title: m.policy_route_title(), text: m.policy_route_text() },
    { title: m.policy_behavior_title(), text: m.policy_behavior_text() },
    { title: m.policy_limits_title(), text: m.policy_limits_text() },
    { title: m.policy_remove_title(), text: m.policy_remove_text() }
  ];
</script>

<Seo title={m.policy_title()} description={m.policy_description()} path="/policy/" />
<main id="main-content" class="page-shell legal-shell">
  <div class="legal-top">
    <a class="legal-back" href={localizedPath('/')}>← trick-it</a>
    <LanguageSwitcher />
  </div>
  <article class="legal-card legal-feature surface">
    <header class="legal-hero">
      <div class="legal-hero-copy">
        <p class="eyebrow">{m.policy_eyebrow()}</p>
        <h1>{m.policy_title()}</h1>
        <p class="legal-lede">{m.policy_intro()}</p>
        <p class="legal-updated">{m.legal_last_updated()}</p>
      </div>
      <img class="legal-hero-art" src={`${base}/illustrations/policy-clay.svg`} alt={m.policy_illustration_alt()} width="360" height="270" decoding="async" />
    </header>

    <aside class="legal-summary" aria-label={m.legal_in_short()}>
      <strong>{m.legal_in_short()}</strong>
      <p>{m.policy_summary()}</p>
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
        <a href={localizedPath('/terms/')}>{m.footer_terms()} <span aria-hidden="true">↗</span></a>
      </div>
    </nav>
  </article>
</main>
