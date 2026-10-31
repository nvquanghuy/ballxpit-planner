export interface Use {
  with: string[];
  result: string;
}

/** Every recipe that consumes `name`: the other ingredients and what they make. */
export function evolvesInto(balls: { name: string; parents?: string[][] }[], name: string): Use[] {
  const out: Use[] = [];
  for (const b of balls) {
    for (const r of b.parents ?? []) {
      const i = r.indexOf(name);
      if (i >= 0) out.push({ with: r.filter((_, j) => j !== i), result: b.name });
    }
  }
  return out;
}

type Recipes = { name: string; parents?: string[][] }[];
type TierTarget = { kind: string; tier: string; ball?: string; balls?: string[]; why?: string; effect?: string };

const TIER_ORDER = ['S', 'A', 'B', 'C'];
const tierRank = (t: string) => (TIER_ORDER.indexOf(t) + 1 || 99);

export interface FusionLink {
  partner: string;
  tier: string;
  why?: string;
  effect?: string;
}

/** Curated fusion targets that include `name`, best tier first. */
export function fusionsOf(targets: TierTarget[], name: string): FusionLink[] {
  const out: FusionLink[] = [];
  for (const t of targets) {
    if (t.kind !== 'fusion' || !t.balls) continue;
    const i = t.balls.indexOf(name);
    if (i >= 0) out.push({ partner: t.balls[1 - i], tier: t.tier, why: t.why, effect: t.effect });
  }
  return out.sort((a, b) => tierRank(a.tier) - tierRank(b.tier));
}

/** The curated fusion target made of exactly these two balls, in either order. */
export function fusionFor<T extends TierTarget>(targets: T[], names: string[]): T | undefined {
  if (names.length !== 2) return;
  const [a, b] = names;
  return targets.find((t) => t.kind === 'fusion' && !!t.balls && ((t.balls[0] === a && t.balls[1] === b) || (t.balls[0] === b && t.balls[1] === a)));
}

export interface Lead {
  result: string;
  tier: string;
  /** Intermediate evolutions between `name` and `result`, in order. */
  via: string[];
}

/**
 * Curated evolution targets reachable from `name` in two or more evolution steps
 * (direct ones are already in evolvesInto). Shortest path; best tier, then fewest steps.
 */
export function leadsTo(balls: Recipes, targets: TierTarget[], name: string): Lead[] {
  const prev = new Map<string, string>([[name, '']]);
  const queue = [name];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const u of evolvesInto(balls, cur)) {
      if (prev.has(u.result)) continue;
      prev.set(u.result, cur);
      queue.push(u.result);
    }
  }
  const out: Lead[] = [];
  const seen = new Set<string>();
  for (const t of targets) {
    if (t.kind !== 'evolution' || !t.ball || seen.has(t.ball) || t.ball === name || !prev.has(t.ball)) continue;
    seen.add(t.ball);
    const via: string[] = [];
    for (let p = prev.get(t.ball)!; p !== name; p = prev.get(p)!) via.unshift(p);
    if (via.length) out.push({ result: t.ball, tier: t.tier, via });
  }
  return out.sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.via.length - b.via.length);
}
