<script lang="ts">
  import { base } from '$app/paths';
  let { locale, size = 28 }: { locale: 'en' | 'id'; size?: number } = $props();
</script>

<img
  class="clay-flag"
  src={base + '/brand/flag-' + locale + '.svg'}
  width={size}
  height={Math.round(size * 0.7)}
  alt=""
  aria-hidden="true"
  draggable="false"
/>

<style>
  .clay-flag {
    display: block;
    flex: 0 0 auto;
    filter: drop-shadow(0 1.5px 1px rgb(45 35 38 / .24));
    transform: rotate(-2deg);
  }
  @media (forced-colors: active) { .clay-flag { filter: none; } }
</style>
