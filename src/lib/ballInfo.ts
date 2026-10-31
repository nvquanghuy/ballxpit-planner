// Where a ball can go: what it evolves into, which curated targets it leads to or fuses into.
import type { Catalog } from './catalog';
import { tierRank, type BallName, type FusionEntry, type TargetEntry, type Tier } from './domain';

export interface Use {
  with: BallName[];
  result: BallName;
}

/** Every recipe that consumes `name`: the other ingredients and what they make. */
export function evolvesInto(cat: Catalog, name: BallName): Use[] {
  const out: Use[] = [];
  for (const b of cat.balls) {
    for (const r of b.parents) {
      const i = r.indexOf(name);
      if (i >= 0) out.push({ with: r.filter((_, j) => j !== i), result: b.name });
    }
  }
  return out;
}

export interface FusionLink {
  partner: BallName;
  tier: Tier;
  why: string;
  effect?: string;
}

const isFusion = (t: TargetEntry): t is FusionEntry => t.kind === 'fusion';

/** Curated fusion targets that include `name`, best tier first. */
export function fusionsOf(targets: readonly TargetEntry[], name: BallName): FusionLink[] {
  const out: FusionLink[] = [];
  for (const t of targets.filter(isFusion)) {
    const i = t.balls.indexOf(name);
    if (i >= 0) out.push({ partner: t.balls[1 - i], tier: t.tier, why: t.why, effect: t.effect });
  }
  return out.sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
}

/** The curated fusion target made of exactly these two balls, in either order. */
export function fusionFor(targets: readonly TargetEntry[], names: readonly BallName[]): FusionEntry | undefined {
  if (names.length !== 2) return;
  const [a, b] = names;
  return targets.filter(isFusion).find(({ balls: [x, y] }) => (x === a && y === b) || (x === b && y === a));
}

export interface Lead {
  result: BallName;
  tier: Tier;
  /** Intermediate evolutions between `name` and `result`, in order. */
  via: BallName[];
}

/**
 * Curated evolution targets reachable from `name` in two or more evolution steps
 * (direct ones are already in evolvesInto). Shortest path; best tier, then fewest steps.
 */
export function leadsTo(cat: Catalog, targets: readonly TargetEntry[], name: BallName): Lead[] {
  const prev = new Map<BallName, BallName | null>([[name, null]]);
  const queue = [name];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const u of evolvesInto(cat, cur)) {
      if (prev.has(u.result)) continue;
      prev.set(u.result, cur);
      queue.push(u.result);
    }
  }
  const out: Lead[] = [];
  const seen = new Set<BallName>();
  for (const t of targets) {
    if (t.kind !== 'evolution' || seen.has(t.ball) || t.ball === name || !prev.has(t.ball)) continue;
    seen.add(t.ball);
    const via: BallName[] = [];
    for (let p = prev.get(t.ball)!; p !== name; p = prev.get(p)!) via.unshift(p);
    if (via.length) out.push({ result: t.ball, tier: t.tier, via });
  }
  return out.sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.via.length - b.via.length);
}
