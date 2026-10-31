import { describe, expect, it } from 'vitest';
import balls from '../data/balls.json';
import rolesFile from '../../data/roles.json';
import { fused, held, type BallName } from './domain';
import { parseBalls } from './parse';
import { comboOf, hasAnyRole, lookupWith, mergeVs, ROLES, summarize, tagOf, VS, type RoleTags } from './roles';

// Fake names: roles.ts never looks a ball up in the catalogue.
const b = (s: string) => s as BallName;
const base: RoleTags = {
  [b('Ghost')]: { roles: ['enabler'], vs: 'waves', why: 'passes through' },
  [b('Brood')]: { roles: ['babymaker', 'hitter'], vs: 'waves' },
  [b('Burn')]: { roles: ['effect'], vs: 'both' },
  [b('Doom')]: { roles: ['executioner'], vs: 'bosses' },
  [b('Heal')]: { roles: ['sustain'], vs: 'waves' },
};
const look = lookupWith(base, {});
const one = (s: string) => held(b(s));
const two = (x: string, y: string) => fused(b(x), b(y));

describe('roles.json', () => {
  it('names only known balls, known roles and vs values', () => {
    const cat = parseBalls(balls);
    const problems: string[] = [];
    for (const [n, t] of Object.entries((rolesFile as unknown as { balls: Record<string, { roles: string[]; vs: string }> }).balls)) {
      if (!cat.byName.has(n)) problems.push(`unknown ball "${n}"`);
      if (!t.roles?.length || t.roles.length > 3) problems.push(`${n}: needs 1-3 roles`);
      for (const r of t.roles ?? []) if (!ROLES.includes(r as never)) problems.push(`${n}: unknown role ${r}`);
      if (!VS.includes(t.vs as never)) problems.push(`${n}: bad vs ${t.vs}`);
    }
    expect(problems).toEqual([]);
  });
});

describe('lookupWith', () => {
  it('your edit wins and keeps the researched why', () => {
    const l = lookupWith(base, { [b('Ghost')]: { roles: ['control'], vs: 'both' } });
    expect(l(b('Ghost'))).toEqual({ roles: ['control'], vs: 'both', why: 'passes through' });
    expect(l(b('Burn'))).toBe(base[b('Burn')]);
    expect(l(b('Iron'))).toBeUndefined();
  });
});

describe('tagOf', () => {
  it('an unfused ball gets its own tag', () => {
    expect(tagOf(one('Ghost'), look)).toBe(base[b('Ghost')]);
    expect(tagOf(one('Iron'), look)).toBeUndefined();
  });

  it('fused balls get the union of both parts in display order', () => {
    expect(tagOf(two('Heal', 'Ghost'), look)).toEqual({ roles: ['enabler', 'sustain'], vs: 'waves' });
    expect(tagOf(two('Ghost', 'Doom'), look)?.vs).toBe('both');
    expect(tagOf(two('Ghost', 'Iron'), look)?.roles).toEqual(['enabler']);
    expect(tagOf(two('Iron', 'Laser'), look)).toBeUndefined();
  });

  it('mergeVs', () => {
    expect(mergeVs([undefined])).toBeUndefined();
    expect(mergeVs(['waves', 'waves'])).toBe('waves');
    expect(mergeVs(['waves', 'bosses'])).toBe('both');
  });
});

describe('hasAnyRole', () => {
  it('no pick passes all, else any picked role', () => {
    expect(hasAnyRole(b('Iron'), [], look)).toBe(true);
    expect(hasAnyRole(b('Iron'), ['hitter'], look)).toBe(false);
    expect(hasAnyRole(b('Brood'), ['hitter', 'control'], look)).toBe(true);
    expect(hasAnyRole(b('Burn'), ['hitter'], look)).toBe(false);
  });
});

describe('summarize', () => {
  it('counts roles, fused once, and flags gaps', () => {
    const s = summarize([one('Ghost'), two('Burn', 'Brood'), one('Iron')], look);
    expect(s.counts).toEqual([
      { role: 'enabler', n: 1 },
      { role: 'babymaker', n: 1 },
      { role: 'effect', n: 1 },
      { role: 'hitter', n: 1 },
    ]);
    expect(s.missing).toEqual(['no sustain']);
    expect(s.untagged).toBe(1);
  });

  it('flags missing spreaders, payloads and boss/wave weakness', () => {
    expect(summarize([one('Heal')], look).missing).toEqual(['no enabler/babymaker', 'no effect/executioner', 'weak vs bosses']);
    expect(summarize([one('Doom')], look).missing).toEqual(['no enabler/babymaker', 'no sustain', 'weak vs waves']);
  });

  it('says nothing missing without any tagged ball', () => {
    expect(summarize([one('Iron')], look)).toEqual({ counts: [], missing: [], untagged: 1 });
  });
});

describe('comboOf', () => {
  it('spreader + payload in either order', () => {
    expect(comboOf(b('Ghost'), b('Burn'), look)).toBe('enabler + effect');
    expect(comboOf(b('Doom'), b('Brood'), look)).toBe('babymaker + executioner');
  });

  it('null otherwise', () => {
    expect(comboOf(b('Ghost'), b('Brood'), look)).toBeNull();
    expect(comboOf(b('Burn'), b('Doom'), look)).toBeNull();
    expect(comboOf(b('Ghost'), b('Iron'), look)).toBeNull();
  });
});
