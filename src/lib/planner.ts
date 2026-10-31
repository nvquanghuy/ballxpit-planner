// Recipe planner: given owned balls and a slot count, find the cheapest
// slot-safe way to build a target ball (evolved or fused).
//
// Rules (see README):
// - Owned balls used by the plan are held from step 0; unused owned balls are ignored.
// - Each owned ball covers one recipe leaf only.
// - Missing balls are acquired just-in-time, right before the evolve that consumes them.
// - You can't hold two copies of the same ball at once (picking an owned ball levels it).
// - Balls can be re-acquired after being consumed.
// - Fused balls you hold can't be used again but still take a slot.

import { fusionProblem, getBall, type Catalog } from './catalog';
import { holdsBall, resultOf, sameHeld, usableBalls, type BallName, type Held, type Pair, type Target } from './domain';

export type BallNode =
  | { kind: 'owned'; ball: BallName }
  | { kind: 'acquire'; ball: BallName }
  | { kind: 'evolve'; ball: BallName; recipe: number; recipeCount: number; children: BallNode[] };
export type FuseNode = { kind: 'fuse'; children: [BallNode, BallNode] };
export type Node = BallNode | FuseNode;

export type Step =
  | { kind: 'acquire'; ball: BallName; held: number }
  | { kind: 'evolve'; ball: BallName; from: BallName[]; held: number }
  | { kind: 'fuse'; from: Pair; held: number };

export interface Plan {
  target: Target;
  /** What you hold once the plan is done. */
  result: Held;
  tree: Node;
  steps: Step[];
  /** Owned balls the plan consumes. */
  have: BallName[];
  /** Balls still to find, with multiplicity. */
  need: Map<BallName, number>;
  needCount: number;
  /** Intermediate + final evolutions made along the way. */
  via: BallName[];
  startHeld: number;
  /** Slots taken by fused balls you hold; counted in startHeld, peak and every step's held. */
  reserved: number;
  peak: number;
  slots: number;
  fits: boolean;
  /** Steps where you'd have to hold a duplicate ball (not possible in-game). */
  duplicateConflicts: BallName[];
  pinnedUnused: BallName[];
}

export interface PlanOptions {
  owned: readonly Held[];
  pinned?: readonly BallName[];
  slots: number;
  /** Force a recipe index for a given evolved ball. */
  recipeOverrides?: Partial<Record<BallName, number>>;
}

function* cartesian<T>(lists: T[][]): Generator<T[]> {
  if (!lists.length) {
    yield [];
    return;
  }
  const [head, ...rest] = lists;
  for (const h of head) for (const r of cartesian(rest)) yield [h, ...r];
}

function* permutations<T>(items: T[]): Generator<T[]> {
  if (items.length <= 1) {
    yield items;
    return;
  }
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const p of permutations(rest)) yield [items[i], ...p];
  }
}

/** All recipe-choice trees for a ball (owned balls may stop the expansion). */
function expand(cat: Catalog, name: BallName, owned: Set<BallName>, overrides: Partial<Record<BallName, number>>): BallNode[] {
  const out: BallNode[] = [];
  if (owned.has(name)) out.push({ kind: 'owned', ball: name });
  const ball = getBall(cat, name);
  if (!ball.parents.length) {
    out.push({ kind: 'acquire', ball: name });
    return out;
  }
  const o = overrides[name];
  const recipes = o !== undefined && o < ball.parents.length ? [o] : ball.parents.map((_, i) => i);
  for (const i of recipes) {
    const childOptions = ball.parents[i].map((p) => expand(cat, p, owned, overrides));
    for (const children of cartesian(childOptions)) {
      out.push({ kind: 'evolve', ball: name, recipe: i, recipeCount: ball.parents.length, children });
    }
  }
  return out;
}

function ownedUses(node: Node, acc: BallName[] = []): BallName[] {
  if (node.kind === 'owned') acc.push(node.ball);
  else if (node.kind === 'evolve' || node.kind === 'fuse') node.children.forEach((c) => ownedUses(c, acc));
  return acc;
}

/** Every contiguous evaluation order: each subtree is finished before its sibling starts. */
function* orders(node: Node): Generator<Node[]> {
  if (node.kind === 'owned') {
    yield [];
    return;
  }
  if (node.kind === 'acquire') {
    yield [node];
    return;
  }
  for (const perm of permutations(node.children)) {
    for (const parts of cartesian(perm.map((c) => [...orders(c)]))) yield [...parts.flat(), node];
  }
}

interface Sim {
  steps: Step[];
  peak: number;
  duplicateConflicts: BallName[];
}

function simulate(order: Node[], startHeld: BallName[], reserved: number): Sim {
  const held: (BallName | null)[] = [...startHeld]; // null: the fused result, which no recipe uses
  let peak = held.length + reserved;
  const steps: Step[] = [];
  const duplicateConflicts: BallName[] = [];
  for (const n of order) {
    if (n.kind === 'acquire') {
      if (held.includes(n.ball)) duplicateConflicts.push(n.ball);
      held.push(n.ball);
      steps.push({ kind: 'acquire', ball: n.ball, held: held.length + reserved });
    } else if (n.kind === 'evolve') {
      const from = n.children.map((c) => c.ball);
      for (const f of from) held.splice(held.indexOf(f), 1);
      held.push(n.ball);
      steps.push({ kind: 'evolve', ball: n.ball, from, held: held.length + reserved });
    } else if (n.kind === 'fuse') {
      const from = [n.children[0].ball, n.children[1].ball] as const;
      for (const f of from) held.splice(held.indexOf(f), 1);
      held.push(null);
      steps.push({ kind: 'fuse', from, held: held.length + reserved });
    }
    peak = Math.max(peak, held.length + reserved);
  }
  return { steps, peak, duplicateConflicts };
}

const MAX_SIMS = 50_000;

export function plan(cat: Catalog, target: Target, opts: PlanOptions): Plan {
  const owned = new Set(usableBalls(opts.owned));
  const reserved = opts.owned.filter((h) => h.kind === 'fused').length;
  const overrides = opts.recipeOverrides ?? {};
  const pinned = opts.pinned ?? [];

  let trees: Node[];
  if (target.kind === 'evolution') {
    trees = expand(cat, target.ball, owned, overrides).filter((t) => t.kind !== 'owned');
  } else {
    const [a, b] = target.balls;
    const problem = fusionProblem(cat, a, b);
    if (problem) throw new Error(`invalid fusion: ${problem}`);
    const left = expand(cat, a, owned, overrides);
    const right = expand(cat, b, owned, overrides);
    trees = [...cartesian([left, right])].map(([l, r]) => ({ kind: 'fuse' as const, children: [l, r] as [BallNode, BallNode] }));
  }

  let best: { plan: Plan; key: number[] } | null = null;
  let sims = 0;
  for (const tree of trees) {
    const uses = ownedUses(tree);
    if (new Set(uses).size !== uses.length) continue; // an owned ball can cover one leaf only
    const need = new Map<BallName, number>();
    const walk = (n: Node) => {
      if (n.kind === 'acquire') need.set(n.ball, (need.get(n.ball) ?? 0) + 1);
      if (n.kind === 'evolve' || n.kind === 'fuse') n.children.forEach(walk);
    };
    walk(tree);
    const needCount = [...need.values()].reduce((s, v) => s + v, 0);
    const pinnedUnused = pinned.filter((p) => !uses.includes(p));

    for (const order of orders(tree)) {
      if (++sims > MAX_SIMS && best) break;
      const sim = simulate(order, uses, reserved);
      const fits = sim.peak <= opts.slots;
      const key = [pinnedUnused.length, needCount, sim.duplicateConflicts.length, fits ? 0 : 1, sim.peak, sim.steps.length];
      if (best && !lexLess(key, best.key)) continue;
      best = {
        key,
        plan: {
          target,
          result: resultOf(target),
          tree,
          steps: sim.steps,
          have: uses,
          need,
          needCount,
          via: sim.steps.flatMap((s) => (s.kind === 'evolve' ? [s.ball] : [])),
          startHeld: uses.length + reserved,
          reserved,
          peak: sim.peak,
          slots: opts.slots,
          fits,
          duplicateConflicts: sim.duplicateConflicts,
          pinnedUnused,
        },
      };
    }
  }
  if (!best) throw new Error(`no plan for ${target.kind === 'evolution' ? target.ball : target.balls.join(' + ')}`);
  return best.plan;
}

function lexLess(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

/** Held + pinned after carrying out a ready plan: its owned balls become the result, in place of the first. */
export function applyPlan(owned: readonly Held[], pinned: readonly BallName[], p: Plan): { held: Held[]; pinned: BallName[] } {
  const left = [...owned];
  let at = left.length;
  for (const h of p.have) {
    const i = left.findIndex((x) => x.kind === 'ball' && x.name === h);
    if (i < 0) continue;
    left.splice(i, 1);
    at = Math.min(at, i);
  }
  if (!left.some((x) => sameHeld(x, p.result))) left.splice(at, 0, p.result); // a ball you already hold just levels up
  return { held: left, pinned: pinned.filter((n) => holdsBall(left, n)) };
}

/** Every ingredient is in hand and the route fits: one click carries it out. */
export const isReady = (p: Plan) => p.needCount === 0 && p.fits && !p.duplicateConflicts.length;
