import { describe, expect, it } from 'vitest';
import balls from '../data/balls.json';
import { asBall, fusionProblem, isBase } from './catalog';
import { fused, held, heldLabel, type Held, type Target } from './domain';
import { parseBalls, parseHeld } from './parse';
import { applyPlan, isReady, plan } from './planner';

const cat = parseBalls(balls);
const n = (s: string) => {
  const b = asBall(cat, s);
  if (!b) throw new Error(s);
  return b;
};
const evo = (ball: string): Target => ({ kind: 'evolution', ball: n(ball) });
const fuse = (a: string, b: string): Target => ({ kind: 'fusion', balls: [n(a), n(b)] });
const hs = (...names: string[]): Held[] => names.map((s) => held(n(s)));
const needObj = (p: ReturnType<typeof plan>) => Object.fromEntries(p.need);

describe('plan', () => {
  it('Nuclear Bomb from Burn + Iron: needs Poison, peak 2', () => {
    const p = plan(cat, evo('Nuclear Bomb'), { owned: hs('Burn', 'Iron'), slots: 4 });
    expect(needObj(p)).toEqual({ Poison: 1 });
    expect(p.peak).toBe(2);
    expect(p.via).toEqual(['Bomb', 'Nuclear Bomb']);
    expect(p.steps.map((s) => s.kind)).toEqual(['evolve', 'acquire', 'evolve']);
    expect(p.target).toEqual(evo('Nuclear Bomb'));
    expect(p.result).toEqual(held(n('Nuclear Bomb')));
  });

  it('Nosferatu from nothing: peak 4', () => {
    const p = plan(cat, evo('Nosferatu'), { owned: [], slots: 4 });
    expect(p.peak).toBe(4);
    expect(p.fits).toBe(true);
    expect(p.needCount).toBe(6);
    expect(p.need.get(n('Vampire'))).toBe(2);
    expect(p.need.get(n('Brood Mother'))).toBe(2);
    expect(p.duplicateConflicts).toEqual([]);
  });

  it('Elemental needs all four at once', () => {
    const p = plan(cat, evo('Elemental'), { owned: [], slots: 4 });
    expect(p.peak).toBe(4);
    expect(plan(cat, evo('Elemental'), { owned: [], slots: 3 }).fits).toBe(false);
  });

  it('Black Hole ⊕ Satan from nothing: peak 3 by building Satan first', () => {
    const p = plan(cat, fuse('Black Hole', 'Satan'), { owned: [], slots: 4 });
    expect(p.peak).toBe(3);
    expect(p.via.indexOf(n('Satan'))).toBeLessThan(p.via.indexOf(n('Sun')));
    expect(p.need.get(n('Charm'))).toBe(2);
    expect(p.steps.at(-1)).toEqual({ kind: 'fuse', from: ['Black Hole', 'Satan'], held: 1 });
    expect(p.tree.kind).toBe('fuse');
    expect(p.result).toEqual(fused(n('Black Hole'), n('Satan')));
    expect(heldLabel(p.result)).toBe('Black Hole ⊕ Satan');
  });

  it('owned balls are held from the start: Black Hole ⊕ Satan with Burn + Charm peaks at 4', () => {
    const p = plan(cat, fuse('Black Hole', 'Satan'), { owned: hs('Burn', 'Charm'), slots: 4 });
    expect(p.peak).toBe(4);
    expect([...p.have].sort()).toEqual(['Burn', 'Charm']);
    expect(p.need.get(n('Charm'))).toBe(1); // one owned Charm covers only one leaf
  });

  it('prefers the recipe that reuses owned balls', () => {
    const p = plan(cat, evo('Virus'), { owned: hs('Ghost'), slots: 4 });
    expect(p.have).toEqual(['Ghost']);
    expect(needObj(p)).toEqual({ Poison: 1 });
  });

  it('respects recipe overrides', () => {
    const p = plan(cat, evo('Virus'), { owned: hs('Ghost'), slots: 4, recipeOverrides: { [n('Virus')]: 0 } });
    expect(needObj(p)).toEqual({ Bleed: 1, Poison: 1 });
  });

  it('uses an owned intermediate evolution directly', () => {
    const p = plan(cat, evo('Nuclear Bomb'), { owned: hs('Bomb'), slots: 4 });
    expect(needObj(p)).toEqual({ Poison: 1 });
    expect(p.via).toEqual(['Nuclear Bomb']);
  });

  it('reports pinned balls the target cannot use', () => {
    const p = plan(cat, evo('Nuclear Bomb'), { owned: hs('Burn', 'Wind'), pinned: [n('Wind')], slots: 4 });
    expect(p.pinnedUnused).toEqual(['Wind']);
  });

  it('rejects fusing a pair that has an evolution recipe', () => {
    expect(fusionProblem(cat, n('Sun'), n('Dark'))).toMatch(/Black Hole/);
    expect(fusionProblem(cat, n('Sun'), n('Sun'))).toMatch(/itself/);
    expect(fusionProblem(cat, n('Black Hole'), n('Satan'))).toBeNull();
    expect(() => plan(cat, fuse('Sun', 'Dark'), { owned: [], slots: 4 })).toThrow(/invalid fusion/);
  });

  it('plans every evolved ball without blowing up', () => {
    const evolved = cat.balls.filter((b) => !isBase(cat, b.name));
    expect(evolved.length).toBe(balls.filter((b) => 'parents' in b && b.parents?.length).length);
    expect(evolved.length).toBeGreaterThan(0);
    for (const b of evolved) {
      const p = plan(cat, { kind: 'evolution', ball: b.name }, { owned: hs('Burn', 'Charm', 'Iron', 'Light'), slots: 4 });
      expect(p.steps.at(-1)).toMatchObject({ kind: 'evolve', ball: b.name });
    }
  });
});

describe('fused balls in owned', () => {
  const HS = fused(n('Hemorrhage'), n('Sun'));

  it('parses fused names', () => {
    expect(parseHeld(cat, 'Hemorrhage ⊕ Sun')).toEqual(HS);
    expect(parseHeld(cat, 'Burn')).toEqual(held(n('Burn')));
    expect(parseHeld(cat, 'Sun ⊕ Dark')).toBeNull(); // that pair evolves into Black Hole
    expect(parseHeld(cat, 'Sun ⊕ Sun')).toBeNull();
    expect(parseHeld(cat, 'Nope ⊕ Sun')).toBeNull();
    expect(HS.kind === 'fused' && HS.parts).toEqual(['Hemorrhage', 'Sun']);
  });

  it('are never ingredients but take a slot', () => {
    const base = plan(cat, evo('Nuclear Bomb'), { owned: hs('Burn', 'Iron'), slots: 4 });
    const p = plan(cat, evo('Nuclear Bomb'), { owned: [...hs('Burn', 'Iron'), HS], slots: 4 });
    expect([...p.have].sort()).toEqual(['Burn', 'Iron']);
    expect(p.reserved).toBe(1);
    expect(p.startHeld).toBe(3);
    expect(p.peak).toBe(base.peak + 1);
    expect(p.steps.map((s) => s.held)).toEqual(base.steps.map((s) => s.held + 1));
  });

  it('a fused ball does not count as owning its parts', () => {
    const p = plan(cat, evo('Sun'), { owned: [HS], slots: 4 });
    expect(p.have).toEqual([]);
    expect(needObj(p)).toEqual({ Burn: 1, Light: 1 });
  });

  it('a plan that fit exactly no longer fits next to a fused ball', () => {
    expect(plan(cat, evo('Elemental'), { owned: [], slots: 4 }).fits).toBe(true);
    expect(plan(cat, evo('Elemental'), { owned: [HS], slots: 4 }).fits).toBe(false);
  });
});

describe('applyPlan', () => {
  it('evolves owned balls into the result', () => {
    const p = plan(cat, evo('Nuclear Bomb'), { owned: hs('Burn', 'Iron', 'Poison'), slots: 4 });
    expect(isReady(p)).toBe(true);
    expect(applyPlan(hs('Burn', 'Iron', 'Poison'), [n('Iron')], p)).toEqual({ held: hs('Nuclear Bomb'), pinned: [] });
  });

  it('keeps unrelated balls and pins, putting the result where the first ingredient was', () => {
    const owned = hs('Wind', 'Burn', 'Iron', 'Poison');
    const p = plan(cat, evo('Nuclear Bomb'), { owned, slots: 4 });
    expect(applyPlan(owned, [n('Wind'), n('Burn')], p)).toEqual({ held: hs('Wind', 'Nuclear Bomb'), pinned: ['Wind'] });
  });

  it('fuses two owned balls into a fused entry', () => {
    const p = plan(cat, fuse('Hemorrhage', 'Sun'), { owned: hs('Sun', 'Hemorrhage'), slots: 4 });
    expect(isReady(p)).toBe(true);
    expect(applyPlan(hs('Sun', 'Hemorrhage'), [], p).held).toEqual([fused(n('Hemorrhage'), n('Sun'))]);
  });

  it('keeps fused balls you already hold', () => {
    const HS = fused(n('Hemorrhage'), n('Sun'));
    const owned = [HS, ...hs('Burn', 'Iron', 'Poison')];
    const p = plan(cat, evo('Nuclear Bomb'), { owned, slots: 4 });
    expect(isReady(p)).toBe(true);
    expect(applyPlan(owned, [], p).held).toEqual([HS, held(n('Nuclear Bomb'))]);
  });

  it('does not duplicate a result you already hold', () => {
    const owned = hs('Nuclear Bomb', 'Burn', 'Iron', 'Poison');
    const p = plan(cat, evo('Nuclear Bomb'), { owned, slots: 4 });
    expect(applyPlan(owned, [], p).held).toEqual(hs('Nuclear Bomb'));
  });

  it('is not ready while something is missing', () => {
    expect(isReady(plan(cat, evo('Nuclear Bomb'), { owned: hs('Burn', 'Iron'), slots: 4 }))).toBe(false);
  });

  it('is not ready when it does not fit', () => {
    const p = plan(cat, evo('Nuclear Bomb'), { owned: hs('Burn', 'Iron', 'Poison'), slots: 2 });
    expect(p.needCount).toBe(0);
    expect(isReady(p)).toBe(false);
  });
});
