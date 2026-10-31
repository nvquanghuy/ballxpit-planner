<script lang="ts">
  import { flushSync } from 'svelte';
  import { allBalls, icon } from '../lib/data';
  import { heldLabel, holdsBall, held, type Ball, type BallName, type Held } from '../lib/domain';
  import { balltip, tip } from '../lib/tip.svelte';
  import { hasAnyRole, ROLE_INFO, ROLES, summarize, tagOf, type Role } from '../lib/roles';
  import { exportEdits, roleEdits, roleOf } from '../lib/roleEdits.svelte';

  let {
    owned,
    pinned,
    onadd,
    onremove,
    ontogglepin,
  }: {
    owned: Held[];
    pinned: BallName[];
    onadd: (name: BallName) => void;
    onremove: (h: Held) => void;
    ontogglepin: (name: BallName) => void;
  } = $props();

  const toggle = (name: BallName) => (holdsBall(owned, name) ? onremove(held(name)) : onadd(name));

  // Keyboard search (same keys as the level-up picker): type a few letters, Enter to add, repeat.
  let query = $state('');
  let hi = $state<number | null>(null); // arrow-key highlight; null = follow the top match
  let input = $state<HTMLInputElement>();
  let grid = $state<HTMLDivElement>();

  // Role filter: any picked role, AND the text query. The ball whose popover is open stays,
  // so editing its roles can't pull its cell (the popover's anchor) out from under you.
  let picked = $state<Role[]>([]);
  const togglePick = (r: Role) => {
    picked = picked.includes(r) ? picked.filter((x) => x !== r) : [...picked, r];
    hi = null;
  };
  const keep = (name: BallName) => hasAnyRole(name, picked, roleOf) || (!!tip.anchor && !!grid?.contains(tip.anchor) && tip.names.includes(name));

  const groups = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const hit = allBalls.filter((b) => b.name.toLowerCase().includes(q) && keep(b.name));
    // prefix matches first, otherwise keep catalogue order
    const match: Ball[] = q ? [...hit.filter((b) => b.name.toLowerCase().startsWith(q)), ...hit.filter((b) => !b.name.toLowerCase().startsWith(q))] : hit;
    return [
      { label: 'Base', balls: match.filter((b) => !b.parents.length) },
      { label: 'Evolved', balls: match.filter((b) => !!b.parents.length) },
    ].filter((g) => g.balls.length);
  });
  // the grid in rendered order, so Enter/arrows follow what you see
  const flat = $derived(groups.flatMap((g): Ball[] => g.balls));
  const index = $derived(new Map(flat.map((b, i) => [b.name, i])));
  const active = $derived(
    hi !== null && hi < flat.length ? hi : query.trim() ? flat.findIndex((b) => !holdsBall(owned, b.name)) : -1,
  );

  const build = $derived(summarize(owned, roleOf));
  const roleTitle = (h: Held) => {
    const t = tagOf(h, roleOf);
    return t?.roles.length ? t.roles.join(', ') + (t.vs ? ` · vs ${t.vs}` : '') : '';
  };

  // Export your role edits to merge into data/roles.json.
  const editCount = $derived(Object.keys(roleEdits).length);
  let copied = $state(false);
  const copyEdits = async () => {
    const json = exportEdits();
    try {
      await navigator.clipboard.writeText(json);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      prompt('Copy your role edits:', json);
    }
  };

  const reset = () => {
    query = '';
    hi = null;
  };
  const pick = (name: BallName) => {
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
    {#if editCount}<button class="ghost tiny copy" title="Copy your role edits as JSON (roles.json shape)" onclick={copyEdits}>{copied ? 'copied ✓' : `copy ${editCount} role edit${editCount > 1 ? 's' : ''}`}</button>{/if}
  </div>

  {#if owned.length}
    <div class="owned">
      {#each owned as h (heldLabel(h))}
        {#if h.kind === 'fused'}
          <!-- a fused ball only holds a slot: no pin, it feeds no recipe -->
          {@const [a, b] = h.parts}
          <div class="own fused">
            <span class="who" use:balltip={{ balls: h.parts, tap: true }}><img class="icon sm" src={icon(a)} alt="" /><span class="plus">⊕</span><img class="icon sm" src={icon(b)} alt="" /><span class="nm">{heldLabel(h)}</span></span>
            {@render dots(h)}
            <button class="ghost tiny" title="Remove" onclick={() => onremove(h)}>✕</button>
          </div>
        {:else}
        {@const name = h.name}
        <div class="own" class:pinned={pinned.includes(name)}>
          <span class="who" use:balltip={{ balls: name, tap: true }}><img class="icon sm" src={icon(name)} alt="" />{name}</span>
          {@render dots(h)}
          <button class="ghost tiny" title="Pin" aria-pressed={pinned.includes(name)} onclick={() => ontogglepin(name)}>📌</button>
          <button class="ghost tiny" title="Remove" onclick={() => onremove(h)}>✕</button>
        </div>
        {/if}
      {/each}
    </div>
    {#if build.counts.length || build.missing.length}
      <p class="build">
        {#each build.counts as c (c.role)}<span class="role role-{c.role}" title={ROLE_INFO[c.role]}>{c.n} {c.role}</span>{/each}
        {#if build.missing.length}<span class="miss">{build.missing.join(' · ')}</span>{/if}
        {#if build.untagged}<span class="muted">{build.untagged} untagged</span>{/if}
      </p>
    {/if}
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

  <div class="rolefilter" role="group" aria-label="Filter by role">
    {#each ROLES as r (r)}
      <button class="role role-{r}" aria-pressed={picked.includes(r)} title={ROLE_INFO[r]} onmousedown={(e) => e.preventDefault()} onclick={() => togglePick(r)}>{r}</button>
    {/each}
    {#if picked.length}<button class="ghost tiny" title="Clear role filter" onmousedown={(e) => e.preventDefault()} onclick={() => ((picked = []), (hi = null))}>✕</button>{/if}
  </div>

  <div class="grid" id="ball-choices" role="listbox" bind:this={grid}>
    {#each groups as g (g.label)}
      <div class="sep" role="presentation"><span>{g.label}</span><span class="muted">{g.balls.length}</span></div>
      {#each g.balls as b (b.name)}
      {@const i = index.get(b.name)}
      <button
        id="ball-choice-{i}"
        role="option"
        aria-selected={holdsBall(owned, b.name)}
        class="cell"
        class:have={holdsBall(owned, b.name)}
        class:hi={i === active}
        use:balltip={b.name}
        onclick={() => toggle(b.name)}
      >
        <img class="icon lg" src={b.img} alt="" />
        <span>{b.name}</span>
      </button>
      {/each}
    {:else}
      <p class="muted none">
        {#if query.trim()}No ball matches “{query.trim()}”{picked.length ? ' with those roles' : ''}.{:else}No ball tagged with those roles yet.{/if}
      </p>
    {/each}
  </div>
</section>

{#snippet dots(h: Held)}
  {@const t = tagOf(h, roleOf)}
  {#if t?.roles.length}
    <span class="dots" title={roleTitle(h)} aria-label={roleTitle(h)}>{#each t.roles as r (r)}<span class="dot role-{r}"></span>{/each}</span>
  {/if}
{/snippet}

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
  .copy { margin-left: auto; color: var(--muted); }
  .dots { display: inline-flex; gap: 2px; margin-left: -2px; }
  .build { margin: -2px 0 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; font-size: 12px; }
  .miss { color: var(--warn); }
  .rolefilter { display: flex; flex-wrap: wrap; gap: 4px; }
  .rolefilter .role { padding: 1px 6px; }
  .controls { display: flex; gap: 8px; min-width: 0; }
  .controls input { min-width: 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 6px; max-height: max(420px, calc(100vh - 290px)); overflow-y: auto; padding-right: 2px; }
  .cell { display: grid; justify-items: center; gap: 4px; padding: 6px 2px; font-size: 11px; line-height: 1.15; text-align: center; background: var(--panel); }
  .sep { grid-column: 1 / -1; position: sticky; top: 0; z-index: 1; display: flex; gap: 8px; align-items: baseline; padding: 6px 2px 4px; background: var(--bg); border-bottom: 1px solid var(--line); font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
  .sep:not(:first-child) { margin-top: 6px; }
  .none { grid-column: 1 / -1; }
  .cell.have { border-color: var(--good); background: color-mix(in srgb, var(--good) 12%, var(--panel)); }
  .cell.hi { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset, 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent); }
</style>
