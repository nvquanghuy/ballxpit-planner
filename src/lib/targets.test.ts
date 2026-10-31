import { describe, expect, it } from 'vitest';
import balls from '../data/balls.json';
import targetsFile from '../../data/targets.json';
import { asBall, isBase } from './catalog';
import { fused, held, type Held } from './domain';
import { parseBalls, parseTargets } from './parse';
import { suggest } from './targets';

const cat = parseBalls(balls);
const entries = parseTargets(targetsFile.targets, cat);
const n = (s: string) => {
  const b = asBall(cat, s);
  if (!b) throw new Error(s);
  return b;
};
const hs = (...names: string[]): Held[] => names.map((s) => held(n(s)));

describe('data/targets.json', () => {
  it('keeps every entry', () => {
    expect(entries.length).toBe(targetsFile.targets.length);
  });

  it('covers every terminal evolution', () => {
    const parents = new Set(cat.balls.flatMap((b) => b.parents.flat()));
    const terminal = cat.balls.filter((b) => !isBase(cat, b.name) && !parents.has(b.name)).map((b) => b.name);
    expect(terminal.length).toBeGreaterThan(0);
    const listed = new Set(entries.flatMap((t) => (t.kind === 'evolution' ? [t.ball] : [])));
    expect(terminal.filter((x) => !listed.has(x))).toEqual([]);
  });
});

describe('suggest', () => {
  const fake = parseTargets(
    [
      { id: 'nb', kind: 'evolution', ball: 'Nuclear Bomb', tier: 'S', why: '' },
      { id: 'el', kind: 'evolution', ball: 'Elemental', tier: 'S', why: '' },
      { id: 'satan', kind: 'evolution', ball: 'Satan', tier: 'A', why: '' },
    ],
    cat,
  );

  it('lists only targets that use an owned ball, closest first', () => {
    const s = suggest(cat, fake, { owned: hs('Burn', 'Iron'), pinned: [], slots: 4 });
    expect(s.map((x) => x.entry.id)).toEqual(['nb', 'el']);
    expect(s.map((x) => x.label)).toEqual(['Nuclear Bomb', 'Elemental']);
  });

  it('showAll lists targets that use no owned ball too', () => {
    const s = suggest(cat, fake, { owned: hs('Burn', 'Iron'), pinned: [], slots: 4, showAll: true });
    expect(s.map((x) => x.entry.id).sort()).toEqual(['el', 'nb', 'satan']);
  });

  it('pins filter to targets using every pinned ball', () => {
    const s = suggest(cat, fake, { owned: hs('Burn', 'Iron'), pinned: [n('Iron')], slots: 4 });
    expect(s.map((x) => x.entry.id)).toEqual(['nb']);
  });

  it('sorts targets that do not fit last', () => {
    const s = suggest(cat, fake, { owned: hs('Burn'), pinned: [], slots: 3 });
    expect(s.at(-1)?.entry.id).toBe('el');
    expect(s.at(-1)?.plan.fits).toBe(false);
  });

  it('owning only fused balls lists everything, slot-checked with the fused slot taken', () => {
    const s = suggest(cat, fake, { owned: [fused(n('Hemorrhage'), n('Sun'))], pinned: [], slots: 4 });
    expect(s.map((x) => x.entry.id).sort()).toEqual(['el', 'nb', 'satan']);
    expect(s.find((x) => x.entry.id === 'el')?.plan.fits).toBe(false);
  });

  it('labels fusion targets with both balls', () => {
    const f = parseTargets([{ id: 'hs', kind: 'fusion', balls: ['Hemorrhage', 'Sun'], tier: 'S', why: '' }], cat);
    expect(suggest(cat, f, { owned: hs('Sun'), pinned: [], slots: 4 }).map((x) => x.label)).toEqual(['Hemorrhage ⊕ Sun']);
  });
});
