<script lang="ts">
  import { icon } from '../lib/data';
  import { TIERS, type Suggestion, type Tier } from '../lib/targets';
  import { balltip } from '../lib/tip.svelte';
  import TargetIcon from './TargetIcon.svelte';

  let {
    items,
    showAll = $bindable(),
    hasOwned,
    onopen,
  }: { items: Suggestion[]; showAll: boolean; hasOwned: boolean; onopen: (id: string) => void } = $props();

  let tiers = $state<Tier[]>(['S', 'A']);
  let kind = $state<'all' | 'evolution' | 'fusion'>('all');

  const shown = $derived(items.filter((s) => tiers.includes(s.entry.tier) && (kind === 'all' || s.entry.kind === kind)));

  const toggleTier = (t: Tier) => (tiers = tiers.includes(t) ? tiers.filter((x) => x !== t) : [...tiers, t]);
</script>

<section class="sugg">
  <div class="head">
    <h2>Targets {#if hasOwned && !showAll}reachable from your balls{/if}</h2>
    <span class="muted count">{shown.length}</span>
  </div>

  <div class="filters">
    {#each TIERS as t (t)}
      <button class="tierbtn" class:off={!tiers.includes(t)} onclick={() => toggleTier(t)}><span class="tier tier-{t}">{t}</span></button>
    {/each}
    <span class="sep"></span>
    <button class:active={kind === 'all'} onclick={() => (kind = 'all')}>All</button>
    <button class:active={kind === 'evolution'} onclick={() => (kind = 'evolution')}>Evolved</button>
    <button class:active={kind === 'fusion'} onclick={() => (kind = 'fusion')}>Fused</button>
    {#if hasOwned}
      <label class="all"><input type="checkbox" bind:checked={showAll} /> include unrelated</label>
    {/if}
  </div>

  {#if !shown.length}
    <p class="muted">No targets match. Try more tiers{hasOwned ? ', fewer pins, or "include unrelated"' : ''}.</p>
  {/if}

  <ul>
    {#each shown as s (s.entry.id)}
      <li>
        <button class="card" class:nofit={!s.plan.fits} onclick={() => onopen(s.entry.id)}>
          <TargetIcon target={s.entry} size="lg" />
          <div class="body">
            <div class="title">
              <span class="tier tier-{s.entry.tier}">{s.entry.tier}</span>
              <strong>{s.label}</strong>
              {#if s.entry.unverified}<span class="tag">unverified</span>{/if}
            </div>
            <div class="row">
              {#if s.plan.have.length}
                <span class="lbl good">have</span>
                {#each s.plan.have as h (h)}<img class="icon sm" src={icon(h)} alt={h} use:balltip={h} />{/each}
              {/if}
              <span class="lbl">{s.plan.needCount ? `need ${s.plan.needCount}` : 'ready'}</span>
              {#each [...s.plan.need] as [n, c] (n)}
                <span class="need"><img class="icon sm" src={icon(n)} alt={n} use:balltip={n} />{#if c > 1}<sub>×{c}</sub>{/if}</span>
              {/each}
            </div>
            <div class="row muted small">
              {#if s.plan.via.length > 1}via {s.plan.via.slice(0, -1).join(' → ')} ·{/if}
              <span class:bad={!s.plan.fits}>peak {s.plan.peak}/{s.plan.slots} slots</span>
            </div>
          </div>
        </button>
      </li>
    {/each}
  </ul>
</section>

<style>
  .sugg { display: grid; gap: 10px; }
  .head { display: flex; justify-content: space-between; align-items: baseline; }
  .count { font-size: 12px; }
  .filters { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
  .filters button { padding: 4px 10px; font-size: 13px; }
  .filters button.active { border-color: var(--accent); color: var(--accent); }
  .tierbtn { padding: 3px !important; }
  .tierbtn.off { opacity: 0.3; }
  .sep { width: 6px; }
  .all { font-size: 13px; color: var(--muted); display: flex; gap: 4px; align-items: center; margin-left: auto; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .card { width: 100%; display: flex; gap: 12px; align-items: flex-start; text-align: left; padding: 10px; background: var(--panel); }
  .card.nofit { opacity: 0.5; }
  .body { display: grid; gap: 5px; min-width: 0; }
  .title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .tag { font-size: 11px; color: var(--warn); border: 1px solid currentColor; border-radius: 4px; padding: 0 4px; }
  .row { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--warn); margin-left: 2px; }
  .lbl.good { color: var(--good); margin-right: 0; }
  .row .lbl + .icon, .row .need:first-of-type { margin-left: 0; }
  .need { display: inline-flex; align-items: flex-end; }
  sub { font-size: 11px; color: var(--warn); }
  .small { font-size: 12px; }
  .bad { color: var(--bad); }
</style>
