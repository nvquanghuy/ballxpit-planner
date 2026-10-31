<script lang="ts">
  import { flushSync } from 'svelte';
  import { allBalls, icon, type BallInfo } from '../lib/data';
  import { fusedParts, isFused } from '../lib/planner';
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

  const toggle = (name: string) => (owned.includes(name) ? onremove(name) : onadd(name));

  // Keyboard search (same keys as the level-up picker): type a few letters, Enter to add, repeat.
  let query = $state('');
  let hi = $state<number | null>(null); // arrow-key highlight; null = follow the top match
  let input = $state<HTMLInputElement>();
  let grid = $state<HTMLDivElement>();

  const groups = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const hit = allBalls.filter((b) => b.name.toLowerCase().includes(q));
    // prefix matches first, otherwise keep catalogue order
    const match: BallInfo[] = q ? [...hit.filter((b) => b.name.toLowerCase().startsWith(q)), ...hit.filter((b) => !b.name.toLowerCase().startsWith(q))] : hit;
    return [
      { label: 'Base', balls: match.filter((b) => !b.parents) },
      { label: 'Evolved', balls: match.filter((b) => !!b.parents) },
    ].filter((g) => g.balls.length);
  });
  // the grid in rendered order, so Enter/arrows follow what you see
  const flat = $derived(groups.flatMap((g): BallInfo[] => g.balls));
  const index = $derived(new Map(flat.map((b, i) => [b.name, i])));
  const active = $derived(
    hi !== null && hi < flat.length ? hi : query.trim() ? flat.findIndex((b) => !owned.includes(b.name)) : -1,
  );

  const reset = () => {
    query = '';
    hi = null;
  };
  const pick = (name: string) => {
    toggle(name);
    reset();
    input?.focus();
  };
  const move = (by: number) => {
    if (!flat.length) return;
    const from = active < 0 ? (by > 0 ? -1 : flat.length) : active;
    hi = (from + by + flat.length) % flat.length;
    flushSync();
    grid?.querySelector('.cell.hi')?.scrollIntoView({ block: 'nearest' });
  };

  const onkey = (e: KeyboardEvent) => {
    if (e.isComposing) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const b = flat[active];
      if (b) pick(b.name);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      reset();
    } else if (e.key === 'Backspace' && !query && owned.length) {
      e.preventDefault();
      onremove(owned[owned.length - 1]);
    }
  };
</script>

<section class="picker">
  <div class="head">
    <h2>Your balls</h2>
    {#if owned.length}<span class="muted hint">tap 📌 to pin a direction</span>{/if}
  </div>

  {#if owned.length}
    <div class="owned">
      {#each owned as name (name)}
        {#if isFused(name)}
          <!-- a fused ball only holds a slot: no pin, it feeds no recipe -->
          {@const [a, b] = fusedParts(name)}
          <div class="own fused">
            <span class="who" use:balltip={{ balls: [a, b], tap: true }}><img class="icon sm" src={icon(a)} alt="" /><span class="plus">⊕</span><img class="icon sm" src={icon(b)} alt="" /><span class="nm">{name}</span></span>
            <button class="ghost tiny" title="Remove" onclick={() => onremove(name)}>✕</button>
          </div>
        {:else}
        <div class="own" class:pinned={pinned.includes(name)}>
          <span class="who" use:balltip={{ balls: name, tap: true }}><img class="icon sm" src={icon(name)} alt="" />{name}</span>
          <button class="ghost tiny" title="Pin" aria-pressed={pinned.includes(name)} onclick={() => ontogglepin(name)}>📌</button>
          <button class="ghost tiny" title="Remove" onclick={() => onremove(name)}>✕</button>
        </div>
        {/if}
      {/each}
    </div>
  {:else}
    <p class="muted">Tap the balls you currently have.</p>
  {/if}

  <div class="controls">
    <input
      bind:this={input}
      type="search"
      placeholder="Search balls, Enter to add…"
      autocomplete="off"
      autocapitalize="off"
      autocorrect="off"
      spellcheck="false"
      enterkeyhint="done"
      role="combobox"
      aria-expanded="true"
      aria-controls="ball-choices"
      aria-activedescendant={active >= 0 ? `ball-choice-${active}` : undefined}
      bind:value={() => query, (v) => ((query = v), (hi = null))}
      onkeydown={onkey}
    />
  </div>

  <div class="grid" id="ball-choices" role="listbox" bind:this={grid}>
    {#each groups as g (g.label)}
      <div class="sep" role="presentation"><span>{g.label}</span><span class="muted">{g.balls.length}</span></div>
      {#each g.balls as b (b.name)}
      {@const i = index.get(b.name)}
      <button
        id="ball-choice-{i}"
        role="option"
        aria-selected={owned.includes(b.name)}
        class="cell"
        class:have={owned.includes(b.name)}
        class:hi={i === active}
        use:balltip={b.name}
        onclick={() => toggle(b.name)}
      >
        <img class="icon lg" src={b.img} alt="" />
        <span>{b.name}</span>
      </button>
      {/each}
    {:else}
      <p class="muted none">No ball matches “{query.trim()}”.</p>
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
  .own.fused { border-color: var(--accent); }
  .own.fused .who { gap: 2px; }
  .own.fused .nm { margin-left: 4px; }
  .plus { color: var(--accent); font-weight: 700; }
  .tiny { padding: 0 4px; border: none; font-size: 12px; }
  .controls { display: flex; gap: 8px; min-width: 0; }
  .controls input { min-width: 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 6px; max-height: max(420px, calc(100vh - 230px)); overflow-y: auto; padding-right: 2px; }
  .cell { display: grid; justify-items: center; gap: 4px; padding: 6px 2px; font-size: 11px; line-height: 1.15; text-align: center; background: var(--panel); }
  .sep { grid-column: 1 / -1; position: sticky; top: 0; z-index: 1; display: flex; gap: 8px; align-items: baseline; padding: 6px 2px 4px; background: var(--bg); border-bottom: 1px solid var(--line); font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .sep:not(:first-child) { margin-top: 6px; }
  .none { grid-column: 1 / -1; }
  .cell.have { border-color: var(--good); background: color-mix(in srgb, var(--good) 12%, var(--panel)); }
  .cell.hi { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset, 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent); }
</style>
