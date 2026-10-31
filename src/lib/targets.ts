import type { Catalog } from './catalog';
import { targetLabel, tierRank, usableBalls, type BallName, type Held, type TargetEntry } from './domain';
import { plan, type Plan } from './planner';

export interface Suggestion {
  entry: TargetEntry;
  label: string;
  plan: Plan;
}

/**
 * Use case 1: targets reachable from what you own. A target is listed when its
 * best plan uses at least one owned ball (or you own nothing usable yet) and uses
 * every pinned ball. Sorted: fits in slots, fewest missing balls, then tier.
 */
export function suggest(
  cat: Catalog,
  entries: readonly TargetEntry[],
  opts: { owned: readonly Held[]; pinned: readonly BallName[]; slots: number; showAll?: boolean },
): Suggestion[] {
  const out: Suggestion[] = [];
  const usable = usableBalls(opts.owned).length > 0; // fused balls feed no recipe
  for (const entry of entries) {
    const p = plan(cat, entry, opts);
    if (opts.pinned.length && p.pinnedUnused.length) continue;
    if (!opts.showAll && usable && !p.have.length) continue;
    out.push({ entry, label: targetLabel(entry), plan: p });
  }
  return out.sort(
    (a, b) =>
      Number(!a.plan.fits) - Number(!b.plan.fits) ||
      a.plan.needCount - b.plan.needCount ||
      tierRank(a.entry.tier) - tierRank(b.entry.tier) ||
      a.label.localeCompare(b.label),
  );
}
