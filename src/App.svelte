<script lang="ts">
  import { catalog, targets } from './lib/data';
  import { applyPlan, isFused, plan, targetLabel, type Plan } from './lib/planner';
  import { suggest } from './lib/targets';
  import { adviseOffers } from './lib/offers';
  import { readHash, writeHash } from './lib/urlState';
  import SlotSetup from './components/SlotSetup.svelte';
  import BallPicker from './components/BallPicker.svelte';
  import Suggestions from './components/Suggestions.svelte';
  import Breakdown from './components/Breakdown.svelte';
  import BallTip from './components/BallTip.svelte';
  import Offers from './components/Offers.svelte';

  const init = readHash();
  let slots = $state<number | null>(init.slots);
  let owned = $state<string[]>([...new Set(init.owned)].filter((n) => catalog.isValidOwned(n)));
  let pinned = $state<string[]>(init.pinned.filter((n) => owned.includes(n) && !isFused(n)));
  let targetId = $state<string | null>(init.target);
  let overrides = $state<Record<string, number>>(init.overrides);
  let offers = $state<string[]>(init.offers.filter((n) => catalog.byName.has(n)));
  let showAll = $state(false);

  $effect(() => writeHash({ slots, owned, pinned, target: targetId, overrides, offers }));

  // fused balls take a slot but feed no recipe
  const usable = $derived(owned.some((n) => !isFused(n)));
  const suggestions = $derived(
    slots ? suggest(catalog, targets, { owned, pinned, slots, showAll: showAll || !usable }) : [],
  );

  const advice = $derived(
    slots && offers.length ? adviseOffers(catalog, targets, { owned, pinned, slots, offers }) : { ranked: [], directions: [] },
  );

  const selected = $derived(targets.find((t) => t.id === targetId) ?? null);
  const selectedPlan = $derived(
    selected && slots ? plan(catalog, selected, { owned, pinned, slots, recipeOverrides: overrides }) : null,
  );

  const add = (n: string) => {
    owned = [...owned, n];
    offers = offers.filter((x) => x !== n);
  };
  const take = (n: string) => {
    add(n);
    offers = [];
  };
  const remove = (n: string) => {
    owned = owned.filter((x) => x !== n);
    pinned = pinned.filter((x) => x !== n);
  };
  const togglePin = (n: string) => (pinned = pinned.includes(n) ? pinned.filter((x) => x !== n) : [...pinned, n]);
  // Carry out a ready plan; the previous state stays undoable until owned changes again.
  let undo = $state.raw<{ label: string; fused: boolean; owned: string[]; pinned: string[]; after: string[] } | null>(null);
  const done = (p: Plan) => {
    const prev = { owned, pinned };
    ({ owned, pinned } = applyPlan(owned, pinned, p));
    undo = { label: p.target, fused: p.tree.kind === 'fuse', ...prev, after: owned };
    targetId = null;
  };
  const undoLast = () => {
    if (!undo) return;
    ({ owned, pinned } = undo);
    undo = null;
  };
  const open = (id: string) => {
    targetId = id;
    overrides = {};
    scrollTo({ top: 0 });
  };
</script>

{#if !slots}
  <SlotSetup onpick={(n) => (slots = n)} />
{:else}
  <main>
    <nav>
      <strong class="brand">Pit Planner</strong>
      <span class="muted">{slots} ball slots</span>
      <button class="ghost" onclick={() => (slots = null)}>change</button>
      {#if owned.length}<button class="ghost" onclick={() => { owned = []; pinned = []; offers = []; }}>new run</button>{/if}
    </nav>

    {#if undo && undo.after === owned}
      <p class="done">{undo.fused ? 'Fused' : 'Evolved'} <strong>{undo.label}</strong> <button class="ghost" onclick={undoLast}>undo</button><button class="ghost" title="Dismiss" onclick={() => (undo = null)}>✕</button></p>
    {/if}

    {#if selected && selectedPlan}
      <Breakdown
        entry={selected}
        plan={selectedPlan}
        label={targetLabel(selected)}
        onback={() => (targetId = null)}
        oncycle={(ball, next) => (overrides = { ...overrides, [ball]: next })}
        ondone={() => done(selectedPlan)}
      />
    {:else}
      <div class="layout">
        <BallPicker {owned} {pinned} onadd={add} onremove={remove} ontogglepin={togglePin} />
        <div class="right">
          <div class="offers-slot">
            <Offers
              {owned}
              {offers}
              {advice}
              onadd={(n) => (offers = [...offers, n])}
              onremove={(n) => (offers = offers.filter((x) => x !== n))}
              ontake={take}
              onclear={() => (offers = [])}
              onopen={open}
            />
          </div>
          <Suggestions items={suggestions} bind:showAll hasOwned={usable} onopen={open} ondone={(p) => done(p)} />
        </div>
      </div>
    {/if}
  </main>
{/if}

<BallTip />

<style>
  main { max-width: 1100px; margin: 0 auto; padding: 12px 16px 48px; display: grid; gap: 16px; }
  nav { display: flex; align-items: center; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
  .brand { margin-right: auto; font-size: 17px; letter-spacing: 0.02em; }
  nav button { padding: 2px 8px; font-size: 13px; }
  .done { margin: -6px 0 0; display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--good); }
  .done strong { color: var(--text); }
  .done button { padding: 2px 8px; font-size: 13px; }
  .done button[title] { color: var(--muted); }
  /* Phones: the level-up tray goes above the ball grid. */
  .right { display: contents; }
  .offers-slot { order: -1; min-width: 0; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; }
  @media (min-width: 860px) {
    .layout { grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); align-items: start; }
    .layout > :global(:first-child) { position: sticky; top: 12px; }
    .right { display: grid; gap: 16px; min-width: 0; }
    .offers-slot { order: 0; }
  }
</style>
