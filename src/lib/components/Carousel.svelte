<script lang="ts">
  let { label = 'Carousel', children }: { label?: string; children: import('svelte').Snippet } = $props();
  let viewport: HTMLDivElement;

  function move(direction: number) {
    viewport?.scrollBy({ left: viewport.clientWidth * 0.82 * direction, behavior: 'smooth' });
  }
</script>

<section class="ui-carousel" aria-label={label}>
  <div class="ui-carousel-actions">
    <button type="button" onclick={() => move(-1)} aria-label="Previous">←</button>
    <button type="button" onclick={() => move(1)} aria-label="Next">→</button>
  </div>
  <div class="ui-carousel-track" bind:this={viewport}>
    {@render children()}
  </div>
</section>
