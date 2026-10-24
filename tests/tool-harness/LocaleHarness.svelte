<script lang="ts">
  import { untrack } from 'svelte';
  import ToolRuntime from '../../src/lib/components/ToolRuntime.svelte';
  import HostUi from '../../src/lib/components/HostUi.svelte';
  import { languageCodes } from '../../src/lib/languages.js';
  import { overwriteGetLocale, type Locale } from '../../src/lib/paraglide/runtime.js';
  import type { RuntimeTool } from '../../src/lib/runtime/core';

  type TestManifest = RuntimeTool & { translations?: Record<string, Partial<RuntimeTool>> };
  let { manifest, initialLocale }: { manifest: TestManifest; initialLocale: string } = $props();
  let locale = $state(untrack(() => initialLocale));
  overwriteGetLocale(() => locale as Locale);
  const tool = $derived({ ...manifest, ...manifest.translations?.[locale] });
  $effect(() => { document.documentElement.lang = locale; });
</script>

<label>Test host locale
  <select aria-label="Test host locale" bind:value={locale}>
    {#each languageCodes as code}<option value={code}>{code}</option>{/each}
  </select>
</label>
<main class="container"><ToolRuntime {tool} {locale} /></main>
<HostUi />
