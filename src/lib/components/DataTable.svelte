<script lang="ts">
  let { headers, rows, caption = '' }: { headers: string[]; rows: Array<Array<string | number>>; caption?: string } = $props();
</script>

<div class="ui-table-wrap surface">
  <table class="ui-table">
    {#if caption}<caption>{caption}</caption>{/if}
    <thead><tr>{#each headers as header}<th>{header}</th>{/each}</tr></thead>
    <tbody>
      {#each rows as row}
        <tr>{#each row as cell}<td>{cell}</td>{/each}</tr>
      {/each}
    </tbody>
  </table>
</div>
