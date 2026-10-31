<script lang="ts">
  import { TIERS } from '../lib/domain';
  import { ROLE_INFO, ROLES } from '../lib/roles';

  let { onback }: { onback: () => void } = $props();
</script>

<article class="about">
  <button class="ghost back" onclick={onback}>← Back</button>

  <header>
    <h1>About BallxPit Planner</h1>
    <p class="lede">
      A run planner for <strong>BALL x PIT</strong>. Tell it which balls you hold and it shows the strong evolutions and fusions you can
      reach, what you still need, and the order to build them without running out of slots.
    </p>
  </header>

  <section>
    <h2>Start a run</h2>
    <ul>
      <li>Pick your <strong>slot count</strong> (most characters have 4).</li>
      <li>Tap the <strong>balls you hold</strong>. Or type in the search box: Enter adds the top match, Backspace on an empty box removes the last one.</li>
      <li><strong>Pin</strong> 📌 a ball you're committed to: only targets that use every pinned ball are listed.</li>
    </ul>
  </section>

  <section>
    <h2>Targets</h2>
    <p>
      A curated list of strong end goals: final evolutions and fusions, ranked
      <span class="tiers">{#each TIERS as t (t)}<span class="tier tier-{t}">{t}</span>{/each}</span>.
      By default it shows the ones reachable from your balls. Each card shows:
    </p>
    <ul>
      <li><span class="lbl good">have</span> and <span class="lbl">need</span>: balls you already hold for it, and balls still to find.</li>
      <li><strong>via</strong>: the evolutions you make on the way.</li>
      <li><strong>peak</strong>: the most slots you'll fill at once. Targets that don't fit are dimmed.</li>
      <li>Role tags, and for fusions a <span class="combo">enabler + effect</span> badge when one part spreads and the other carries the payload, the pattern behind most top fusions.</li>
      <li>When nothing is missing, an <strong class="good">Evolve</strong> / <strong class="good">Fuse</strong> button swaps the parts for the result. You can undo it.</li>
    </ul>
    <p class="muted small">Filter by tier and by evolved or fused. "Include unrelated" shows targets that use none of your balls.</p>
  </section>

  <section>
    <h2>Breakdown</h2>
    <p>Open a target for the full plan:</p>
    <ul>
      <li><strong>Still need</strong>: the shopping list, with peak slot usage.</li>
      <li><strong>Steps</strong>: what to get, evolve and fuse, in an order that never overflows your slots.</li>
      <li><strong>Recipe tree</strong>: where a ball has more than one recipe, switch between them.</li>
      <li><strong>Sources</strong>: links behind the target's ranking.</li>
    </ul>
  </section>

  <section>
    <h2>Level-up offers</h2>
    <ul>
      <li>Under "This level-up", add the balls the game offers you.</li>
      <li>The planner recommends one and lists the targets each offer moves forward. It prefers an offer that finishes a target (best tier first), then the best tier moved forward, then the most targets.</li>
      <li>Tap "✓ took" on the one you picked: it joins your balls and the offers clear.</li>
      <li>Only new base balls count; upgrades to balls you hold are ignored.</li>
    </ul>
  </section>

  <section>
    <h2>Ball popovers</h2>
    <p>Hover a ball (long-press on touch) to see what it does, its recipe, what it evolves into, which top targets it leads to, and its curated fusions with their effects.</p>
  </section>

  <section>
    <h2>Roles</h2>
    <p>Each ball is tagged with what it does in a line-up:</p>
    <dl class="roles">
      {#each ROLES as r (r)}
        <dt><span class="role role-{r}">{r}</span></dt>
        <dd>{ROLE_INFO[r]}</dd>
      {/each}
    </dl>
    <ul>
      <li>Filter the ball grid by role.</li>
      <li>The build summary counts roles across your balls and flags gaps, like no sustain or weak vs bosses.</li>
      <li>Disagree with a tag? "Edit roles" in the popover. Your edits are saved in this browser, and "copy role edits" exports them as JSON.</li>
    </ul>
  </section>

  <section>
    <h2>Rules it assumes</h2>
    <ul>
      <li>Evolving consumes all its parts. Evolved balls can evolve again.</li>
      <li>Fusing takes two different, unfused balls, except a pair that shares a two-ball recipe: that pair must evolve instead.</li>
      <li>A fused ball takes a slot but can't evolve or fuse again.</li>
      <li>You can't hold two copies of the same ball at once.</li>
      <li>Missing balls are picked up just in time. Among all recipes and orders, the plan with the fewest missing balls wins, then the lowest peak slots.</li>
      <li>Ball levels are ignored. Levelling is up to you.</li>
    </ul>
  </section>

  <section>
    <h2>Your run is in the link</h2>
    <p>Slots, balls, pins, the open target and offers live in the page URL. Bookmark or share it to pick up where you left off. Nothing is sent anywhere.</p>
  </section>

  <section>
    <h2>Data</h2>
    <ul>
      <li>Ball data and icons: a snapshot from <a href="https://ballxpit-evolution.github.io/" target="_blank" rel="noreferrer">ballxpit-evolution.github.io</a>.</li>
      <li>Rules: <a href="https://ballxpit.wiki.gg/wiki/Evolution" target="_blank" rel="noreferrer">ballxpit.wiki.gg</a>.</li>
      <li>Tiers: curated from community tier lists and guides. Each target links its sources; some picks are marked <span class="tag">unverified</span>.</li>
      <li>Role tags: researched from ball descriptions and community guides, and editable by you.</li>
    </ul>
    <p class="muted small">A fan-made tool, not affiliated with the developers or publisher of BALL x PIT. Ball icons are game assets © their owners.</p>
  </section>
</article>

<style>
  .about { max-width: 720px; margin: 0 auto; padding: 12px 16px 48px; display: grid; gap: 22px; }
  .back { justify-self: start; padding-left: 0; }
  h1 { font-size: 22px; }
  .lede { margin: 6px 0 0; color: var(--muted); }
  .lede strong { color: var(--text); }
  section { display: grid; gap: 8px; padding-top: 14px; border-top: 1px solid var(--line); }
  p { margin: 0; }
  ul { margin: 0; padding-left: 20px; display: grid; gap: 5px; }
  a { color: var(--accent); }
  .small { font-size: 13px; }
  .good { color: var(--good); }
  .tiers { display: inline-flex; gap: 3px; vertical-align: middle; }
  .tiers .tier { width: 18px; height: 18px; font-size: 11px; }
  .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--warn); }
  .lbl.good { color: var(--good); }
  .tag { font-size: 11px; color: var(--warn); border: 1px solid currentColor; border-radius: 4px; padding: 0 4px; }
  .roles { margin: 0; display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 6px 10px; align-items: baseline; padding: 10px 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; }
  .roles dd { margin: 0; font-size: 14px; color: var(--muted); }
  @media (max-width: 420px) {
    .roles { grid-template-columns: minmax(0, 1fr); gap: 2px; }
    .roles dd { margin-bottom: 6px; }
  }
</style>
