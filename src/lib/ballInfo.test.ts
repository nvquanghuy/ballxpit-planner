import { describe, expect, it } from 'vitest';
import balls from '../data/balls.json';
import { evolvesInto, fusionFor, fusionsOf, leadsTo } from './ballInfo';
import { asBall, makeCatalog } from './catalog';
import type { Ball, BallName, TargetEntry, TargetId, Tier } from './domain';
import { parseBalls } from './parse';

const cat = parseBalls(balls);
const n = (s: string) => {
  const x = asBall(cat, s);
  if (!x) throw new Error(s);
  return x;
};
// Fake balls and targets: names here are made up, so they're cast rather than parsed.
const b = (s: string) => s as BallName;
const mk = (name: string, parents: string[][] = []): Ball => ({
  name: b(name),
  slug: name,
  description: '',
  img: '',
  damageType: [],
  statusEffect: [],
  parents: parents.map((r) => r.map(b)),
});
const evoT = (ball: string, tier: Tier, extra: Partial<TargetEntry> = {}): TargetEntry =>
  ({ id: ball as TargetId, kind: 'evolution', ball: b(ball), tier, why: '', sources: [], ...extra }) as TargetEntry;
const fuseT = (x: string, y: string, tier: Tier, extra: { why?: string; effect?: string } = {}): TargetEntry => ({
  id: `${x}+${y}` as TargetId,
  kind: 'fusion',
  balls: [b(x), b(y)],
  tier,
  why: '',
  sources: [],
  ...extra,
});

describe('evolvesInto', () => {
  it('Bomb makes Nuclear Bomb with Poison and Time Bomb with Time', () => {
    const uses = evolvesInto(cat, n('Bomb'));
    expect(uses).toContainEqual({ with: ['Poison'], result: 'Nuclear Bomb' });
    expect(uses).toContainEqual({ with: ['Time'], result: 'Time Bomb' });
  });

  it('Burn feeds Bomb with Iron', () => {
    expect(evolvesInto(cat, n('Burn'))).toContainEqual({ with: ['Iron'], result: 'Bomb' });
  });

  it('removes only one copy of a repeated ingredient', () => {
    const c = makeCatalog([mk('A'), mk('B'), mk('X', [['A', 'A', 'B']])]);
    expect(evolvesInto(c, b('A'))).toEqual([{ with: ['A', 'B'], result: 'X' }]);
  });

  it('terminal balls evolve into nothing', () => {
    expect(evolvesInto(cat, n('Nuclear Bomb'))).toEqual([]);
  });
});

const recipes = makeCatalog([
  mk('A'),
  mk('B'),
  mk('C'),
  mk('AB', [['A', 'B']]),
  mk('ABC', [['AB', 'C']]),
  mk('Top', [['ABC', 'B']]),
]);

describe('fusionsOf', () => {
  const targets = [fuseT('X', 'A', 'B'), evoT('AB', 'S'), fuseT('A', 'Y', 'S', { why: 'good', effect: 'zap' }), fuseT('P', 'Q', 'S')];

  it('lists partners from either side, best tier first', () => {
    expect(fusionsOf(targets, b('A'))).toEqual([
      { partner: 'Y', tier: 'S', why: 'good', effect: 'zap' },
      { partner: 'X', tier: 'B', why: '', effect: undefined },
    ]);
  });

  it('is empty for a ball in no fusion target', () => {
    expect(fusionsOf(targets, b('AB'))).toEqual([]);
  });
});

describe('leadsTo', () => {
  const targets = [evoT('AB', 'S'), evoT('ABC', 'B'), evoT('Top', 'A'), fuseT('A', 'C', 'S')];

  it('skips direct evolutions and lists deeper targets with their path', () => {
    expect(leadsTo(recipes, targets, b('A'))).toEqual([
      { result: 'Top', tier: 'A', via: ['AB', 'ABC'] },
      { result: 'ABC', tier: 'B', via: ['AB'] },
    ]);
  });

  it('uses the shortest path', () => {
    // B feeds AB and Top directly, so Top is a direct evolution of B.
    expect(leadsTo(recipes, targets, b('B'))).toEqual([{ result: 'ABC', tier: 'B', via: ['AB'] }]);
  });

  it('works from an evolved ball and is empty at the end of the line', () => {
    expect(leadsTo(recipes, targets, b('AB'))).toEqual([{ result: 'Top', tier: 'A', via: ['ABC'] }]);
    expect(leadsTo(recipes, targets, b('Top'))).toEqual([]);
  });

  it('follows the real Burn → Bomb → Nuclear Bomb chain', () => {
    expect(leadsTo(cat, [evoT('Nuclear Bomb', 'S')], n('Burn'))).toContainEqual({ result: 'Nuclear Bomb', tier: 'S', via: ['Bomb'] });
  });
});

describe('fusionFor', () => {
  const targets = [evoT('A', 'S'), fuseT('A', 'B', 'S', { effect: 'boom' })];

  it('matches a fusion target in either order', () => {
    expect(fusionFor(targets, [b('A'), b('B')])?.effect).toBe('boom');
    expect(fusionFor(targets, [b('B'), b('A')])?.effect).toBe('boom');
  });

  it('ignores single balls and uncurated pairs', () => {
    expect(fusionFor(targets, [b('A')])).toBeUndefined();
    expect(fusionFor(targets, [b('A'), b('C')])).toBeUndefined();
  });
});
