<script lang="ts">
  import { icon } from '../lib/data';
  import { isReady, type Plan } from '../lib/planner';
  import { fusionLabel, type BallName, type TargetEntry } from '../lib/domain';
  import { balltip } from '../lib/tip.svelte';
  import TargetIcon from './TargetIcon.svelte';
  import TreeNode from './TreeNode.svelte';

  let {
    entry,
    plan,
    label,
    onback,
    oncycle,
    ondone,
  }: {
    entry: TargetEntry;
    plan: Plan;
    label: string;
    onback: () => void;
    oncycle: (ball: BallName, next: number) => void;
    ondone: () => void;
  } = $props();
</script>

<section class="bd">
  <button class="ghost back" onclick={onback}>← Targets</button>

  <header>
    <TargetIcon target={entry} size="lg" tap />
    <div>
      <div class="title">
        <span class="tier tier-{entry.tier}">{entry.tier}</span>
        <h1>{label}</h1>
      </div>
      <p class="muted why">{entry.why}{#if entry.unverified} <span class="tag">unverified community pick</span>{/if}</p>
    </div>
  </header>

  <div class="summary" class:nofit={!plan.fits}>
    <div>
      <h2>Still need</h2>
      {#if plan.needCount}
        <div class="chips">
          {#each [...plan.need] as [n, c] (n)}
            <span class="chip tap" use:balltip={{ balls: n, tap: true }}><img class="icon sm" src={icon(n)} alt="" />{n}{#if c > 1}<b> ×{c}</b>{/if}</span>
          {/each}
        </div>
      {:else}
        <p class="good">Nothing — you have every ingredient.</p>
        {#if isReady(plan)}
          <button class="do" onclick={ondone}>{entry.kind === 'fusion' ? 'Fuse' : 'Evolve'} now</button>
        {/if}
      {/if}
    </div>
    <div class="peak">
      <h2>Peak slots</h2>
      <p class="big" class:bad={!plan.fits}>{plan.peak}<span class="muted">/{plan.slots}</span></p>
      {#if !plan.fits}<p class="bad small">Doesn't fit in your slots.</p>{/if}
    </div>
  </div>

  {#if plan.duplicateConflicts.length}
    <p class="warnbox">This route needs two {plan.duplicateConflicts.join(', ')} at once, which the game won't allow. Try another recipe below.</p>
  {/if}

  <div>
    <h2>Steps</h2>
    <ol class="steps">
      {#if plan.startHeld}
        <li class="muted">
          Start holding {[...plan.have, ...(plan.reserved ? [`${plan.reserved} fused ball${plan.reserved > 1 ? 's' : ''}`] : [])].join(', ')}
          <span class="held">{plan.startHeld}/{plan.slots}</span>
        </li>
      {/if}
      {#each plan.steps as s, i (i)}
        <li class={s.kind}>
          {#if s.kind === 'acquire'}
            <span>Get</span> <span class="ball tap" use:balltip={{ balls: s.ball, tap: true }}><img class="icon sm" src={icon(s.ball)} alt="" /> <strong>{s.ball}</strong></span>
          {:else}
            <span>{s.kind === 'evolve' ? 'Evolve' : 'Fuse'}</span>
            <span class="muted">{#each s.from as f, j (j)}{#if j}{' + '}{/if}<span class="tap" use:balltip={{ balls: f, tap: true }}>{f}</span>{/each} →</span>
            <span class="ball tap" use:balltip={{ balls: s.kind === 'evolve' ? s.ball : s.from, tap: true }}>
              {#if s.kind === 'evolve'}<img class="icon sm" src={icon(s.ball)} alt="" />{/if}
              <strong>{s.kind === 'evolve' ? s.ball : fusionLabel(...s.from)}</strong>
            </span>
          {/if}
          <span class="held" class:bad={s.held > plan.slots}>{s.held}/{plan.slots}</span>
        </li>
      {/each}
    </ol>
  </div>

  <div>
    <h2>Recipe tree</h2>
    <div class="tree"><TreeNode node={plan.tree} {oncycle} /></div>
  </div>

  {#if entry.sources.length}
    <div class="sources">
      <h2>Sources</h2>
      {#each entry.sources as src (src)}<a href={src} target="_blank" rel="noreferrer">{new URL(src).hostname}</a>{/each}
    </div>
  {/if}
</section>

<style>
  .bd { display: grid; gap: 18px; }
  .back { justify-self: start; padding-left: 0; }
  header { display: flex; gap: 12px; align-items: flex-start; }
  .title { display: flex; gap: 8px; align-items: center; }
  h1 { font-size: 22px; }
  .why { margin: 4px 0 0; font-size: 14px; }
  .tag { font-size: 11px; color: var(--warn); border: 1px solid currentColor; border-radius: 4px; padding: 0 4px; }
  .summary { display: flex; gap: 16px; justify-content: space-between; padding: 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; }
  .summary.nofit { border-color: var(--bad); }
  .summary h2 { margin-bottom: 8px; }
  .chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px 3px 3px; background: var(--panel-2); border-radius: 6px; font-size: 13px; }
  .chip b { color: var(--warn); }
  .peak { text-align: right; flex-shrink: 0; }
  .big { font-size: 28px; font-weight: 800; margin: 0; }
  .small { font-size: 12px; margin: 0; }
  .good { color: var(--good); margin: 0; }
  .do { margin-top: 8px; padding: 4px 12px; font-size: 13px; font-weight: 600; border-color: var(--good); color: var(--good); background: color-mix(in srgb, var(--good) 12%, var(--panel)); }
  .bad { color: var(--bad); }
  .warnbox { margin: 0; padding: 10px; border: 1px solid var(--warn); border-radius: 8px; color: var(--warn); font-size: 14px; }
  .steps { margin: 8px 0 0; padding-left: 24px; display: grid; gap: 6px; }
  .steps li { padding-left: 4px; }
  .steps li > * { vertical-align: middle; }
  .ball > * { vertical-align: middle; }
  .tap { cursor: help; }
  .steps li.evolve strong { color: var(--accent); }
  .steps li.fuse strong { color: var(--accent); }
  .held { float: right; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .held.bad { color: var(--bad); font-weight: 700; }
  .tree { margin-top: 8px; padding: 12px; background: var(--panel); border-radius: 10px; overflow-x: auto; }
  .sources { display: flex; flex-wrap: wrap; gap: 10px; align-items: baseline; font-size: 13px; }
  .sources a { color: var(--accent); }
</style>
