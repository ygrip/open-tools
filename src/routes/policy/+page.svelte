<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { localizedPath } from '$lib/i18n';
  import LanguageSwitcher from '$lib/components/LanguageSwitcher.svelte';
</script>
<svelte:head><title>{m.policy_title()} · Open Tools</title><meta name="description" content={m.policy_description()} /></svelte:head>
<main id="main-content" class="page-shell legal-shell">
  <div class="legal-top"><a class="legal-back" href={localizedPath('/')}>← Open Tools</a><LanguageSwitcher /></div>
  <article class="legal-card surface">
    <p class="eyebrow">{m.registry_label()}</p>
    <h1>{m.policy_title()}</h1>
    <p class="legal-updated">{m.last_updated()}</p>
    <h2>{m.policy_register_title()}</h2>
    <p>{m.policy_register_text()}</p>
    <h2>{m.policy_route_title()}</h2>
    <p>{m.policy_route_text()}</p>
    <h2>{m.policy_behavior_title()}</h2>
    <p>{m.policy_behavior_text()}</p>
    <h2>{m.policy_remove_title()}</h2>
    <p>{m.policy_remove_text()}</p>
  </article>
</main>
