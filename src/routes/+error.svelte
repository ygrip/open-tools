<script lang="ts">
  import { page } from '$app/state';

  const isNotFound = $derived(page.status === 404);
  const title = $derived(isNotFound ? 'This tool path does not exist.' : 'Something went sideways.');
  const message = $derived(
    isNotFound
      ? 'The tool may have moved, been removed, or never existed in the registry.'
      : 'The shell hit an unexpected error. The tools themselves have enough problems without the catalog joining them.'
  );
</script>

<svelte:head>
  <title>{page.status} · Open Tools</title>
</svelte:head>

<main class="page-shell error-shell">
  <header class="topbar surface">
    <a class="brand" href="/" aria-label="Open Tools home">
      <span class="brand-mark" aria-hidden="true">OT</span>
      <span>
        <strong>Open Tools</strong>
        <small>small utilities, one place</small>
      </span>
    </a>
  </header>

  <section class="error-card surface">
    <p class="error-code">{page.status}</p>
    <div>
      <p class="eyebrow">{isNotFound ? 'Not found' : 'Application error'}</p>
      <h1>{title}</h1>
      <p class="lede">{message}</p>
    </div>

    <div class="error-actions">
      <a class="primary-action" href="/">Back to tools</a>
      <a href="https://github.com/ygrip/open-tools/issues" target="_blank" rel="noreferrer">
        Report issue ↗
      </a>
    </div>
  </section>
</main>
