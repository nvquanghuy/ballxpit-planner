import { describe, expect, it } from 'vitest';
import balls from '../data/balls.json';
import { evolvesInto, fusionFor, fusionsOf, leadsTo } from './ballInfo';

describe('evolvesInto', () => {
  it('Bomb makes Nuclear Bomb with Poison and Time Bomb with Time', () => {
    const uses = evolvesInto(balls, 'Bomb');
    expect(uses).toContainEqual({ with: ['Poison'], result: 'Nuclear Bomb' });
    expect(uses).toContainEqual({ with: ['Time'], result: 'Time Bomb' });
  });

  it('Burn feeds Bomb with Iron', () => {
    expect(evolvesInto(balls, 'Burn')).toContainEqual({ with: ['Iron'], result: 'Bomb' });
  });

  it('removes only one copy of a repeated ingredient', () => {
    const recipes = [{ name: 'X', parents: [['A', 'A', 'B']] }];
    expect(evolvesInto(recipes, 'A')).toEqual([{ with: ['A', 'B'], result: 'X' }]);
  });

  it('terminal balls evolve into nothing', () => {
    expect(evolvesInto(balls, 'Nuclear Bomb')).toEqual([]);
  });
});

const recipes = [
  { name: 'A' },
  { name: 'B' },
  { name: 'C' },
  { name: 'AB', parents: [['A', 'B']] },
  { name: 'ABC', parents: [['AB', 'C']] },
  { name: 'Top', parents: [['ABC', 'B']] },
];

describe('fusionsOf', () => {
  const targets = [
    { kind: 'fusion', balls: ['X', 'A'], tier: 'B' },
    { kind: 'evolution', ball: 'AB', tier: 'S' },
    { kind: 'fusion', balls: ['A', 'Y'], tier: 'S', why: 'good' },
    { kind: 'fusion', balls: ['P', 'Q'], tier: 'S' },
  ];

  it('lists partners from either side, best tier first', () => {
    expect(fusionsOf(targets, 'A')).toEqual([
      { partner: 'Y', tier: 'S', why: 'good' },
      { partner: 'X', tier: 'B', why: undefined },
    ]);
  });

  it('is empty for a ball in no fusion target', () => {
    expect(fusionsOf(targets, 'AB')).toEqual([]);
  });
});

describe('leadsTo', () => {
  const targets = [
    { kind: 'evolution', ball: 'AB', tier: 'S' },
    { kind: 'evolution', ball: 'ABC', tier: 'B' },
    { kind: 'evolution', ball: 'Top', tier: 'A' },
    { kind: 'fusion', balls: ['A', 'C'], tier: 'S' },
  ];

  it('skips direct evolutions and lists deeper targets with their path', () => {
    expect(leadsTo(recipes, targets, 'A')).toEqual([
      { result: 'Top', tier: 'A', via: ['AB', 'ABC'] },
      { result: 'ABC', tier: 'B', via: ['AB'] },
    ]);
  });

  it('uses the shortest path', () => {
    // B feeds AB and Top directly, so Top is a direct evolution of B.
    expect(leadsTo(recipes, targets, 'B')).toEqual([{ result: 'ABC', tier: 'B', via: ['AB'] }]);
  });

  it('works from an evolved ball and is empty at the end of the line', () => {
    expect(leadsTo(recipes, targets, 'AB')).toEqual([{ result: 'Top', tier: 'A', via: ['ABC'] }]);
    expect(leadsTo(recipes, targets, 'Top')).toEqual([]);
  });

  it('follows the real Burn → Bomb → Nuclear Bomb chain', () => {
    const fake = [{ kind: 'evolution', ball: 'Nuclear Bomb', tier: 'S' }];
    expect(leadsTo(balls, fake, 'Burn')).toContainEqual({ result: 'Nuclear Bomb', tier: 'S', via: ['Bomb'] });
  });
});

describe('fusionFor', () => {
  const targets = [
    { kind: 'evolution', ball: 'A', tier: 'S' },
    { kind: 'fusion', balls: ['A', 'B'], tier: 'S', effect: 'boom' },
  ];

  it('matches a fusion target in either order', () => {
    expect(fusionFor(targets, ['A', 'B'])?.effect).toBe('boom');
    expect(fusionFor(targets, ['B', 'A'])?.effect).toBe('boom');
  });

  it('ignores single balls and uncurated pairs', () => {
    expect(fusionFor(targets, ['A'])).toBeUndefined();
    expect(fusionFor(targets, ['A', 'C'])).toBeUndefined();
  });
});
