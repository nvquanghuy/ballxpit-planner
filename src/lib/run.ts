// A run: your slots, what you hold, pins, the level-up offer and the target you're looking at.
// Pure: parseRun builds one from the URL, step applies an action. The shell (app.svelte.ts) owns the I/O.
import { asBall, getBall, type Catalog } from './catalog';
import { held, heldKey, heldLabel, holdsBall, sameHeld, targetLabel, type BallName, type Held, type TargetEntry, type TargetId } from './domain';
import { parseHeld } from './parse';
import { applyPlan, isReady, type Plan } from './planner';
import type { UrlFields } from './urlCodec';

export interface Run {
  slots: number | null;
  held: Held[];
  /** Directions you're set on: always unfused balls you hold. */
  pinned: BallName[];
  /** Balls the current level-up offers: never ones you hold. */
  offers: BallName[];
  target: TargetId | null;
  /** Recipe choices in the breakdown, by evolved ball. */
  overrides: Partial<Record<BallName, number>>;
}

export interface Undo {
  label: string;
  fused: boolean;
  before: Pick<Run, 'held' | 'pinned'>;
}

export interface Session {
  run: Run;
  /** Offered while nothing you hold has changed since the evolve or fuse. */
  undo: Undo | null;
}

export type Action =
  | { type: 'setSlots'; slots: number | null }
  | { type: 'newRun' }
  | { type: 'add'; ball: BallName }
  | { type: 'remove'; held: Held }
  | { type: 'togglePin'; ball: BallName }
  | { type: 'addOffer'; ball: BallName }
  | { type: 'removeOffer'; ball: BallName }
  | { type: 'clearOffers' }
  | { type: 'takeOffer'; ball: BallName }
  | { type: 'open'; id: TargetId }
  | { type: 'close' }
  | { type: 'setRecipe'; ball: BallName; recipe: number }
  | { type: 'apply'; plan: Plan }
  | { type: 'undo' }
  | { type: 'dismissUndo' };

export const emptyRun = (slots: number | null = null): Run => ({ slots, held: [], pinned: [], offers: [], target: null, overrides: {} });

const uniq = <T>(xs: readonly T[], key: (x: T) => string = String) => {
  const seen = new Set<string>();
  return xs.filter((x) => !seen.has(key(x)) && !!seen.add(key(x)));
};

/** Enforce the run's rules: no duplicates, pins only on unfused held balls, offers only on balls you don't hold. */
export function normalize(r: Run): Run {
  const h = uniq(r.held, heldKey);
  return {
    ...r,
    slots: r.slots !== null && Number.isInteger(r.slots) && r.slots > 0 ? r.slots : null,
    held: h,
    pinned: uniq(r.pinned).filter((p) => holdsBall(h, p)),
    offers: uniq(r.offers).filter((o) => !holdsBall(h, o)),
  };
}

/** The URL's fields, typed. Unknown balls, invalid fusions, unknown targets and bad recipe choices are dropped. */
export function parseRun(f: UrlFields, cat: Catalog, targets: readonly TargetEntry[]): Run {
  const names = (xs: string[]) => xs.map((x) => asBall(cat, x)).filter((x) => x !== null);
  const overrides: Run['overrides'] = {};
  for (const [k, i] of Object.entries(f.overrides)) {
    const b = asBall(cat, k);
    if (b && i >= 0 && i < getBall(cat, b).parents.length) overrides[b] = i;
  }
  return normalize({
    slots: f.slots,
    held: f.owned.map((s) => parseHeld(cat, s)).filter((h) => h !== null),
    pinned: names(f.pinned),
    offers: names(f.offers),
    target: targets.find((t) => t.id === f.target)?.id ?? null,
    overrides,
  });
}

export const toUrl = (r: Run): UrlFields => ({
  slots: r.slots,
  owned: r.held.map(heldLabel),
  pinned: r.pinned,
  target: r.target,
  overrides: r.overrides as Record<string, number>,
  offers: r.offers,
});

function update(r: Run, a: Action): Run {
  switch (a.type) {
    case 'setSlots':
      return { ...r, slots: a.slots };
    case 'newRun':
      return emptyRun(r.slots);
    case 'add':
      return { ...r, held: [...r.held, held(a.ball)] };
    case 'remove':
      return { ...r, held: r.held.filter((h) => !sameHeld(h, a.held)) };
    case 'togglePin':
      return { ...r, pinned: r.pinned.includes(a.ball) ? r.pinned.filter((p) => p !== a.ball) : [...r.pinned, a.ball] };
    case 'addOffer':
      return { ...r, offers: [...r.offers, a.ball] };
    case 'removeOffer':
      return { ...r, offers: r.offers.filter((o) => o !== a.ball) };
    case 'clearOffers':
      return { ...r, offers: [] };
    case 'takeOffer':
      return { ...r, held: [...r.held, held(a.ball)], offers: [] };
    case 'open':
      return { ...r, target: a.id, overrides: {} };
    case 'close':
      return { ...r, target: null };
    case 'setRecipe':
      return { ...r, overrides: { ...r.overrides, [a.ball]: a.recipe } };
    case 'apply':
      return isReady(a.plan) ? { ...r, ...applyPlan(r.held, r.pinned, a.plan), target: null } : r;
    case 'undo':
    case 'dismissUndo':
      return r;
  }
}

export function step(s: Session, a: Action): Session {
  if (a.type === 'undo') return s.undo ? { run: normalize({ ...s.run, ...s.undo.before }), undo: null } : s;
  if (a.type === 'dismissUndo') return { ...s, undo: null };
  const run = normalize(update(s.run, a));
  if (a.type === 'apply' && isReady(a.plan)) {
    const t = a.plan.target;
    return { run, undo: { label: targetLabel(t), fused: t.kind === 'fusion', before: { held: s.run.held, pinned: s.run.pinned } } };
  }
  const same = run.held.length === s.run.held.length && run.held.every((h, i) => sameHeld(h, s.run.held[i]));
  return { run, undo: same ? s.undo : null };
}
