// Level-up offers: which offered ball moves which target forward, and which to take.
import type { Catalog } from './catalog';
import { held, holdsBall, targetLabel, TIERS, usableBalls, type BallName, type Held, type TargetEntry } from './domain';
import { plan, type Plan } from './planner';

export interface Effect {
  entry: TargetEntry;
  label: string;
  /** Balls still missing without / with the offered ball. */
  before: number;
  after: number;
  /** Target wasn't related to any owned ball before. */
  opens: boolean;
  plan: Plan;
}

export interface OfferResult {
  ball: BallName;
  effects: Effect[];
  /** Your slots are full: fuse or evolve first to make room. */
  needsRoom: boolean;
  reason: string;
}

export interface Direction {
  entry: TargetEntry;
  label: string;
  before: number;
  /** Offers that move this target forward, best first. */
  picks: { ball: BallName; after: number }[];
}

export interface OfferAdvice {
  /** Best first; offers that help nothing come last. */
  ranked: OfferResult[];
  directions: Direction[];
}

const tierScore = (e: TargetEntry) => TIERS.length - TIERS.indexOf(e.tier);

/**
 * Ranking (agreed with the user): finishes a target (best tier first), then the
 * best tier moved forward, then how many targets move forward. Pins narrow the
 * targets to those using every pinned ball, as in `suggest`.
 */
export function adviseOffers(
  cat: Catalog,
  entries: readonly TargetEntry[],
  opts: { owned: readonly Held[]; pinned: readonly BallName[]; slots: number; offers: readonly BallName[] },
): OfferAdvice {
  const offers = opts.offers.filter((o) => !holdsBall(opts.owned, o));
  const usable = usableBalls(opts.owned).length > 0;
  const before = new Map(entries.map((e) => [e.id, plan(cat, e, opts)]));

  const results: OfferResult[] = offers.map((ball) => {
    const owned = [...opts.owned, held(ball)];
    const effects: Effect[] = [];
    for (const entry of entries) {
      const b = before.get(entry.id)!;
      const p = plan(cat, entry, { ...opts, owned });
      if (!p.have.includes(ball) || p.needCount >= b.needCount || !p.fits || p.pinnedUnused.length) continue;
      effects.push({
        entry,
        label: targetLabel(entry),
        before: b.needCount,
        after: p.needCount,
        opens: usable && !b.have.length,
        plan: p,
      });
    }
    effects.sort((x, y) => tierScore(y.entry) - tierScore(x.entry) || x.after - y.after || x.label.localeCompare(y.label));
    return { ball, effects, needsRoom: opts.owned.length >= opts.slots, reason: reason(effects) };
  });

  const key = (r: OfferResult) => [
    Math.max(0, ...r.effects.filter((e) => e.after === 0).map((e) => tierScore(e.entry))),
    Math.max(0, ...r.effects.map((e) => tierScore(e.entry))),
    r.effects.length,
  ];
  const ranked = results
    .map((r) => ({ r, k: key(r) }))
    .sort((a, b) => b.k[0] - a.k[0] || b.k[1] - a.k[1] || b.k[2] - a.k[2])
    .map(({ r }) => r);

  const byTarget = new Map<string, Direction>();
  for (const r of ranked) {
    for (const e of r.effects) {
      let d = byTarget.get(e.entry.id);
      if (!d) byTarget.set(e.entry.id, (d = { entry: e.entry, label: e.label, before: e.before, picks: [] }));
      d.picks.push({ ball: r.ball, after: e.after });
    }
  }
  const directions = [...byTarget.values()];
  for (const d of directions) d.picks.sort((a, b) => a.after - b.after);
  directions.sort(
    (a, b) => tierScore(b.entry) - tierScore(a.entry) || a.picks[0].after - b.picks[0].after || a.label.localeCompare(b.label),
  );
  return { ranked, directions };
}

function reason(effects: Effect[]): string {
  if (!effects.length) return 'moves no target forward';
  const done = effects.filter((e) => e.after === 0);
  const rest = effects.filter((e) => e.after > 0).sort((a, b) => tierScore(b.entry) - tierScore(a.entry));
  const parts: string[] = [];
  if (done.length) parts.push(`finishes ${done[0].label} (${done[0].entry.tier})`);
  if (rest.length) parts.push(`moves ${rest[0].label} (${rest[0].entry.tier}) forward`);
  const more = effects.length - (done.length ? 1 : 0) - (rest.length ? 1 : 0);
  if (more > 0) parts.push(`+${more} more`);
  return parts.join(' · ');
}
