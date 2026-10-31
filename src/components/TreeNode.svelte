<script lang="ts">
  import { icon } from '../lib/data';
  import type { Node } from '../lib/planner';
  import { balltip } from '../lib/tip.svelte';
  import TreeNode from './TreeNode.svelte';

  let { node, oncycle }: { node: Node; oncycle: (ball: string, next: number) => void } = $props();
</script>

<div class="node">
  <div class="self {node.kind}">
    <span class="who" use:balltip={{ balls: node.kind === 'fuse' ? node.children.map((c) => c.ball) : node.ball, tap: true }}>
      {#if node.kind === 'fuse'}
        <span class="fuse">⊕</span>
      {:else}
        <img class="icon sm" src={icon(node.ball)} alt="" />
      {/if}
      <span>{node.ball}</span>
    </span>
    {#if node.kind === 'owned'}<span class="badge good">have</span>{/if}
    {#if node.kind === 'acquire'}<span class="badge warn">find</span>{/if}
    {#if node.kind === 'evolve' && node.recipeCount > 1}
      <button class="alt" title="Switch recipe" onclick={() => oncycle(node.ball, (node.recipe + 1) % node.recipeCount)}>
        recipe {node.recipe + 1}/{node.recipeCount} ⇄
      </button>
    {/if}
  </div>
  {#if node.kind === 'evolve' || node.kind === 'fuse'}
    <div class="kids">
      {#each node.children as child, i (i)}
        <TreeNode node={child} {oncycle} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .node { display: grid; gap: 4px; }
  .self { display: flex; align-items: center; gap: 6px; font-size: 14px; }
  .who { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; cursor: help; }
  .self.evolve, .self.fuse { font-weight: 600; }
  .fuse { width: 24px; text-align: center; color: var(--accent); font-size: 18px; }
  .kids { display: grid; gap: 4px; margin-left: 11px; padding-left: 14px; border-left: 1px solid var(--line); }
  .badge { font-size: 11px; border-radius: 4px; padding: 0 5px; }
  .badge.good { color: var(--good); border: 1px solid var(--good); }
  .badge.warn { color: var(--warn); border: 1px solid var(--warn); }
  .alt { font-size: 11px; padding: 1px 6px; color: var(--accent); }
</style>
