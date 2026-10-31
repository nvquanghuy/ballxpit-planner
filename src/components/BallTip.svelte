<script lang="ts">
  import { flushSync } from 'svelte';
  import { catalog, icon, targets } from '../lib/data';
  import { getBall } from '../lib/catalog';
  import { fusionLabel, type BallName } from '../lib/domain';
  import { evolvesInto, fusionFor, fusionsOf, leadsTo } from '../lib/ballInfo';
  import { cancelClose, closeSoon, closeTip, tip } from '../lib/tip.svelte';
  import { ROLE_INFO, ROLES, VS, type Role, type Vs } from '../lib/roles';
  import { resetRoles, roleEdits, roleOf, setRoles } from '../lib/roleEdits.svelte';

  let panel = $state<HTMLElement>();
  let pos = $state<{ x: number; y: number } | null>(null);

  const balls = $derived(tip.names.map((n) => getBall(catalog, n)));
  // Every fused-target anchor passes exactly its two components, so the pair identifies the fusion.
  const fusion = $derived(tip.directions ? undefined : fusionFor(targets, tip.names));
  const FUSE_CAP = 6;
  const LEAD_CAP = 5;
  const dmg = (b: { damageType: string[] }) => b.damageType.filter((t) => t !== 'Base');

  // Role editing: one ball at a time, closed whenever the popover moves to another anchor.
  let editing = $state<BallName | null>(null);
  $effect(() => {
    void tip.anchor;
    editing = null;
  });
  const startEdit = (name: BallName) => {
    editing = name;
    flushSync();
    // the edit row makes the panel taller: nudge it up rather than re-place it (which could flip it off the pointer)
    if (!panel || !pos) return;
    const max = innerHeight - panel.getBoundingClientRect().height - 8;
    if (pos.y > max) pos = { ...pos, y: Math.max(8, max) };
  };
  const toggleRole = (name: BallName, r: Role) => {
    const t = roleOf(name);
    const roles = t?.roles ?? [];
    setRoles(name, { roles: roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r], vs: t?.vs });
  };
  const setVs = (name: BallName, vs: Vs) => setRoles(name, { roles: roleOf(name)?.roles ?? [], vs });

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
    onpointerenter={(e) => e.pointerType === 'mouse' && cancelClose()}
    onpointerleave={(e) => e.pointerType === 'mouse' && tip.hover && closeSoon()}
    style:left="{pos?.x ?? 0}px"
    style:top="{pos?.y ?? 0}px"
  >
    {#if fusion?.kind === 'fusion'}
      <section class="fusion">
        <header>
          <span class="pair">
            <img class="icon" src={icon(fusion.balls[0])} alt="" /><span class="plus">⊕</span><img class="icon" src={icon(fusion.balls[1])} alt="" />
          </span>
          <div>
            <strong>{fusionLabel(...fusion.balls)}</strong>
            <span class="kind fused">fused{#if fusion.unverified}<span class="unv">· unverified</span>{/if}</span>
          </div>
          <span class="tier tier-{fusion.tier}">{fusion.tier}</span>
        </header>
        <p class="desc effect">{fusion.effect ?? fusion.why}</p>
        {#if fusion.effect}<p class="muted why"><span class="lbl">Why it ranks</span> {fusion.why}</p>{/if}
      </section>
    {/if}
    {#each balls as b (b.name)}
      {@const uses = evolvesInto(catalog, b.name)}
      {@const fuses = fusionsOf(targets, b.name)}
      {@const leads = leadsTo(catalog, targets, b.name)}
      {@const tag = roleOf(b.name)}
      {@const edited = b.name in roleEdits}
      <section>
        <header>
          <img class="icon" src={b.img} alt="" />
          <div>
            <strong>{b.name}</strong>
            <span class="kind" class:evo={!!b.parents.length}>{b.parents.length ? 'evolved' : 'base'}</span>
          </div>
        </header>
        <div class="roles">
          {#if editing === b.name}
            {@const on = tag?.roles ?? []}
            {#each ROLES as r (r)}
              <!-- 1-3 roles, as in roles.json, so an export always merges cleanly -->
              {@const stuck = on.includes(r) ? on.length === 1 : on.length >= 3}
              <button class="role role-{r}" aria-pressed={on.includes(r)} disabled={stuck} title={stuck ? (on.length === 1 ? 'Keep at least one role' : 'At most 3 roles') : ROLE_INFO[r]} onclick={() => toggleRole(b.name, r)}>{r}</button>
            {/each}
            <span class="vspick">
              <span class="muted">vs</span>
              {#each VS as v (v)}<button class="role" aria-pressed={tag?.vs === v} disabled={!on.length} title={on.length ? undefined : 'Pick a role first'} onclick={() => setVs(b.name, v)}>{v}</button>{/each}
            </span>
            <span class="acts">
              {#if edited}<button class="ghost mini" title="Back to the researched tags" onclick={() => resetRoles(b.name)}>reset</button>{/if}
              <button class="ghost mini" onclick={() => (editing = null)}>done</button>
            </span>
          {:else}
            {#each tag?.roles ?? [] as r (r)}<span class="role role-{r}" title={ROLE_INFO[r]}>{r}</span>{/each}
            {#if tag?.vs}<span class="vs">vs {tag.vs}</span>{/if}
            {#if !tag?.roles.length}<span class="muted">no role tags</span>{/if}
            <span class="acts">
              {#if edited}
                <span class="edited" title="Your edit: overrides the researched tags">edited</span>
                <button class="ghost mini" title="Back to the researched tags" onclick={() => resetRoles(b.name)}>reset</button>
              {/if}
              <button class="ghost mini" title="Change this ball's roles (saved in this browser)" onclick={() => startEdit(b.name)}>edit roles</button>
            </span>
          {/if}
        </div>
        <p class="desc">{b.description}</p>
        {#if tag?.why && !fusion && editing !== b.name}<p class="muted rwhy"><span class="lbl">Role</span> {tag.why}</p>{/if}
        {#if fusion}
          <!-- component of a fusion: description only, the fusion is the story -->
        {:else if tip.directions}
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
        {#if b.parents.length}
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
                <li title={f.effect ?? f.why}>
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
        {#if !fusion && (dmg(b).length || b.statusEffect.length)}
          <div class="tags">
            {#each dmg(b) as t (t)}<span class="tag dmg">{t}</span>{/each}
            {#each b.statusEffect as t (t)}<span class="tag">{t}</span>{/each}
          </div>
        {/if}
        {#if !fusion && b.unlockRequirement}<p class="muted unlock">🔓 {b.unlockRequirement}</p>{/if}
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
    overscroll-behavior: contain;
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
  section { display: grid; gap: 6px; }
  section + section { padding-top: 10px; border-top: 1px solid var(--line); }
  header { display: flex; gap: 8px; align-items: center; }
  header div { display: grid; }
  .kind { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
  .kind.evo { color: var(--accent); }
  .desc { margin: 0; }
  .fusion header { gap: 6px; }
  .fusion header div { flex: 1; }
  .pair { display: inline-flex; align-items: center; gap: 2px; flex-shrink: 0; }
  .plus { color: var(--accent); font-size: 14px; }
  .kind.fused { color: var(--accent); }
  .unv { color: var(--warn); margin-left: 4px; }
  .effect { font-size: 14px; line-height: 1.4; }
  .why { margin: 0; font-size: 12px; }
  .why .lbl { width: auto; margin-right: 2px; }
  .fusion ~ section header .icon { width: 24px; height: 24px; }
  .fusion ~ section .desc { font-size: 12px; color: var(--muted); }
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
  .roles .role[aria-pressed='false'] { opacity: 0.4; }
  .roles .role:disabled { cursor: default; border-color: color-mix(in srgb, var(--c, var(--muted)) 35%, transparent); }
  .roles .role[aria-pressed='false']:disabled { opacity: 0.2; }
  .roles { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
  .vs { font-size: 11px; color: var(--muted); }
  .vspick { display: inline-flex; align-items: center; gap: 4px; }
  .vspick .muted { font-size: 11px; }
  .acts { display: inline-flex; align-items: center; gap: 2px; margin-left: auto; }
  .edited { font-size: 11px; color: var(--warn); }
  .mini { padding: 0 5px; font-size: 11px; border: none; color: var(--muted); }
  .mini:hover { color: var(--text); }
  .rwhy { margin: 0; font-size: 12px; }
  .rwhy .lbl { width: auto; margin-right: 2px; }
  .tier.sm { width: 16px; height: 16px; font-size: 11px; border-radius: 4px; }
</style>
