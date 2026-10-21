<script lang="ts">
  import type { PageData } from './$types';
  import Seo from '$lib/components/Seo.svelte';
  import LegalFeature from '$lib/components/LegalFeature.svelte';
  let { data }: { data: PageData } = $props();
</script>
<Seo title={data.title} description={data.description} path="/policy/" />
<LegalFeature {data} />
