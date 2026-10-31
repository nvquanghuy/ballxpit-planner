<script lang="ts">
  import { allBalls, ballInfo, icon, targets } from '../lib/data';
  import { evolvesInto, fusionsOf, leadsTo } from '../lib/ballInfo';
  import { closeTip, tip } from '../lib/tip.svelte';

  let panel = $state<HTMLElement>();
  let pos = $state<{ x: number; y: number } | null>(null);

  const balls = $derived(tip.names.map((n) => ballInfo.get(n)).filter((b) => !!b));
  const FUSE_CAP = 6;
  const LEAD_CAP = 5;
  const dmg = (b: { damageType: string[] }) => b.damageType.filter((t) => t !== 'Base');

  $effect(() => {
    const a = tip.anchor;
    void balls;
    pos = null;
    if (!a || !panel) return;
    const r = a.getBoundingClientRect();
    const { width: w, height: h } = panel.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = innerHeight;
    const below = r.bottom + 6;
    const y = below + h <= vh - 8 || r.top - 6 - h < 8 ? below : r.top - 6 - h;
    const x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), vw - w - 8);
    pos = { x, y: Math.max(8, Math.min(y, vh - h - 8)) };
  });

  $effect(() => {
    if (!tip.anchor) return;
    const inside = (t: EventTarget | null) => t instanceof Node && (panel?.contains(t) || tip.anchor?.contains(t));
    const down = (e: PointerEvent) => !inside(e.target) && closeTip();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && closeTip();
    const scroll = (e: Event) => !(e.target instanceof Node && panel?.contains(e.target)) && closeTip();
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key);
    document.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key);
      document.removeEventListener('scroll', scroll, true);
    };
  });
</script>

{#if tip.anchor && balls.length}
  <div
    class="tip"
    class:hover={tip.hover}
    class:ready={!!pos}
    role="tooltip"
    bind:this={panel}
    style:left="{pos?.x ?? 0}px"
    style:top="{pos?.y ?? 0}px"
  >
    {#each balls as b (b.name)}
      {@const uses = evolvesInto(allBalls, b.name)}
      {@const fuses = fusionsOf(targets, b.name)}
      {@const leads = leadsTo(allBalls, targets, b.name)}
      <section>
        <header>
          <img class="icon" src={b.img} alt="" />
          <div>
            <strong>{b.name}</strong>
            <span class="kind" class:evo={!!b.parents}>{b.parents ? 'evolved' : 'base'}</span>
          </div>
        </header>
        <p class="desc">{b.description}</p>
        {#if tip.directions}
          <div class="line">
            <span class="lbl">If you take it</span>
            {#if tip.directions.length}
              <ul>
                {#each tip.directions as d (d.label)}
                  <li>
                    <span class="tier tier-{d.tier}">{d.tier}</span>
                    <strong>{d.label}</strong>
                    <span class="muted">need {d.before} → {d.after}</span>
                    {#if d.after === 0}<span class="done">ready</span>{/if}
                  </li>
                {/each}
              </ul>
            {:else}
              <span class="muted">Moves no target forward.</span>
            {/if}
          </div>
        {:else}
        {#if b.parents}
          <div class="line">
            <span class="lbl">Recipe</span>
            {#each b.parents as r, i (i)}
              {#if i}<span class="muted or">or</span>{/if}
              <span class="recipe">
                {#each r as p, j (j)}{#if j}<span class="muted">+</span>{/if}<img class="icon xs" src={icon(p)} alt="" />{p}{/each}
              </span>
            {/each}
          </div>
        {/if}
        {#if uses.length}
          <div class="line">
            <span class="lbl">Evolves</span>
            <ul>
              {#each uses as u, i (i)}
                <li>
                  <span class="muted">+</span>
                  {u.with.join(' + ')}
                  <span class="muted">→</span>
                  <img class="icon xs" src={icon(u.result)} alt="" /><strong>{u.result}</strong>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
        {#if leads.length}
          <div class="line">
            <span class="lbl">Leads to</span>
            <ul>
              {#each leads.slice(0, LEAD_CAP) as l (l.result)}
                <li>
                  <span class="tier tier-{l.tier} sm">{l.tier}</span>
                  <img class="icon xs" src={icon(l.result)} alt="" /><strong>{l.result}</strong>
                  <span class="muted">via {l.via.join(' → ')}</span>
                </li>
              {/each}
            </ul>
            {#if leads.length > LEAD_CAP}<span class="muted more">+{leads.length - LEAD_CAP} more</span>{/if}
          </div>
        {/if}
        {#if b.parents && !uses.length}
          <p class="muted final">Final evolution: can only be fused{fuses.length ? '' : ' (no curated fusion yet)'}.</p>
        {/if}
        {#if fuses.length}
          <div class="line">
            <span class="lbl">Fuses with</span>
            <ul>
              {#each fuses.slice(0, FUSE_CAP) as f (f.partner)}
                <li title={f.why}>
                  <span class="tier tier-{f.tier} sm">{f.tier}</span>
                  <span class="muted">⊕</span>
                  <img class="icon xs" src={icon(f.partner)} alt="" />{f.partner}
                </li>
              {/each}
            </ul>
            {#if fuses.length > FUSE_CAP}<span class="muted more">+{fuses.length - FUSE_CAP} more</span>{/if}
          </div>
        {/if}
        {/if}
        {#if dmg(b).length || b.statusEffect.length}
          <div class="tags">
            {#each dmg(b) as t (t)}<span class="tag dmg">{t}</span>{/each}
            {#each b.statusEffect as t (t)}<span class="tag">{t}</span>{/each}
          </div>
        {/if}
        {#if b.unlockRequirement}<p class="muted unlock">🔓 {b.unlockRequirement}</p>{/if}
      </section>
    {/each}
  </div>
{/if}

<style>
  .tip {
    position: fixed;
    z-index: 50;
    width: max-content;
    max-width: min(320px, calc(100vw - 16px));
    max-height: min(70vh, 520px);
    overflow-y: auto;
    padding: 10px;
    display: grid;
    gap: 10px;
    background: var(--panel-2);
    border: 1px solid var(--line);
    border-radius: 10px;
    box-shadow: 0 8px 24px #000a;
    font-size: 13px;
    visibility: hidden;
  }
  .tip.ready { visibility: visible; }
  .tip.hover { pointer-events: none; }
  section { display: grid; gap: 6px; }
  section + section { padding-top: 10px; border-top: 1px solid var(--line); }
  header { display: flex; gap: 8px; align-items: center; }
  header div { display: grid; }
  .kind { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
  .kind.evo { color: var(--accent); }
  .desc { margin: 0; }
  .line { display: flex; flex-wrap: wrap; gap: 4px 6px; align-items: baseline; }
  .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); width: 100%; }
  .recipe, li { display: inline-flex; align-items: center; gap: 4px; }
  .or { font-size: 12px; }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; width: 100%; }
  .icon.xs { width: 18px; height: 18px; border-radius: 3px; }
  .tags { display: flex; flex-wrap: wrap; gap: 4px; }
  .tag { font-size: 11px; padding: 0 5px; border-radius: 4px; border: 1px solid var(--line); color: var(--muted); }
  .tag.dmg { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 40%, transparent); }
  .done { font-size: 11px; color: var(--good); text-transform: uppercase; letter-spacing: 0.05em; }
  .unlock { margin: 0; font-size: 12px; }
  .final { margin: 0; font-size: 12px; }
  .more { font-size: 12px; }
  .tier.sm { width: 16px; height: 16px; font-size: 11px; border-radius: 4px; }
</style>
