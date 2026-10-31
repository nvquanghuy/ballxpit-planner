import { describe, expect, it } from 'vitest';
import {
  fused,
  fusionLabel,
  held,
  heldBalls,
  heldLabel,
  holdsBall,
  resultOf,
  sameHeld,
  targetBalls,
  targetLabel,
  tierRank,
  usableBalls,
  type BallName,
} from './domain';

const b = (s: string) => s as BallName;
const A = b('A');
const B = b('B');
const C = b('C');

describe('labels', () => {
  it('a ball is its name, a fusion joins both with ⊕', () => {
    expect(fusionLabel(A, B)).toBe('A ⊕ B');
    expect(heldLabel(held(A))).toBe('A');
    expect(heldLabel(fused(A, B))).toBe('A ⊕ B');
    expect(targetLabel({ kind: 'evolution', ball: A })).toBe('A');
    expect(targetLabel({ kind: 'fusion', balls: [A, B] })).toBe('A ⊕ B');
  });

  it('lists the balls a held ball or target is made of', () => {
    expect(heldBalls(held(A))).toEqual(['A']);
    expect(heldBalls(fused(A, B))).toEqual(['A', 'B']);
    expect(targetBalls({ kind: 'evolution', ball: C })).toEqual(['C']);
    expect(targetBalls({ kind: 'fusion', balls: [A, B] })).toEqual(['A', 'B']);
  });

  it('ranks tiers best first', () => {
    expect(tierRank('S')).toBe(0);
    expect(tierRank('C')).toBe(3);
  });
});

describe('sameHeld', () => {
  it('compares kind and names', () => {
    expect(sameHeld(held(A), held(A))).toBe(true);
    expect(sameHeld(held(A), held(B))).toBe(false);
    expect(sameHeld(fused(A, B), fused(A, B))).toBe(true);
    expect(sameHeld(fused(A, B), fused(A, C))).toBe(false);
    expect(sameHeld(held(A), fused(A, B))).toBe(false);
    // a fused pair is one ball whichever part you name first
    expect(sameHeld(fused(A, B), fused(B, A))).toBe(true);
  });
});

describe('usableBalls / holdsBall', () => {
  const hs = [held(A), fused(B, C)];

  it('only unfused balls are usable', () => {
    expect(usableBalls(hs)).toEqual(['A']);
    expect(usableBalls([])).toEqual([]);
  });

  it('a fused ball does not hold its parts', () => {
    expect(holdsBall(hs, A)).toBe(true);
    expect(holdsBall(hs, B)).toBe(false);
    expect(holdsBall(hs, C)).toBe(false);
  });
});

describe('resultOf', () => {
  it('an evolution gives the ball, a fusion the fused pair', () => {
    expect(resultOf({ kind: 'evolution', ball: A })).toEqual(held(A));
    expect(resultOf({ kind: 'fusion', balls: [A, B] })).toEqual(fused(A, B));
  });
});
