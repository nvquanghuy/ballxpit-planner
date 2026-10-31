// Domain types. A BallName or TargetId only comes out of a parser (parse.ts, run.ts),
// so code that takes one never has to check it again.

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type BallName = Brand<string, 'BallName'>;
export type TargetId = Brand<string, 'TargetId'>;

export type Tier = 'S' | 'A' | 'B' | 'C';
export const TIERS: readonly Tier[] = ['S', 'A', 'B', 'C'];
/** 0 for S: sort ascending for best first. */
export const tierRank = (t: Tier) => TIERS.indexOf(t);

export interface Ball {
  name: BallName;
  slug: string;
  description: string;
  img: string;
  unlockRequirement?: string;
  damageType: string[];
  statusEffect: string[];
  /** Ways to evolve this ball; empty for a base ball. */
  parents: BallName[][];
}

export type Pair = readonly [BallName, BallName];

export type Target = { kind: 'evolution'; ball: BallName } | { kind: 'fusion'; balls: Pair };

export type TargetEntry = Target & {
  id: TargetId;
  tier: Tier;
  why: string;
  /** Fusions: what the fused ball does in play and why it's strong. */
  effect?: string;
  sources: string[];
  unverified?: boolean;
};
export type FusionEntry = Extract<TargetEntry, { kind: 'fusion' }>;

/** A ball in one of your slots. A fused ball can't be evolved or fused again, but takes a slot. */
export type Held = { kind: 'ball'; name: BallName } | { kind: 'fused'; parts: Pair };

export const held = (name: BallName): Held => ({ kind: 'ball', name });
export const fused = (a: BallName, b: BallName): Held => ({ kind: 'fused', parts: [a, b] });

export const fusionLabel = (a: BallName, b: BallName) => `${a} ⊕ ${b}`;
export const heldLabel = (h: Held) => (h.kind === 'ball' ? h.name : fusionLabel(...h.parts));
export const targetLabel = (t: Target) => (t.kind === 'evolution' ? t.ball : fusionLabel(...t.balls));
/** The ball names a held ball or target is made of, for icons and popovers. */
export const heldBalls = (h: Held): BallName[] => (h.kind === 'ball' ? [h.name] : [...h.parts]);
export const targetBalls = (t: Target): BallName[] => (t.kind === 'evolution' ? [t.ball] : [...t.balls]);

/** Identity of a held ball: a fused pair is the same ball in either order. */
export const heldKey = (h: Held) => (h.kind === 'ball' ? h.name : [...h.parts].sort().join(' ⊕ '));
export const sameHeld = (a: Held, b: Held) => heldKey(a) === heldKey(b);
/** Unfused balls you hold: the only ones a recipe can use. */
export const usableBalls = (hs: readonly Held[]): BallName[] => hs.flatMap((h) => (h.kind === 'ball' ? [h.name] : []));
export const holdsBall = (hs: readonly Held[], name: BallName) => hs.some((h) => h.kind === 'ball' && h.name === name);

/** What a target becomes once made. */
export const resultOf = (t: Target): Held => (t.kind === 'evolution' ? held(t.ball) : fused(...t.balls));
