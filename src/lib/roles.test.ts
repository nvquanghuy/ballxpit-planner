import { describe, expect, it } from 'vitest';
import balls from '../data/balls.json';
import rolesFile from '../../data/roles.json';
import { comboOf, hasAnyRole, lookupWith, mergeVs, ROLES, sanitizeRoles, summarize, tagOf, VS, type RoleTag } from './roles';

const base: Record<string, RoleTag> = {
  Ghost: { roles: ['enabler'], vs: 'waves', why: 'passes through' },
  Brood: { roles: ['babymaker', 'hitter'], vs: 'waves' },
  Burn: { roles: ['effect'], vs: 'both' },
  Doom: { roles: ['executioner'], vs: 'bosses' },
  Heal: { roles: ['sustain'], vs: 'waves' },
};
const look = lookupWith(base, {});

describe('roles.json', () => {
  it('names only known balls, known roles and vs values', () => {
    const names = new Set(balls.map((b) => b.name));
    const problems: string[] = [];
    for (const [n, t] of Object.entries((rolesFile as unknown as { balls: Record<string, { roles: string[]; vs: string }> }).balls)) {
      if (!names.has(n)) problems.push(`unknown ball "${n}"`);
      if (!t.roles?.length || t.roles.length > 3) problems.push(`${n}: needs 1-3 roles`);
      for (const r of t.roles ?? []) if (!ROLES.includes(r as never)) problems.push(`${n}: unknown role ${r}`);
      if (!VS.includes(t.vs as never)) problems.push(`${n}: bad vs ${t.vs}`);
    }
    expect(problems).toEqual([]);
  });
});

describe('sanitizeRoles', () => {
  it('drops unknown names, roles, vs and duplicates', () => {
    const raw = { Burn: { roles: ['effect', 'nope', 'effect'], vs: 'everyone', why: 'w' }, Nope: { roles: ['hitter'] }, Bad: 3 };
    expect(sanitizeRoles(raw, (n) => n !== 'Nope')).toEqual({ Burn: { roles: ['effect'], why: 'w' } });
    expect(sanitizeRoles(null)).toEqual({});
  });
});

describe('lookupWith', () => {
  it('your edit wins and keeps the researched why', () => {
    const l = lookupWith(base, { Ghost: { roles: ['control'], vs: 'both' } });
    expect(l('Ghost')).toEqual({ roles: ['control'], vs: 'both', why: 'passes through' });
    expect(l('Burn')).toBe(base.Burn);
    expect(l('Iron')).toBeUndefined();
  });
});

describe('tagOf', () => {
  it('fused balls get the union of both parts in display order', () => {
    expect(tagOf('Heal ⊕ Ghost', look)).toEqual({ roles: ['enabler', 'sustain'], vs: 'waves' });
    expect(tagOf('Ghost ⊕ Doom', look)?.vs).toBe('both');
    expect(tagOf('Ghost ⊕ Iron', look)?.roles).toEqual(['enabler']);
    expect(tagOf('Iron ⊕ Laser', look)).toBeUndefined();
  });

  it('mergeVs', () => {
    expect(mergeVs([undefined])).toBeUndefined();
    expect(mergeVs(['waves', 'waves'])).toBe('waves');
    expect(mergeVs(['waves', 'bosses'])).toBe('both');
  });
});

describe('hasAnyRole', () => {
  it('no pick passes all, else any picked role', () => {
    expect(hasAnyRole('Iron', [], look)).toBe(true);
    expect(hasAnyRole('Iron', ['hitter'], look)).toBe(false);
    expect(hasAnyRole('Brood', ['hitter', 'control'], look)).toBe(true);
    expect(hasAnyRole('Burn', ['hitter'], look)).toBe(false);
  });
});

describe('summarize', () => {
  it('counts roles, fused once, and flags gaps', () => {
    const s = summarize(['Ghost', 'Burn ⊕ Brood', 'Iron'], look);
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
    expect(summarize(['Heal'], look).missing).toEqual(['no enabler/babymaker', 'no effect/executioner', 'weak vs bosses']);
    expect(summarize(['Doom'], look).missing).toEqual(['no enabler/babymaker', 'no sustain', 'weak vs waves']);
  });

  it('says nothing missing without any tagged ball', () => {
    expect(summarize(['Iron'], look)).toEqual({ counts: [], missing: [], untagged: 1 });
  });
});

describe('comboOf', () => {
  it('spreader + payload in either order', () => {
    expect(comboOf('Ghost', 'Burn', look)).toBe('enabler + effect');
    expect(comboOf('Doom', 'Brood', look)).toBe('babymaker + executioner');
  });

  it('null otherwise', () => {
    expect(comboOf('Ghost', 'Brood', look)).toBeNull();
    expect(comboOf('Burn', 'Doom', look)).toBeNull();
    expect(comboOf('Ghost', 'Iron', look)).toBeNull();
  });
});
