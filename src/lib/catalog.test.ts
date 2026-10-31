import { describe, expect, it } from 'vitest';
import balls from '../data/balls.json';
import { asBall, fusionProblem, getBall, isBase } from './catalog';
import { parseBalls } from './parse';

const cat = parseBalls(balls);
const n = (s: string) => {
  const b = asBall(cat, s);
  if (!b) throw new Error(s);
  return b;
};

describe('asBall', () => {
  it('gives the name of a known ball, null otherwise', () => {
    expect(asBall(cat, 'Burn')).toBe('Burn');
    expect(asBall(cat, 'Nope')).toBeNull();
    expect(asBall(cat, 'burn')).toBeNull();
    expect(asBall(cat, '')).toBeNull();
  });
});

describe('getBall / isBase', () => {
  it('base balls have no recipe, evolved ones do', () => {
    expect(isBase(cat, n('Burn'))).toBe(true);
    expect(isBase(cat, n('Bomb'))).toBe(false);
    expect(isBase(cat, n('Nuclear Bomb'))).toBe(false);
    expect(getBall(cat, n('Bomb')).parents).toEqual([['Burn', 'Iron']]);
  });
});

describe('fusionProblem', () => {
  it('a ball cannot fuse with itself', () => {
    expect(fusionProblem(cat, n('Sun'), n('Sun'))).toMatch(/itself/);
  });

  it('a pair that evolves cannot fuse, in either order', () => {
    expect(fusionProblem(cat, n('Sun'), n('Dark'))).toBe('Sun + Dark must evolve into Black Hole');
    expect(fusionProblem(cat, n('Dark'), n('Sun'))).toBe('Dark + Sun must evolve into Black Hole');
    expect(fusionProblem(cat, n('Burn'), n('Iron'))).toMatch(/Bomb/);
  });

  it('any other pair is fine', () => {
    expect(fusionProblem(cat, n('Hemorrhage'), n('Sun'))).toBeNull();
    expect(fusionProblem(cat, n('Black Hole'), n('Satan'))).toBeNull();
    expect(fusionProblem(cat, n('Burn'), n('Ghost'))).toBeNull();
  });
});
