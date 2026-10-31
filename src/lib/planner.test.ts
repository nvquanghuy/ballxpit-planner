import { describe, expect, it } from 'vitest';
import balls from '../data/balls.json';
import { Catalog, plan, type Target } from './planner';

const cat = new Catalog(balls);
const evo = (ball: string): Target => ({ kind: 'evolution', ball });
const fuse = (a: string, b: string): Target => ({ kind: 'fusion', balls: [a, b] });
const needObj = (p: ReturnType<typeof plan>) => Object.fromEntries(p.need);

describe('plan', () => {
  it('Nuclear Bomb from Burn + Iron: needs Poison, peak 2', () => {
    const p = plan(cat, evo('Nuclear Bomb'), { owned: ['Burn', 'Iron'], slots: 4 });
    expect(needObj(p)).toEqual({ Poison: 1 });
    expect(p.peak).toBe(2);
    expect(p.via).toEqual(['Bomb', 'Nuclear Bomb']);
    expect(p.steps.map((s) => s.kind)).toEqual(['evolve', 'acquire', 'evolve']);
  });

  it('Nosferatu from nothing: peak 4', () => {
    const p = plan(cat, evo('Nosferatu'), { owned: [], slots: 4 });
    expect(p.peak).toBe(4);
    expect(p.fits).toBe(true);
    expect(p.needCount).toBe(6);
    expect(p.need.get('Vampire')).toBe(2);
    expect(p.need.get('Brood Mother')).toBe(2);
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
    expect(p.via.indexOf('Satan')).toBeLessThan(p.via.indexOf('Sun'));
    expect(p.need.get('Charm')).toBe(2);
    expect(p.steps.at(-1)).toMatchObject({ kind: 'fuse', held: 1 });
  });

  it('owned balls are held from the start: Black Hole ⊕ Satan with Burn + Charm peaks at 4', () => {
    const p = plan(cat, fuse('Black Hole', 'Satan'), { owned: ['Burn', 'Charm'], slots: 4 });
    expect(p.peak).toBe(4);
    expect(p.have.sort()).toEqual(['Burn', 'Charm']);
    expect(p.need.get('Charm')).toBe(1); // one owned Charm covers only one leaf
  });

  it('prefers the recipe that reuses owned balls', () => {
    const p = plan(cat, evo('Virus'), { owned: ['Ghost'], slots: 4 });
    expect(p.have).toEqual(['Ghost']);
    expect(needObj(p)).toEqual({ Poison: 1 });
  });

  it('respects recipe overrides', () => {
    const p = plan(cat, evo('Virus'), { owned: ['Ghost'], slots: 4, recipeOverrides: { Virus: 0 } });
    expect(needObj(p)).toEqual({ Bleed: 1, Poison: 1 });
  });

  it('uses an owned intermediate evolution directly', () => {
    const p = plan(cat, evo('Nuclear Bomb'), { owned: ['Bomb'], slots: 4 });
    expect(needObj(p)).toEqual({ Poison: 1 });
    expect(p.via).toEqual(['Nuclear Bomb']);
  });

  it('reports pinned balls the target cannot use', () => {
    const p = plan(cat, evo('Nuclear Bomb'), { owned: ['Burn', 'Wind'], pinned: ['Wind'], slots: 4 });
    expect(p.pinnedUnused).toEqual(['Wind']);
  });

  it('rejects fusing a pair that has an evolution recipe', () => {
    expect(cat.fusionProblem('Sun', 'Dark')).toMatch(/Black Hole/);
    expect(cat.fusionProblem('Sun', 'Sun')).toMatch(/itself/);
    expect(cat.fusionProblem('Black Hole', 'Satan')).toBeNull();
    expect(() => plan(cat, fuse('Sun', 'Dark'), { owned: [], slots: 4 })).toThrow(/invalid fusion/);
  });

  it('plans every evolved ball without blowing up', () => {
    for (const b of balls.filter((b) => b.parents)) {
      const p = plan(cat, evo(b.name), { owned: ['Burn', 'Charm', 'Iron', 'Light'], slots: 4 });
      expect(p.steps.at(-1)?.ball).toBe(b.name);
    }
  });
});
