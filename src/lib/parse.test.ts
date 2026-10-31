import { describe, expect, it } from 'vitest';
import balls from '../data/balls.json';
import targetsFile from '../../data/targets.json';
import rolesFile from '../../data/roles.json';
import { asBall } from './catalog';
import { fused, held } from './domain';
import { ParseError, parseBalls, parseHeld, parseRoleTags, parseTargets } from './parse';

const cat = parseBalls(balls);
const n = (s: string) => {
  const b = asBall(cat, s);
  if (!b) throw new Error(s);
  return b;
};

/** The problems a parser throws, failing the test if it doesn't throw a ParseError. */
function problemsOf(f: () => unknown): string[] {
  try {
    f();
  } catch (e) {
    expect(e).toBeInstanceOf(ParseError);
    return (e as ParseError).problems;
  }
  throw new Error('did not throw');
}

describe('real data', () => {
  it('parses balls, targets and roles', () => {
    expect(cat.balls.length).toBe(balls.length);
    const targets = parseTargets(targetsFile.targets, cat);
    expect(targets.length).toBe(targetsFile.targets.length);
    const roles = parseRoleTags(rolesFile.balls, cat);
    expect(Object.keys(roles).length).toBe(Object.keys(rolesFile.balls).length);
  });
});

describe('parseBalls', () => {
  const ok = (name: string, parents?: string[][]) => ({ name, img: '', description: '', ...(parents ? { parents } : {}) });

  it('builds a catalogue with recipes and defaults', () => {
    const c = parseBalls([ok('A'), ok('B'), ok('AB', [['A', 'B']])]);
    expect(c.balls.map((b) => b.name)).toEqual(['A', 'B', 'AB']);
    expect(c.byName.get('AB')?.parents).toEqual([['A', 'B']]);
    expect(c.byName.get('A')).toMatchObject({ parents: [], damageType: [], statusEffect: [], slug: '' });
    expect(c.evolvesInto.get('A|B')).toBe('AB');
  });

  it('rejects a non-list', () => {
    expect(problemsOf(() => parseBalls({}))).toEqual(['not a list']);
    expect(problemsOf(() => parseBalls(null))).toEqual(['not a list']);
  });

  it('rejects duplicates', () => {
    expect(problemsOf(() => parseBalls([ok('A'), ok('A')]))).toEqual(['duplicate ball "A"']);
  });

  it('rejects a recipe with an unknown ball', () => {
    expect(problemsOf(() => parseBalls([ok('A'), ok('X', [['A', 'Z']])]))).toEqual(['X: unknown ball "Z" in a recipe']);
  });

  it('rejects a recipe with fewer than 2 balls', () => {
    expect(problemsOf(() => parseBalls([ok('A'), ok('X', [['A']])]))).toEqual(['X: recipe A has fewer than 2 balls']);
  });

  it('rejects entries that are not balls and missing fields', () => {
    expect(problemsOf(() => parseBalls([ok('A'), 3, { name: 'B' }]))).toEqual(['not a ball: 3', 'B: missing img or description']);
  });

  it('lists every problem at once', () => {
    const p = problemsOf(() => parseBalls([ok('A'), ok('A'), ok('X', [['A', 'Z']]), ok('Y', [['A']]), ok('W', [['A', 3]] as never)]));
    expect(p).toEqual([
      'duplicate ball "A"',
      'X: unknown ball "Z" in a recipe',
      'Y: recipe A has fewer than 2 balls',
      'W: bad recipes',
    ]);
  });
});

describe('parseTargets', () => {
  const evo = (id: string, ball: unknown, extra: object = {}) => ({ id, kind: 'evolution', ball, tier: 'S', why: 'w', ...extra });
  const fuse = (id: string, a: unknown, b: unknown, extra: object = {}) => ({ id, kind: 'fusion', balls: [a, b], tier: 'A', why: 'w', ...extra });

  it('types valid entries, keeping optional fields', () => {
    const t = parseTargets(
      [evo('nb', 'Nuclear Bomb', { sources: ['http://x'], unverified: true }), fuse('hs', 'Hemorrhage', 'Sun', { effect: 'e' })],
      cat,
    );
    expect(t).toEqual([
      { id: 'nb', kind: 'evolution', ball: 'Nuclear Bomb', tier: 'S', why: 'w', sources: ['http://x'], unverified: true },
      { id: 'hs', kind: 'fusion', balls: ['Hemorrhage', 'Sun'], tier: 'A', why: 'w', effect: 'e', sources: [] },
    ]);
  });

  it('rejects a non-list', () => {
    expect(problemsOf(() => parseTargets({}, cat))).toEqual(['not a list']);
  });

  it('rejects a duplicate id', () => {
    expect(problemsOf(() => parseTargets([evo('x', 'Sun'), evo('x', 'Bomb')], cat))).toEqual(['x: duplicate id']);
  });

  it('rejects a bad tier', () => {
    expect(problemsOf(() => parseTargets([evo('x', 'Sun', { tier: 'Z' })], cat))).toEqual(['x: bad tier Z']);
  });

  it('rejects a missing why', () => {
    expect(problemsOf(() => parseTargets([evo('x', 'Sun', { why: undefined })], cat))).toEqual(['x: missing why']);
  });

  it('rejects an unknown ball', () => {
    expect(problemsOf(() => parseTargets([evo('x', 'Nope')], cat))).toEqual(['x: unknown ball "Nope"']);
    expect(problemsOf(() => parseTargets([fuse('y', 'Sun', 'Nope')], cat))).toEqual(['y: unknown ball "Nope"']);
  });

  it('rejects an evolution target that is a base ball', () => {
    expect(problemsOf(() => parseTargets([evo('x', 'Burn')], cat))).toEqual(['x: Burn is a base ball']);
  });

  it('rejects fusing a ball with itself', () => {
    expect(problemsOf(() => parseTargets([fuse('x', 'Sun', 'Sun')], cat))).toEqual(['x: a ball cannot be fused with itself']);
  });

  it('rejects fusing a pair that must evolve', () => {
    expect(problemsOf(() => parseTargets([fuse('x', 'Sun', 'Dark')], cat))).toEqual(['x: Sun + Dark must evolve into Black Hole']);
  });

  it('rejects a fusion without exactly two balls, a bad kind and a non-target', () => {
    expect(problemsOf(() => parseTargets([{ ...fuse('x', 'Sun', 'Dark'), balls: ['Sun'] }, { ...evo('y', 'Sun'), kind: 'nope' }, 7], cat))).toEqual([
      'x: a fusion needs exactly 2 balls',
      'y: bad kind nope',
      'not a target: 7',
    ]);
  });

  it('lists every problem at once', () => {
    expect(problemsOf(() => parseTargets([evo('a', 'Burn', { tier: 'Z' }), evo('a', 'Sun'), fuse('b', 'Sun', 'Sun')], cat))).toEqual([
      'a: bad tier Z',
      'a: Burn is a base ball',
      'a: duplicate id',
      'b: a ball cannot be fused with itself',
    ]);
  });
});

describe('parseHeld', () => {
  it('reads a ball', () => {
    expect(parseHeld(cat, 'Burn')).toEqual(held(n('Burn')));
  });

  it('reads a fused pair', () => {
    expect(parseHeld(cat, 'Hemorrhage ⊕ Sun')).toEqual(fused(n('Hemorrhage'), n('Sun')));
  });

  it('rejects a pair that cannot be fused', () => {
    expect(parseHeld(cat, 'Sun ⊕ Dark')).toBeNull();
    expect(parseHeld(cat, 'Sun ⊕ Sun')).toBeNull();
  });

  it('rejects unknown names', () => {
    expect(parseHeld(cat, 'Nope')).toBeNull();
    expect(parseHeld(cat, 'Nope ⊕ Sun')).toBeNull();
    expect(parseHeld(cat, '')).toBeNull();
  });

  it('rejects three parts', () => {
    expect(parseHeld(cat, 'Hemorrhage ⊕ Sun ⊕ Burn')).toBeNull();
  });
});

describe('parseRoleTags', () => {
  it('drops unknown balls, roles, vs, non-objects and duplicate roles', () => {
    const raw = {
      Burn: { roles: ['effect', 'nope', 'effect'], vs: 'everyone', why: 'w' },
      Iron: { roles: ['hitter', 'control'], vs: 'bosses', why: '' },
      Nope: { roles: ['hitter'] },
      Light: 3,
      Dark: { roles: 'hitter' },
    };
    expect(parseRoleTags(raw, cat)).toEqual({
      Burn: { roles: ['effect'], why: 'w' },
      Iron: { roles: ['hitter', 'control'], vs: 'bosses' },
    });
  });

  it('gives nothing for a non-object', () => {
    expect(parseRoleTags(null, cat)).toEqual({});
    expect(parseRoleTags([], cat)).toEqual({});
    expect(parseRoleTags('x', cat)).toEqual({});
  });
});
