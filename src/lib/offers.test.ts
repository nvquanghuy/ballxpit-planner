import { describe, expect, it } from 'vitest';
import balls from '../data/balls.json';
import targetsFile from '../../data/targets.json';
import { Catalog } from './planner';
import { adviseOffers } from './offers';
import type { TargetEntry } from './targets';

const cat = new Catalog(balls);
const fake: TargetEntry[] = [
  { id: 'nb', kind: 'evolution', ball: 'Nuclear Bomb', tier: 'S', why: '', sources: [] },
  { id: 'sun', kind: 'evolution', ball: 'Sun', tier: 'B', why: '', sources: [] },
  { id: 'magma', kind: 'evolution', ball: 'Magma', tier: 'A', why: '', sources: [] },
];

describe('adviseOffers', () => {
  it('ranks the offer that finishes the best target first', () => {
    // Burn + Iron owned: Poison finishes Nuclear Bomb (S), Light finishes Sun (B).
    const a = adviseOffers(cat, fake, { owned: ['Burn', 'Iron'], pinned: [], slots: 4, offers: ['Light', 'Poison', 'Ghost'] });
    expect(a.ranked.map((r) => r.ball)).toEqual(['Poison', 'Light', 'Ghost']);
    expect(a.ranked[0].effects.map((e) => [e.entry.id, e.before, e.after])).toEqual([['nb', 1, 0]]);
    expect(a.ranked[2].effects).toEqual([]);
    expect(a.ranked[2].reason).toBe('moves no target forward');
  });

  it('lists directions by tier with the offer that helps', () => {
    const a = adviseOffers(cat, fake, { owned: ['Burn', 'Iron'], pinned: [], slots: 4, offers: ['Light', 'Poison', 'Earthquake'] });
    expect(a.directions.map((d) => [d.entry.id, d.picks.map((p) => p.ball)])).toEqual([
      ['nb', ['Poison']],
      ['magma', ['Earthquake']],
      ['sun', ['Light']],
    ]);
  });

  it('respects pins', () => {
    const a = adviseOffers(cat, fake, { owned: ['Burn', 'Iron'], pinned: ['Iron'], slots: 4, offers: ['Light', 'Poison'] });
    expect(a.directions.map((d) => d.entry.id)).toEqual(['nb']);
    expect(a.ranked[1].effects).toEqual([]);
  });

  it('flags offers when slots are full and ignores offers you already own', () => {
    const a = adviseOffers(cat, fake, { owned: ['Burn', 'Iron'], pinned: [], slots: 2, offers: ['Poison', 'Burn'] });
    expect(a.ranked.map((r) => [r.ball, r.needsRoom])).toEqual([['Poison', true]]);
  });

  it('runs fast enough on the real target list', () => {
    const t = performance.now();
    adviseOffers(cat, targetsFile.targets as TargetEntry[], {
      owned: ['Burn', 'Iron', 'Light'],
      pinned: [],
      slots: 4,
      offers: ['Poison', 'Dark', 'Lightning', 'Cell'],
    });
    expect(performance.now() - t).toBeLessThan(1500);
  });
});
