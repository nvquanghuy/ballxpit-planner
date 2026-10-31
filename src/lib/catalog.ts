// The ball catalogue: every ball by name, and which pairs evolve instead of fusing.
import type { Ball, BallName } from './domain';

export interface Catalog {
  balls: readonly Ball[];
  byName: ReadonlyMap<string, Ball>;
  /** Two-ball recipes, keyed by pairKey: those pairs evolve into the value and can't be fused. */
  evolvesInto: ReadonlyMap<string, BallName>;
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Build from balls whose names and recipes are already known-good (see parseBalls). */
export function makeCatalog(balls: readonly Ball[]): Catalog {
  const evolvesInto = new Map<string, BallName>();
  for (const b of balls) for (const r of b.parents) if (r.length === 2) evolvesInto.set(pairKey(r[0], r[1]), b.name);
  return { balls, byName: new Map(balls.map((b) => [b.name, b])), evolvesInto };
}

/** The name, if it's a ball in the catalogue. */
export const asBall = (cat: Catalog, s: string): BallName | null => cat.byName.get(s)?.name ?? null;

export const getBall = (cat: Catalog, name: BallName): Ball => cat.byName.get(name)!;
export const isBase = (cat: Catalog, name: BallName) => !getBall(cat, name).parents.length;

/** Why two balls can't be fused, or null if they can. */
export function fusionProblem(cat: Catalog, a: BallName, b: BallName): string | null {
  if (a === b) return 'a ball cannot be fused with itself';
  const into = cat.evolvesInto.get(pairKey(a, b));
  return into ? `${a} + ${b} must evolve into ${into}` : null;
}
