// Recipe planner: given owned balls and a slot count, find the cheapest
// slot-safe way to build a target ball (evolved or fused).
//
// Rules (see README):
// - Owned balls used by the plan are held from step 0; unused owned balls are ignored.
// - Each owned ball covers one recipe leaf only.
// - Missing balls are acquired just-in-time, right before the evolve that consumes them.
// - You can't hold two copies of the same ball at once (picking an owned ball levels it).
// - Balls can be re-acquired after being consumed.

export interface Ball {
  name: string;
  parents?: string[][];
}

export type Target =
  | { kind: 'evolution'; ball: string }
  | { kind: 'fusion'; balls: [string, string] };

export type Node =
  | { kind: 'owned'; ball: string }
  | { kind: 'acquire'; ball: string }
  | { kind: 'evolve'; ball: string; recipe: number; recipeCount: number; children: Node[] }
  | { kind: 'fuse'; ball: string; children: Node[] };

export type Step =
  | { kind: 'acquire'; ball: string; held: number }
  | { kind: 'evolve'; ball: string; from: string[]; held: number }
  | { kind: 'fuse'; ball: string; from: string[]; held: number };

export interface Plan {
  target: string;
  tree: Node;
  steps: Step[];
  /** Owned balls the plan consumes. */
  have: string[];
  /** Balls still to find, with multiplicity. */
  need: Map<string, number>;
  needCount: number;
  /** Intermediate + final evolutions made along the way. */
  via: string[];
  startHeld: number;
  peak: number;
  slots: number;
  fits: boolean;
  /** Steps where you'd have to hold a duplicate ball (not possible in-game). */
  duplicateConflicts: string[];
  pinnedUnused: string[];
}

export interface PlanOptions {
  owned: string[];
  pinned?: string[];
  slots: number;
  /** Force a recipe index for a given evolved ball name. */
  recipeOverrides?: Record<string, number>;
}

export const fusionName = (a: string, b: string) => `${a} ⊕ ${b}`;

export class Catalog {
  readonly byName = new Map<string, Ball>();

  constructor(balls: Ball[]) {
    for (const b of balls) this.byName.set(b.name, b);
  }

  get(name: string): Ball {
    const b = this.byName.get(name);
    if (!b) throw new Error(`unknown ball "${name}"`);
    return b;
  }

  isBase(name: string) {
    return !this.get(name).parents?.length;
  }

  /** Why two balls can't be fused, or null if they can. */
  fusionProblem(a: string, b: string): string | null {
    this.get(a);
    this.get(b);
    if (a === b) return 'a ball cannot be fused with itself';
    for (const ball of this.byName.values()) {
      for (const r of ball.parents ?? []) {
        if (r.length === 2 && r.includes(a) && r.includes(b)) return `${a} + ${b} must evolve into ${ball.name}`;
      }
    }
    return null;
  }
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
function expand(cat: Catalog, name: string, owned: Set<string>, overrides: Record<string, number>): Node[] {
  const out: Node[] = [];
  if (owned.has(name)) out.push({ kind: 'owned', ball: name });
  const ball = cat.get(name);
  if (!ball.parents?.length) {
    out.push({ kind: 'acquire', ball: name });
    return out;
  }
  const recipes = name in overrides ? [overrides[name]] : ball.parents.map((_, i) => i);
  for (const i of recipes) {
    const childOptions = ball.parents[i].map((p) => expand(cat, p, owned, overrides));
    for (const children of cartesian(childOptions)) {
      out.push({ kind: 'evolve', ball: name, recipe: i, recipeCount: ball.parents.length, children });
    }
  }
  return out;
}

function ownedUses(node: Node, acc: string[] = []): string[] {
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
  duplicateConflicts: string[];
}

function simulate(order: Node[], startHeld: string[]): Sim {
  const held = [...startHeld];
  let peak = held.length;
  const steps: Step[] = [];
  const duplicateConflicts: string[] = [];
  for (const n of order) {
    if (n.kind === 'acquire') {
      if (held.includes(n.ball)) duplicateConflicts.push(n.ball);
      held.push(n.ball);
      steps.push({ kind: 'acquire', ball: n.ball, held: held.length });
    } else if (n.kind === 'evolve' || n.kind === 'fuse') {
      const from = n.children.map((c) => c.ball);
      for (const f of from) held.splice(held.indexOf(f), 1);
      held.push(n.ball);
      steps.push({ kind: n.kind, ball: n.ball, from, held: held.length });
    }
    peak = Math.max(peak, held.length);
  }
  return { steps, peak, duplicateConflicts };
}

const MAX_SIMS = 50_000;

export function plan(cat: Catalog, target: Target, opts: PlanOptions): Plan {
  const owned = new Set(opts.owned);
  const overrides = opts.recipeOverrides ?? {};
  const pinned = opts.pinned ?? [];

  let trees: Node[];
  let targetName: string;
  if (target.kind === 'evolution') {
    targetName = target.ball;
    trees = expand(cat, target.ball, owned, overrides).filter((t) => t.kind !== 'owned');
  } else {
    const [a, b] = target.balls;
    const problem = cat.fusionProblem(a, b);
    if (problem) throw new Error(`invalid fusion: ${problem}`);
    targetName = fusionName(a, b);
    const left = expand(cat, a, owned, overrides);
    const right = expand(cat, b, owned, overrides);
    trees = [...cartesian([left, right])].map((children) => ({ kind: 'fuse' as const, ball: targetName, children }));
  }

  let best: { plan: Plan; key: number[] } | null = null;
  let sims = 0;
  for (const tree of trees) {
    const uses = ownedUses(tree);
    if (new Set(uses).size !== uses.length) continue; // an owned ball can cover one leaf only
    const need = new Map<string, number>();
    const walk = (n: Node) => {
      if (n.kind === 'acquire') need.set(n.ball, (need.get(n.ball) ?? 0) + 1);
      if (n.kind === 'evolve' || n.kind === 'fuse') n.children.forEach(walk);
    };
    walk(tree);
    const needCount = [...need.values()].reduce((s, v) => s + v, 0);
    const pinnedUnused = pinned.filter((p) => !uses.includes(p));

    for (const order of orders(tree)) {
      if (++sims > MAX_SIMS && best) break;
      const sim = simulate(order, uses);
      const fits = sim.peak <= opts.slots;
      const key = [pinnedUnused.length, needCount, sim.duplicateConflicts.length, fits ? 0 : 1, sim.peak, sim.steps.length];
      if (best && !lexLess(key, best.key)) continue;
      best = {
        key,
        plan: {
          target: targetName,
          tree,
          steps: sim.steps,
          have: uses,
          need,
          needCount,
          via: sim.steps.filter((s) => s.kind === 'evolve').map((s) => s.ball),
          startHeld: uses.length,
          peak: sim.peak,
          slots: opts.slots,
          fits,
          duplicateConflicts: sim.duplicateConflicts,
          pinnedUnused,
        },
      };
    }
  }
  if (!best) throw new Error(`no plan for ${targetName}`);
  return best.plan;
}

function lexLess(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i];
  return false;
}

export const targetLabel = (t: Target) => (t.kind === 'evolution' ? t.ball : fusionName(t.balls[0], t.balls[1]));
