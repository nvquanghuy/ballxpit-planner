<script lang="ts">
  import { flushSync } from 'svelte';
  import { allBalls, icon } from '../lib/data';
  import type { OfferAdvice, OfferResult } from '../lib/offers';
  import { balltip, type TipDirection } from '../lib/tip.svelte';

  let {
    owned,
    offers,
    advice,
    onadd,
    onremove,
    ontake,
    onclear,
    onopen,
  }: {
    owned: string[];
    offers: string[];
    advice: OfferAdvice;
    onadd: (name: string) => void;
    onremove: (name: string) => void;
    ontake: (name: string) => void;
    onclear: () => void;
    onopen: (id: string) => void;
  } = $props();

  let picking = $state(false);
  let allDirs = $state(false);
  const SHOW = 8;

  // Level-ups offer base balls; ones you own would only be upgrades, which we ignore.
  const choices = $derived(allBalls.filter((b) => !b.parents && !owned.includes(b.name)));
  const result = $derived(new Map(advice.ranked.map((r) => [r.ball, r])));
  const best = $derived(advice.ranked[0]?.effects.length ? advice.ranked[0] : null);
  const runnerUp = $derived(advice.ranked[1]?.effects.length ? advice.ranked[1] : null);

  const tipDirections = (r: OfferResult | undefined): TipDirection[] =>
    (r?.effects ?? []).map((e) => ({ label: e.label, tier: e.entry.tier, before: e.before, after: e.after }));

  const toggle = (name: string) => (offers.includes(name) ? onremove(name) : onadd(name));

  // Keyboard search: open the picker, type a few letters, Enter to add, repeat.
  let query = $state('');
  let hi = $state<number | null>(null); // arrow-key highlight; null = follow the top match
  let input = $state<HTMLInputElement>();
  let grid = $state<HTMLDivElement>();

  const matches = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return choices;
    const hit = choices.filter((b) => b.name.toLowerCase().includes(q));
    // prefix matches first, otherwise keep catalogue order
    return [...hit.filter((b) => b.name.toLowerCase().startsWith(q)), ...hit.filter((b) => !b.name.toLowerCase().startsWith(q))];
  });
  const active = $derived(
    hi !== null && hi < matches.length ? hi : query.trim() ? matches.findIndex((b) => !offers.includes(b.name)) : -1,
  );

  const reset = () => {
    query = '';
    hi = null;
  };
  const open = () => {
    picking = true;
    reset();
    flushSync(); // render the input now so focus() stays inside the tap (mobile keyboards need that)
    input?.focus();
  };
  const close = () => {
    picking = false;
    reset();
  };
  const pick = (name: string) => {
    toggle(name);
    reset();
    input?.focus();
  };
  const move = (by: number) => {
    if (!matches.length) return;
    const from = active < 0 ? (by > 0 ? -1 : matches.length) : active;
    hi = (from + by + matches.length) % matches.length;
    flushSync();
    grid?.querySelector('.choice.hi')?.scrollIntoView({ block: 'nearest' });
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
      const b = matches[active];
      if (b) pick(b.name);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (query) reset();
      else close();
    } else if (e.key === 'Backspace' && !query && offers.length) {
      e.preventDefault();
      onremove(offers[offers.length - 1]);
    }
  };
</script>

<section class="offers">
  <div class="head">
    <h2>This level-up</h2>
    {#if offers.length}<button class="ghost small" onclick={onclear}>clear</button>{/if}
  </div>

  <div class="tray">
    {#each offers as name (name)}
      {@const r = result.get(name)}
      <div class="offer" class:top={best?.ball === name} class:dead={r && !r.effects.length}>
        <span class="who" use:balltip={{ balls: name, tap: true, directions: tipDirections(r) }}>
          <img class="icon sm" src={icon(name)} alt="" />{name}
          {#if r?.effects.length}<span class="n">{r.effects.length}</span>{/if}
        </span>
        <button class="ghost tiny take" title="I took this one" onclick={() => ontake(name)}>✓ took</button>
        <button class="ghost tiny" title="Remove" onclick={() => onremove(name)}>✕</button>
      </div>
    {/each}
    <button class="add" class:active={picking} onclick={() => (picking ? close() : open())}>{picking ? 'done' : '+ offer'}</button>
  </div>

  {#if picking}
    <input
      bind:this={input}
      type="search"
      placeholder="Type a ball, Enter to add…"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      enterkeyhint="done"
      role="combobox"
      aria-expanded="true"
      aria-controls="offer-choices"
      aria-activedescendant={active >= 0 ? `offer-choice-${active}` : undefined}
      bind:value={() => query, (v) => ((query = v), (hi = null))}
      onkeydown={onkey}
    />
    <div class="choices" id="offer-choices" role="listbox" bind:this={grid}>
      {#each matches as b, i (b.name)}
        <button
          id="offer-choice-{i}"
          role="option"
          aria-selected={offers.includes(b.name)}
          tabindex="-1"
          class="choice"
          class:on={offers.includes(b.name)}
          class:hi={i === active}
          title={b.name}
          onmousedown={(e) => e.preventDefault()}
          onclick={() => pick(b.name)}
        >
          <img class="icon sm" src={b.img} alt="" />
          <span>{b.name}</span>
        </button>
      {:else}
        <p class="muted none">No base ball matches “{query.trim()}”.</p>
      {/each}
    </div>
  {/if}

  {#if offers.length}
    <div class="rec">
      {#if best}
        <div class="pick">
          <span class="lbl">Take</span>
          <img class="icon" src={icon(best.ball)} alt="" />
          <strong>{best.ball}</strong>
        </div>
        <p class="why">{best.reason}</p>
        {#if best.needsRoom}<p class="warn">Your slots are full: fuse or evolve first to make room.</p>{/if}
        {#if runnerUp}<p class="muted small">runner-up: <strong>{runnerUp.ball}</strong> · {runnerUp.reason}</p>{/if}
      {:else}
        <p class="muted">None of these move a target forward. Take any of them.</p>
      {/if}
    </div>

    {#if advice.directions.length}
      <ul class="dirs">
        {#each allDirs ? advice.directions : advice.directions.slice(0, SHOW) as d (d.entry.id)}
          <li>
            <button class="dir" onclick={() => onopen(d.entry.id)}>
              <span class="tier tier-{d.entry.tier}">{d.entry.tier}</span>
              <strong class="label">{d.label}</strong>
              <span class="muted need">need {d.before} → {d.picks[0].after}</span>
              <span class="picks">
                {#each d.picks as p (p.ball)}<img class="icon sm" src={icon(p.ball)} alt={p.ball} title={p.ball} />{/each}
              </span>
              {#if d.picks[0].after === 0}<span class="ready">ready</span>{/if}
            </button>
          </li>
        {/each}
      </ul>
      {#if advice.directions.length > SHOW}
        <button class="ghost more" onclick={() => (allDirs = !allDirs)}>
          {allDirs ? 'show fewer' : `show all ${advice.directions.length} directions`}
        </button>
      {/if}
    {/if}
  {:else if !picking}
    <p class="muted small">When a level-up offers you balls, add them here to see which one to take.</p>
  {/if}
</section>

<style>
  .offers { display: grid; gap: 8px; padding: 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); }
  .head { display: flex; justify-content: space-between; align-items: baseline; }
  .small { font-size: 12px; }
  .head .small { padding: 0 6px; }
  .tray { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .offer { display: flex; align-items: center; gap: 4px; padding: 3px 4px; background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px; font-size: 13px; }
  .offer.top { border-color: var(--good); box-shadow: 0 0 0 1px var(--good) inset; }
  .offer.dead { opacity: 0.55; }
  .who { display: inline-flex; align-items: center; gap: 6px; cursor: help; }
  .n { font-size: 11px; min-width: 16px; text-align: center; border-radius: 8px; padding: 0 4px; background: color-mix(in srgb, var(--accent) 30%, transparent); }
  .tiny { padding: 0 4px; border: none; font-size: 12px; }
  .take { color: var(--good); }
  .add { padding: 4px 10px; font-size: 13px; border-style: dashed; }
  .add.active { border-color: var(--accent); color: var(--accent); border-style: solid; }
  .choices { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 4px; }
  .choice { display: flex; align-items: center; gap: 6px; padding: 3px 6px; font-size: 12px; text-align: left; background: var(--panel); min-height: 32px; }
  .choice.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 15%, var(--panel)); }
  .choice.hi { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset, 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent); }
  .none { grid-column: 1 / -1; margin: 0; font-size: 13px; }
  .rec { display: grid; gap: 4px; padding: 10px; border-radius: 8px; background: color-mix(in srgb, var(--good) 8%, var(--panel-2)); }
  .pick { display: flex; align-items: center; gap: 8px; font-size: 16px; }
  .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--good); }
  .why, .warn, .rec p { margin: 0; }
  .why { font-size: 13px; }
  .warn { font-size: 12px; color: var(--warn); }
  .dirs { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
  .dir { width: 100%; display: flex; align-items: center; gap: 8px; padding: 5px 8px; text-align: left; font-size: 13px; background: var(--panel); }
  .label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .need { font-size: 12px; white-space: nowrap; margin-left: auto; }
  .picks { display: inline-flex; gap: 2px; }
  .more { justify-self: start; padding: 2px 8px; font-size: 12px; }
  .ready { font-size: 11px; color: var(--good); text-transform: uppercase; letter-spacing: 0.05em; }
</style>
