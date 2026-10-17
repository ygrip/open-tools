<svelte:head><title>Tool Policy · Open Tools</title><meta name="description" content="Registration and safety policy for Open Tools." /></svelte:head>
<main class="page-shell legal-shell">
  <a class="legal-back" href="/">← Open Tools</a>
  <article class="legal-card surface">
    <p class="eyebrow">Registry</p>
    <h1>Tool Policy</h1>
    <p class="legal-updated">Last updated: October 5, 2026</p>
    <h2>Registration</h2>
    <p>Tools register through an approved source entry, or optional topic discovery under a trusted owner. Public and private repositories use the same versioned manifest and self-contained HTML bundle contract. The host verifies the repository identity and bundle checksum before publishing.</p>
    <h2>Routing</h2>
    <p>Open Tools publishes only validated catalog metadata and approved browser bundles. Each tool has a host-owned route and runs in an isolated, opaque-origin iframe. Repository credentials remain in the build environment. Private repositories do not make distributed browser bundles confidential.</p>
    <h2>Behavior</h2>
    <p>Contract v1 tools must be self-contained and process data locally. The host restricts network APIs, forms and resource loading, but sandboxing is not a complete defense against malicious code or excessive CPU use. Only reviewed tools should be registered. Do not enter secrets into tools you do not trust.</p>
    <h2>Removal</h2>
    <p>A tool may be removed from the registry if it becomes unsafe, misleading, unavailable, or no longer satisfies the manifest contract.</p>
  </article>
</main>
