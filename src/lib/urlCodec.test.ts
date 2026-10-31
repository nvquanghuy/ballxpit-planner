import { describe, expect, it } from 'vitest';
import { decodeHash, encodeHash, type UrlFields } from './urlCodec';

// Written by the app before the refactor: bookmarks must keep loading the same run.
const OLD =
  '#slots=5&owned=Burn%2CGhost%2CHemorrhage+%E2%8A%95+Sun&pinned=Ghost&target=Flash%2BReaper&offer=Poison%2CLight&r=Virus%3A1%2CBomb%3A0';
const RUN: UrlFields = {
  slots: 5,
  owned: ['Burn', 'Ghost', 'Hemorrhage ⊕ Sun'],
  pinned: ['Ghost'],
  target: 'Flash+Reaper',
  overrides: { Virus: 1, Bomb: 0 },
  offers: ['Poison', 'Light'],
};
const EMPTY: UrlFields = { slots: null, owned: [], pinned: [], target: null, overrides: {}, offers: [] };

describe('decodeHash', () => {
  it('reads an old bookmark', () => {
    expect(decodeHash(OLD)).toEqual(RUN);
  });

  it('works without the leading #', () => {
    expect(decodeHash(OLD.slice(1))).toEqual(RUN);
  });

  it('a target id keeps its + even when written unescaped', () => {
    expect(decodeHash('target=Flash+Reaper').target).toBe('Flash+Reaper');
  });

  it('empty and junk give an empty run', () => {
    expect(decodeHash('')).toEqual(EMPTY);
    expect(decodeHash('#slots=0&owned=,,&r=Virus:x,:1,Bomb:&target=')).toEqual(EMPTY);
    expect(decodeHash('slots=-2').slots).toBeNull();
    expect(decodeHash('slots=2.5').slots).toBeNull();
  });
});

describe('encodeHash', () => {
  it('writes the same format as before', () => {
    expect('#' + encodeHash(RUN)).toBe(OLD);
  });

  it('round-trips', () => {
    expect(decodeHash(encodeHash(RUN))).toEqual(RUN);
    expect(decodeHash(encodeHash(EMPTY))).toEqual(EMPTY);
  });

  it('leaves empty fields out', () => {
    expect(encodeHash(EMPTY)).toBe('');
    expect(encodeHash({ ...EMPTY, slots: 4 })).toBe('slots=4');
  });
});
