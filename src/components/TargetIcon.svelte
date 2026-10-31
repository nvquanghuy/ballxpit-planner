<script lang="ts">
  import { icon } from '../lib/data';
  import { targetBalls, type Target } from '../lib/domain';
  import { balltip } from '../lib/tip.svelte';

  let { target, size = '', tap = false }: { target: Target; size?: string; tap?: boolean } = $props();
  const balls = $derived(targetBalls(target));
</script>

{#if target.kind === 'evolution'}
  <img class="icon {size}" class:tap src={icon(target.ball)} alt="" use:balltip={{ balls, tap }} />
{:else}
  <span class="pair" class:tap use:balltip={{ balls, tap }}>
    <img class="icon {size}" src={icon(target.balls[0])} alt="" />
    <img class="icon {size}" src={icon(target.balls[1])} alt="" />
  </span>
{/if}

<style>
  .tap { cursor: help; }
  .pair { display: inline-flex; flex-shrink: 0; }
  .pair img + img { margin-left: -12px; outline: 2px solid var(--panel); }
</style>
