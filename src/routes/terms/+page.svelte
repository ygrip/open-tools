<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import Seo from '$lib/components/Seo.svelte';
  import { localizedPath } from '$lib/i18n';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
</script>
<Seo title={m.terms_title()} description={m.terms_description()} path="/terms/" />
<main id="main-content" class="page-shell legal-shell">
  <div class="legal-top"><a class="legal-back" href={localizedPath('/')}>← trick-it</a><LanguageSwitcher /></div>
  <article class="legal-card surface">
    <p class="eyebrow">{m.legal_label()}</p>
    <h1>{m.terms_title()}</h1>
    <p class="legal-updated">{m.last_updated()}</p>
    <h2>{m.terms_use_title()}</h2>
    <p>{m.terms_use_text()}</p>
    <h2>{m.terms_files_title()}</h2>
    <p>{m.terms_files_text()}</p>
    <h2>{m.terms_availability_title()}</h2>
    <p>{m.terms_availability_text()}</p>
    <h2>{m.terms_liability_title()}</h2>
    <p>{m.terms_liability_text()}</p>
    <h2>{m.terms_third_title()}</h2>
    <p>{m.terms_third_text()}</p>
  </article>
</main>
