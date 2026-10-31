import { Catalog, plan, targetLabel, type Plan, type Target } from './planner';

export type Tier = 'S' | 'A' | 'B' | 'C';
export const TIERS: Tier[] = ['S', 'A', 'B', 'C'];

export type TargetEntry = Target & {
  id: string;
  tier: Tier;
  why: string;
  sources: string[];
  unverified?: boolean;
};

/** Problems with a targets file: unknown balls, invalid fusions, duplicate ids. */
export function validateTargets(cat: Catalog, entries: TargetEntry[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const t of entries) {
    if (ids.has(t.id)) problems.push(`duplicate id ${t.id}`);
    ids.add(t.id);
    if (!TIERS.includes(t.tier)) problems.push(`${t.id}: bad tier ${t.tier}`);
    const names = t.kind === 'evolution' ? [t.ball] : t.kind === 'fusion' ? t.balls : [];
    if (!names.length) problems.push(`${t.id}: bad kind ${(t as { kind: string }).kind}`);
    for (const n of names) if (!cat.byName.has(n)) problems.push(`${t.id}: unknown ball "${n}"`);
    if (t.kind === 'evolution' && cat.byName.has(t.ball) && cat.isBase(t.ball)) problems.push(`${t.id}: ${t.ball} is a base ball`);
    if (t.kind === 'fusion' && names.every((n) => cat.byName.has(n))) {
      const p = cat.fusionProblem(t.balls[0], t.balls[1]);
      if (p) problems.push(`${t.id}: ${p}`);
    }
  }
  return problems;
}

export interface Suggestion {
  entry: TargetEntry;
  label: string;
  plan: Plan;
}

/**
 * Use case 1: targets reachable from what you own. A target is listed when its
 * best plan uses at least one owned ball (or you own nothing yet) and uses every
 * pinned ball. Sorted: fits in slots, fewest missing balls, then tier.
 */
export function suggest(
  cat: Catalog,
  entries: TargetEntry[],
  opts: { owned: string[]; pinned: string[]; slots: number; showAll?: boolean },
): Suggestion[] {
  const out: Suggestion[] = [];
  for (const entry of entries) {
    const p = plan(cat, entry, opts);
    if (opts.pinned.length && p.pinnedUnused.length) continue;
    if (!opts.showAll && opts.owned.length && !p.have.length) continue;
    out.push({ entry, label: targetLabel(entry), plan: p });
  }
  return out.sort(
    (a, b) =>
      Number(!a.plan.fits) - Number(!b.plan.fits) ||
      a.plan.needCount - b.plan.needCount ||
      TIERS.indexOf(a.entry.tier) - TIERS.indexOf(b.entry.tier) ||
      a.label.localeCompare(b.label),
  );
}
