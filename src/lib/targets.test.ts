import { describe, expect, it } from 'vitest';
import balls from '../data/balls.json';
import targetsFile from '../../data/targets.json';
import { Catalog } from './planner';
import { suggest, validateTargets, type TargetEntry } from './targets';

const cat = new Catalog(balls);
const entries = targetsFile.targets as TargetEntry[];

describe('data/targets.json', () => {
  it('only names real balls and valid fusions', () => {
    expect(validateTargets(cat, entries)).toEqual([]);
  });

  it('covers every terminal evolution', () => {
    const parents = new Set(balls.flatMap((b) => (b.parents ?? []).flat()));
    const terminal = balls.filter((b) => b.parents && !parents.has(b.name)).map((b) => b.name);
    const listed = new Set(entries.flatMap((t) => (t.kind === 'evolution' ? [t.ball] : [])));
    expect(terminal.filter((n) => !listed.has(n))).toEqual([]);
  });
});

describe('suggest', () => {
  const fake: TargetEntry[] = [
    { id: 'nb', kind: 'evolution', ball: 'Nuclear Bomb', tier: 'S', why: '', sources: [] },
    { id: 'el', kind: 'evolution', ball: 'Elemental', tier: 'S', why: '', sources: [] },
    { id: 'satan', kind: 'evolution', ball: 'Satan', tier: 'A', why: '', sources: [] },
  ];

  it('lists only targets that use an owned ball, closest first', () => {
    const s = suggest(cat, fake, { owned: ['Burn', 'Iron'], pinned: [], slots: 4 });
    expect(s.map((x) => x.entry.id)).toEqual(['nb', 'el']);
  });

  it('pins filter to targets using every pinned ball', () => {
    const s = suggest(cat, fake, { owned: ['Burn', 'Iron'], pinned: ['Iron'], slots: 4 });
    expect(s.map((x) => x.entry.id)).toEqual(['nb']);
  });

  it('sorts targets that do not fit last', () => {
    const s = suggest(cat, fake, { owned: ['Burn'], pinned: [], slots: 3 });
    expect(s.at(-1)?.entry.id).toBe('el');
  });
});
