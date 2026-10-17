<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import Seo from '$lib/components/Seo.svelte';
  import { localizedPath } from '$lib/i18n';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
</script>
<Seo title={m.privacy_title()} description={m.privacy_description()} path="/privacy/" />
<main id="main-content" class="page-shell legal-shell">
  <div class="legal-top"><a class="legal-back" href={localizedPath('/')}>← trick-it</a><LanguageSwitcher /></div>
  <article class="legal-card surface">
    <p class="eyebrow">{m.legal_label()}</p>
    <h1>{m.privacy_title()}</h1>
    <p class="legal-updated">{m.last_updated()}</p>
    <h2>{m.privacy_local_title()}</h2>
    <p>{m.privacy_local_text()}</p>
    <h2>{m.privacy_service_title()}</h2>
    <p>{m.privacy_service_text()}</p>
    <h2>{m.privacy_analytics_title()}</h2>
    <p>{m.privacy_analytics_text()}</p>
    <h2>{m.privacy_links_title()}</h2>
    <p>{m.privacy_links_text()}</p>
  </article>
</main>
