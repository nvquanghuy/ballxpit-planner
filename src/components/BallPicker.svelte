<script lang="ts">
  import { allBalls, icon } from '../lib/data';
  import { balltip } from '../lib/tip.svelte';

  let {
    owned,
    pinned,
    onadd,
    onremove,
    ontogglepin,
  }: {
    owned: string[];
    pinned: string[];
    onadd: (name: string) => void;
    onremove: (name: string) => void;
    ontogglepin: (name: string) => void;
  } = $props();

  let query = $state('');

  const groups = $derived.by(() => {
    const q = query.toLowerCase();
    const match = allBalls.filter((b) => b.name.toLowerCase().includes(q));
    return [
      { label: 'Base', balls: match.filter((b) => !b.parents) },
      { label: 'Evolved', balls: match.filter((b) => !!b.parents) },
    ].filter((g) => g.balls.length);
  });
</script>

<section class="picker">
  <div class="head">
    <h2>Your balls</h2>
    {#if owned.length}<span class="muted hint">tap 📌 to pin a direction</span>{/if}
  </div>

  {#if owned.length}
    <div class="owned">
      {#each owned as name (name)}
        <div class="own" class:pinned={pinned.includes(name)}>
          <span class="who" use:balltip={{ balls: name, tap: true }}><img class="icon sm" src={icon(name)} alt="" />{name}</span>
          <button class="ghost tiny" title="Pin" aria-pressed={pinned.includes(name)} onclick={() => ontogglepin(name)}>📌</button>
          <button class="ghost tiny" title="Remove" onclick={() => onremove(name)}>✕</button>
        </div>
      {/each}
    </div>
  {:else}
    <p class="muted">Tap the balls you currently have.</p>
  {/if}

  <div class="controls">
    <input type="search" placeholder="Search balls…" bind:value={query} />
  </div>

  <div class="grid">
    {#each groups as g (g.label)}
      <div class="sep"><span>{g.label}</span><span class="muted">{g.balls.length}</span></div>
      {#each g.balls as b (b.name)}
      <button
        class="cell"
        class:have={owned.includes(b.name)}
        use:balltip={b.name}
        onclick={() => (owned.includes(b.name) ? onremove(b.name) : onadd(b.name))}
      >
        <img class="icon lg" src={b.img} alt="" />
        <span>{b.name}</span>
      </button>
      {/each}
    {:else}
      <p class="muted none">No ball matches “{query}”.</p>
    {/each}
  </div>
</section>

<style>
  .picker { display: grid; gap: 10px; }
  .head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; }
  .hint { font-size: 12px; }
  .owned { display: flex; flex-wrap: wrap; gap: 6px; }
  .own { display: flex; align-items: center; gap: 6px; padding: 3px 4px 3px 4px; background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px; font-size: 13px; }
  .who { display: inline-flex; align-items: center; gap: 6px; cursor: help; }
  .own.pinned { border-color: var(--warn); box-shadow: 0 0 0 1px var(--warn) inset; }
  .own button[aria-pressed='false'] { opacity: 0.35; }
  .tiny { padding: 0 4px; border: none; font-size: 12px; }
  .controls { display: flex; gap: 8px; min-width: 0; }
  .controls input { min-width: 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 6px; max-height: max(420px, calc(100vh - 230px)); overflow-y: auto; padding-right: 2px; }
  .cell { display: grid; justify-items: center; gap: 4px; padding: 6px 2px; font-size: 11px; line-height: 1.15; text-align: center; background: var(--panel); }
  .sep { grid-column: 1 / -1; position: sticky; top: 0; z-index: 1; display: flex; gap: 8px; align-items: baseline; padding: 6px 2px 4px; background: var(--bg); border-bottom: 1px solid var(--line); font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .sep:not(:first-child) { margin-top: 6px; }
  .none { grid-column: 1 / -1; }
  .cell.have { border-color: var(--good); background: color-mix(in srgb, var(--good) 12%, var(--panel)); }
</style>
