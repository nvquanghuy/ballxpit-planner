<script lang="ts">
  import { catalog, targets } from './lib/data';
  import { targetLabel, usableBalls, type TargetId } from './lib/domain';
  import { plan } from './lib/planner';
  import { suggest } from './lib/targets';
  import { adviseOffers } from './lib/offers';
  import { app, dispatch } from './lib/app.svelte';
  import SlotSetup from './components/SlotSetup.svelte';
  import BallPicker from './components/BallPicker.svelte';
  import Suggestions from './components/Suggestions.svelte';
  import Breakdown from './components/Breakdown.svelte';
  import BallTip from './components/BallTip.svelte';
  import Offers from './components/Offers.svelte';

  const run = $derived(app.run);
  let showAll = $state(false);

  // fused balls take a slot but feed no recipe
  const usable = $derived(usableBalls(run.held).length > 0);
  const opts = $derived({ owned: run.held, pinned: run.pinned, slots: run.slots ?? 0 });
  const suggestions = $derived(run.slots ? suggest(catalog, targets, { ...opts, showAll: showAll || !usable }) : []);

  const advice = $derived(
    run.slots && run.offers.length ? adviseOffers(catalog, targets, { ...opts, offers: run.offers }) : { ranked: [], directions: [] },
  );

  const selected = $derived(targets.find((t) => t.id === run.target) ?? null);
  const selectedPlan = $derived(selected && run.slots ? plan(catalog, selected, { ...opts, recipeOverrides: run.overrides }) : null);

  const open = (id: TargetId) => {
    dispatch({ type: 'open', id });
    scrollTo({ top: 0 });
  };
</script>

{#if !run.slots}
  <SlotSetup onpick={(n) => dispatch({ type: 'setSlots', slots: n })} />
{:else}
  <main>
    <nav>
      <strong class="brand">Pit Planner</strong>
      <span class="muted">{run.slots} ball slots</span>
      <button class="ghost" onclick={() => dispatch({ type: 'setSlots', slots: null })}>change</button>
      {#if run.held.length}<button class="ghost" onclick={() => dispatch({ type: 'newRun' })}>new run</button>{/if}
    </nav>

    {#if app.undo}
      <p class="done">{app.undo.fused ? 'Fused' : 'Evolved'} <strong>{app.undo.label}</strong> <button class="ghost" onclick={() => dispatch({ type: 'undo' })}>undo</button><button class="ghost" title="Dismiss" onclick={() => dispatch({ type: 'dismissUndo' })}>✕</button></p>
    {/if}

    {#if selected && selectedPlan}
      <Breakdown
        entry={selected}
        plan={selectedPlan}
        label={targetLabel(selected)}
        onback={() => dispatch({ type: 'close' })}
        oncycle={(ball, recipe) => dispatch({ type: 'setRecipe', ball, recipe })}
        ondone={() => dispatch({ type: 'apply', plan: selectedPlan })}
      />
    {:else}
      <div class="layout">
        <BallPicker
          owned={run.held}
          pinned={run.pinned}
          onadd={(ball) => dispatch({ type: 'add', ball })}
          onremove={(held) => dispatch({ type: 'remove', held })}
          ontogglepin={(ball) => dispatch({ type: 'togglePin', ball })}
        />
        <div class="right">
          <div class="offers-slot">
            <Offers
              owned={run.held}
              offers={run.offers}
              {advice}
              onadd={(ball) => dispatch({ type: 'addOffer', ball })}
              onremove={(ball) => dispatch({ type: 'removeOffer', ball })}
              ontake={(ball) => dispatch({ type: 'takeOffer', ball })}
              onclear={() => dispatch({ type: 'clearOffers' })}
              onopen={open}
            />
          </div>
          <Suggestions items={suggestions} bind:showAll hasOwned={usable} onopen={open} ondone={(plan) => dispatch({ type: 'apply', plan })} />
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
