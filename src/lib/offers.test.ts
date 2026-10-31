import { describe, expect, it } from 'vitest';
import balls from '../data/balls.json';
import targetsFile from '../../data/targets.json';
import { asBall } from './catalog';
import { fused, held, type Held } from './domain';
import { adviseOffers } from './offers';
import { parseBalls, parseTargets } from './parse';

const cat = parseBalls(balls);
const n = (s: string) => {
  const b = asBall(cat, s);
  if (!b) throw new Error(s);
  return b;
};
const hs = (...names: string[]): Held[] => names.map((s) => held(n(s)));
const ns = (...names: string[]) => names.map(n);
const HS = fused(n('Hemorrhage'), n('Sun'));
const fake = parseTargets(
  [
    { id: 'nb', kind: 'evolution', ball: 'Nuclear Bomb', tier: 'S', why: '' },
    { id: 'sun', kind: 'evolution', ball: 'Sun', tier: 'B', why: '' },
    { id: 'magma', kind: 'evolution', ball: 'Magma', tier: 'A', why: '' },
  ],
  cat,
);

describe('adviseOffers', () => {
  it('fused balls take a slot but count as nothing owned', () => {
    const a = adviseOffers(cat, fake, { owned: [HS, ...hs('Burn', 'Iron', 'Wind')], pinned: [], slots: 4, offers: ns('Poison') });
    expect(a.ranked[0].needsRoom).toBe(true);
    const only = adviseOffers(cat, fake, { owned: [HS], pinned: [], slots: 4, offers: ns('Burn') });
    expect(only.ranked[0].effects.length).toBeGreaterThan(0);
    expect(only.ranked[0].effects.every((e) => !e.opens)).toBe(true);
  });

  it('ranks the offer that finishes the best target first', () => {
    // Burn + Iron owned: Poison finishes Nuclear Bomb (S), Light finishes Sun (B).
    const a = adviseOffers(cat, fake, { owned: hs('Burn', 'Iron'), pinned: [], slots: 4, offers: ns('Light', 'Poison', 'Ghost') });
    expect(a.ranked.map((r) => r.ball)).toEqual(['Poison', 'Light', 'Ghost']);
    expect(a.ranked[0].effects.map((e) => [e.entry.id, e.before, e.after])).toEqual([['nb', 1, 0]]);
    expect(a.ranked[0].reason).toBe('finishes Nuclear Bomb (S)');
    expect(a.ranked[2].effects).toEqual([]);
    expect(a.ranked[2].reason).toBe('moves no target forward');
  });

  it('lists directions by tier with the offer that helps', () => {
    const a = adviseOffers(cat, fake, { owned: hs('Burn', 'Iron'), pinned: [], slots: 4, offers: ns('Light', 'Poison', 'Earthquake') });
    expect(a.directions.map((d) => [d.entry.id, d.picks.map((p) => p.ball)])).toEqual([
      ['nb', ['Poison']],
      ['magma', ['Earthquake']],
      ['sun', ['Light']],
    ]);
  });

  it('respects pins', () => {
    const a = adviseOffers(cat, fake, { owned: hs('Burn', 'Iron'), pinned: ns('Iron'), slots: 4, offers: ns('Light', 'Poison') });
    expect(a.directions.map((d) => d.entry.id)).toEqual(['nb']);
    expect(a.ranked[1].effects).toEqual([]);
  });

  it('flags offers when slots are full and ignores offers you already own', () => {
    const a = adviseOffers(cat, fake, { owned: hs('Burn', 'Iron'), pinned: [], slots: 2, offers: ns('Poison', 'Burn') });
    expect(a.ranked.map((r) => [r.ball, r.needsRoom])).toEqual([['Poison', true]]);
  });

  it('runs fast enough on the real target list', () => {
    const t = performance.now();
    adviseOffers(cat, parseTargets(targetsFile.targets, cat), {
      owned: hs('Burn', 'Iron', 'Light'),
      pinned: [],
      slots: 4,
      offers: ns('Poison', 'Dark', 'Lightning', 'Cell'),
    });
    expect(performance.now() - t).toBeLessThan(1500);
  });
});
