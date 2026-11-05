<script lang="ts">
  import type { InboxState } from './scenario';

  let { state }: { state: InboxState } = $props();
</script>

<section class="inbox">
  <h1>{state.title}</h1>
  <p class="summary">You have {state.unread} unread messages</p>
  <ul>
    {#each state.items as item (item.id)}
      <li data-id={item.id}>{item.label}</li>
    {/each}
  </ul>
  {#if state.filtersActive}
    <p class="filters">Filters are active</p>
  {/if}
  <input class="search" placeholder={state.searchPlaceholder} />
  <input type="submit" value={state.sendLabel} />
  <button type="button">Archive all</button>
</section>
