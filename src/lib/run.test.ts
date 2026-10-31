import { describe, expect, it } from 'vitest';
import balls from '../data/balls.json';
import targetsFile from '../../data/targets.json';
import { asBall } from './catalog';
import { fused, held, heldLabel, holdsBall, usableBalls, type Held, type Target, type TargetId } from './domain';
import { parseBalls, parseTargets } from './parse';
import { isReady, plan, type Plan } from './planner';
import { emptyRun, normalize, parseRun, step, toUrl, type Action, type Run, type Session } from './run';
import { decodeHash, encodeHash, type UrlFields } from './urlCodec';

const cat = parseBalls(balls);
const targets = parseTargets(targetsFile.targets, cat);
const n = (s: string) => {
  const b = asBall(cat, s);
  if (!b) throw new Error(s);
  return b;
};
const hs = (...names: string[]): Held[] => names.map((s) => held(n(s)));
const tid = (s: string) => {
  const t = targets.find((x) => x.id === s);
  if (!t) throw new Error(s);
  return t.id;
};
const HS = fused(n('Hemorrhage'), n('Sun'));
const fields = (f: Partial<UrlFields>): UrlFields => ({ slots: null, owned: [], pinned: [], target: null, overrides: {}, offers: [], ...f });
const run = (r: Partial<Run>): Run => ({ ...emptyRun(4), ...r });
const session = (r: Partial<Run>): Session => ({ run: run(r), undo: null });
const readyPlan = (t: Target, owned: Held[]): Plan => {
  const p = plan(cat, t, { owned, slots: 4 });
  expect(isReady(p)).toBe(true);
  return p;
};
const NB: Target = { kind: 'evolution', ball: n('Nuclear Bomb') };

/** The run's rules, checked directly (not via normalize). */
function expectInvariants(r: Run) {
  const usable = usableBalls(r.held);
  expect(r.pinned.filter((p) => !usable.includes(p))).toEqual([]);
  expect(r.offers.filter((o) => holdsBall(r.held, o))).toEqual([]);
  const labels = r.held.map(heldLabel);
  expect(new Set(labels).size).toBe(labels.length);
  expect(new Set(r.pinned).size).toBe(r.pinned.length);
  expect(new Set(r.offers).size).toBe(r.offers.length);
}

describe('parseRun', () => {
  it('drops unknown balls, invalid fusions, unknown targets and out-of-range overrides', () => {
    const r = parseRun(
      fields({
        slots: 4,
        owned: ['Burn', 'Nope', 'Sun ⊕ Dark', 'Sun ⊕ Sun', 'Hemorrhage ⊕ Sun', 'A ⊕ B ⊕ C'],
        pinned: ['Burn', 'Nope'],
        offers: ['Poison', 'Nope'],
        target: 'no-such-target',
        overrides: { Virus: 2, Bomb: 1, Nope: 0, Sun: -1, Burn: 0 },
      }),
      cat,
      targets,
    );
    expect(r).toEqual({
      slots: 4,
      held: [held(n('Burn')), HS],
      pinned: ['Burn'],
      offers: ['Poison'],
      target: null,
      overrides: { Virus: 2 },
    });
  });

  it('keeps a known target', () => {
    expect(parseRun(fields({ target: 'flash+reaper' }), cat, targets).target).toBe('flash+reaper');
  });

  it('dedupes held, pins and offers', () => {
    const r = parseRun(
      fields({ owned: ['Burn', 'Burn', 'Hemorrhage ⊕ Sun', 'Hemorrhage ⊕ Sun'], pinned: ['Burn', 'Burn'], offers: ['Poison', 'Poison'] }),
      cat,
      targets,
    );
    expect(r.held).toEqual([held(n('Burn')), HS]);
    expect(r.pinned).toEqual(['Burn']);
    expect(r.offers).toEqual(['Poison']);
  });

  it('pins only unfused balls you hold', () => {
    const r = parseRun(fields({ owned: ['Burn', 'Hemorrhage ⊕ Sun'], pinned: ['Burn', 'Sun', 'Hemorrhage', 'Iron'] }), cat, targets);
    expect(r.pinned).toEqual(['Burn']);
  });

  it('offers exclude balls you hold, but not parts of a fused ball', () => {
    const r = parseRun(fields({ owned: ['Burn', 'Hemorrhage ⊕ Sun'], offers: ['Burn', 'Sun', 'Poison'] }), cat, targets);
    expect(r.offers).toEqual(['Sun', 'Poison']);
  });

  it('drops a bad slot count', () => {
    expect(parseRun(fields({ slots: 0 }), cat, targets).slots).toBeNull();
  });
});

describe('old bookmarks', () => {
  // Same string as urlCodec.test.ts: written by the app before the refactor.
  const OLD =
    '#slots=5&owned=Burn%2CGhost%2CHemorrhage+%E2%8A%95+Sun&pinned=Ghost&target=flash%2Breaper&offer=Poison%2CLight&r=Virus%3A1%2CBomb%3A0';

  it('load the same run', () => {
    expect(parseRun(decodeHash(OLD), cat, targets)).toEqual({
      slots: 5,
      held: [...hs('Burn', 'Ghost'), HS],
      pinned: ['Ghost'],
      offers: ['Poison', 'Light'],
      target: 'flash+reaper',
      overrides: { Virus: 1, Bomb: 0 },
    });
  });

  it('round-trip through toUrl and encodeHash', () => {
    const r = { ...parseRun(decodeHash(OLD), cat, targets), target: tid('flash+reaper') };
    const hash = encodeHash(toUrl(r));
    expect(parseRun(decodeHash(hash), cat, targets)).toEqual(r);
    expect(decodeHash(hash)).toEqual(toUrl(r));
  });
});

describe('normalize', () => {
  it('keeps one copy of a fused pair written in either order', () => {
    const r = normalize(run({ held: [fused(n('Hemorrhage'), n('Sun')), fused(n('Sun'), n('Hemorrhage'))] }));
    expect(r.held).toEqual([fused(n('Hemorrhage'), n('Sun'))]);
  });

  it('drops a bad slot count and enforces the rules', () => {
    const r = normalize(run({ slots: 2.5, held: [held(n('Burn')), held(n('Burn'))], pinned: [n('Iron')], offers: [n('Burn')] }));
    expect(r).toMatchObject({ slots: null, held: hs('Burn'), pinned: [], offers: [] });
  });
});

describe('step', () => {
  const s0 = session({ held: [...hs('Burn', 'Iron'), HS], pinned: [n('Burn')], offers: [n('Poison'), n('Light')] });

  it('setSlots', () => {
    expect(step(s0, { type: 'setSlots', slots: 6 }).run.slots).toBe(6);
    expect(step(s0, { type: 'setSlots', slots: null }).run.slots).toBeNull();
    expect(step(s0, { type: 'setSlots', slots: -1 }).run.slots).toBeNull();
  });

  it('newRun keeps only the slot count', () => {
    expect(step({ ...s0, run: { ...s0.run, target: tid('sun') } }, { type: 'newRun' })).toEqual({ run: emptyRun(4), undo: null });
  });

  it('add', () => {
    expect(step(s0, { type: 'add', ball: n('Ghost') }).run.held).toEqual([...hs('Burn', 'Iron'), HS, held(n('Ghost'))]);
    expect(step(s0, { type: 'add', ball: n('Burn') }).run.held).toEqual(s0.run.held);
  });

  it('adding an offered ball removes the offer', () => {
    expect(step(s0, { type: 'add', ball: n('Poison') }).run.offers).toEqual(['Light']);
  });

  it('remove drops the ball and its pin', () => {
    const r = step(s0, { type: 'remove', held: held(n('Burn')) }).run;
    expect(r.held).toEqual([held(n('Iron')), HS]);
    expect(r.pinned).toEqual([]);
    expect(step(s0, { type: 'remove', held: HS }).run.held).toEqual(hs('Burn', 'Iron'));
  });

  it('togglePin', () => {
    expect(step(s0, { type: 'togglePin', ball: n('Iron') }).run.pinned).toEqual(['Burn', 'Iron']);
    expect(step(s0, { type: 'togglePin', ball: n('Burn') }).run.pinned).toEqual([]);
    expect(step(s0, { type: 'togglePin', ball: n('Sun') }).run.pinned).toEqual(['Burn']); // fused part
    expect(step(s0, { type: 'togglePin', ball: n('Ghost') }).run.pinned).toEqual(['Burn']); // not held
  });

  it('addOffer, removeOffer, clearOffers', () => {
    expect(step(s0, { type: 'addOffer', ball: n('Ghost') }).run.offers).toEqual(['Poison', 'Light', 'Ghost']);
    expect(step(s0, { type: 'addOffer', ball: n('Poison') }).run.offers).toEqual(['Poison', 'Light']);
    expect(step(s0, { type: 'addOffer', ball: n('Burn') }).run.offers).toEqual(['Poison', 'Light']); // held
    expect(step(s0, { type: 'removeOffer', ball: n('Poison') }).run.offers).toEqual(['Light']);
    expect(step(s0, { type: 'clearOffers' }).run.offers).toEqual([]);
  });

  it('takeOffer holds the ball and clears the offers', () => {
    const r = step(s0, { type: 'takeOffer', ball: n('Poison') }).run;
    expect(r.held).toEqual([...hs('Burn', 'Iron'), HS, held(n('Poison'))]);
    expect(r.offers).toEqual([]);
  });

  it('open resets recipe choices, close keeps them', () => {
    const s = { ...s0, run: { ...s0.run, overrides: { [n('Virus')]: 1 } } };
    expect(step(s, { type: 'open', id: tid('sun') }).run).toMatchObject({ target: 'sun', overrides: {} });
    const opened = { ...s, run: { ...s.run, target: tid('sun') } };
    expect(step(opened, { type: 'close' }).run).toMatchObject({ target: null, overrides: { Virus: 1 } });
  });

  it('setRecipe', () => {
    expect(step(s0, { type: 'setRecipe', ball: n('Virus'), recipe: 2 }).run.overrides).toEqual({ Virus: 2 });
  });

  it('dismissUndo clears undo only', () => {
    const s: Session = { run: s0.run, undo: { label: 'x', fused: false, before: { held: [], pinned: [] } } };
    expect(step(s, { type: 'dismissUndo' })).toEqual({ run: s0.run, undo: null });
  });

  it('undo without anything to undo is a no-op', () => {
    expect(step(s0, { type: 'undo' })).toBe(s0);
  });
});

describe('apply and undo', () => {
  const owned = hs('Wind', 'Burn', 'Iron', 'Poison');
  const s0 = session({ held: owned, pinned: [n('Wind'), n('Burn')], offers: [n('Light')], target: tid('nuclear-bomb') });
  const p = readyPlan(NB, owned);
  const applied = step(s0, { type: 'apply', plan: p });

  it('replaces the parts with the result, drops their pins and closes the target', () => {
    expect(applied.run.held).not.toEqual(s0.run.held);
    expect(applied.run.held).toEqual(hs('Wind', 'Nuclear Bomb'));
    expect(applied.run.pinned).toEqual(['Wind']);
    expect(applied.run.offers).toEqual(['Light']);
    expect(applied.run.target).toBeNull();
  });

  it('offers undo', () => {
    expect(applied.undo).toEqual({ label: 'Nuclear Bomb', fused: false, before: { held: owned, pinned: ['Wind', 'Burn'] } });
  });

  it('a fusion becomes one fused ball', () => {
    const fo = hs('Sun', 'Hemorrhage');
    const s = step(session({ held: fo }), { type: 'apply', plan: readyPlan({ kind: 'fusion', balls: [n('Hemorrhage'), n('Sun')] }, fo) });
    expect(s.run.held).toEqual([HS]);
    expect(s.undo).toMatchObject({ label: 'Hemorrhage ⊕ Sun', fused: true });
  });

  it('undo restores held and pins', () => {
    const u = step(applied, { type: 'undo' });
    expect(u.run.held).toEqual(owned);
    expect(u.run.pinned).toEqual(['Wind', 'Burn']);
    expect(u.undo).toBeNull();
  });

  it('undo drops offers you hold again', () => {
    const s = step(step(applied, { type: 'addOffer', ball: n('Burn') }), { type: 'undo' });
    expect(s.run.held).toEqual(owned);
    expect(s.run.offers).toEqual(['Light']);
  });

  it('any change to what you hold clears undo', () => {
    const changes: Action[] = [
      { type: 'add', ball: n('Ghost') },
      { type: 'remove', held: held(n('Wind')) },
      { type: 'takeOffer', ball: n('Light') },
      { type: 'newRun' },
      { type: 'apply', plan: readyPlan({ kind: 'fusion', balls: [n('Wind'), n('Nuclear Bomb')] }, applied.run.held) },
    ];
    for (const a of changes) {
      const s = step(applied, a);
      expect(s.undo === null || s.undo !== applied.undo, a.type).toBe(true);
      if (a.type !== 'apply') expect(s.undo, a.type).toBeNull();
    }
  });

  it('a second apply offers undo of that one only', () => {
    const p2 = readyPlan({ kind: 'fusion', balls: [n('Wind'), n('Nuclear Bomb')] }, applied.run.held);
    const s = step(applied, { type: 'apply', plan: p2 });
    expect(s.run.held).toEqual([fused(n('Wind'), n('Nuclear Bomb'))]);
    expect(s.undo?.before.held).toEqual(applied.run.held);
  });

  it('changes that leave what you hold alone keep undo', () => {
    const keep: Action[] = [
      { type: 'addOffer', ball: n('Ghost') },
      { type: 'removeOffer', ball: n('Light') },
      { type: 'clearOffers' },
      { type: 'open', id: tid('sun') },
      { type: 'close' },
      { type: 'setRecipe', ball: n('Virus'), recipe: 1 },
      { type: 'setSlots', slots: 5 },
      { type: 'togglePin', ball: n('Wind') },
      { type: 'add', ball: n('Wind') }, // already held: nothing changes
    ];
    for (const a of keep) expect(step(applied, a).undo, a.type).toBe(applied.undo);
  });

  it('applying a plan that is not ready is a no-op with no undo', () => {
    const partial = hs('Burn', 'Iron');
    const np = plan(cat, NB, { owned: partial, slots: 4 });
    expect(isReady(np)).toBe(false);
    const s = session({ held: partial, target: tid('nuclear-bomb') });
    const after = step(s, { type: 'apply', plan: np });
    expect(after.run).toEqual(s.run);
    expect(after.undo).toBeNull();
  });
});

describe('invariants under random actions', () => {
  it('pins stay on unfused held balls, offers off held balls', () => {
    // mulberry32: small seeded PRNG, so a failure replays the same way.
    let seed = 12345;
    const rand = (k: number) => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 2 ** 32) * k);
    };
    const pool = ['Burn', 'Iron', 'Poison', 'Light', 'Sun', 'Hemorrhage', 'Bleed', 'Ghost'].map(n);
    const pick = <T>(xs: readonly T[]) => xs[rand(xs.length)];
    const goals: Target[] = [
      NB,
      { kind: 'evolution', ball: n('Bomb') },
      { kind: 'evolution', ball: n('Sun') },
      { kind: 'evolution', ball: n('Hemorrhage') },
      { kind: 'fusion', balls: [n('Hemorrhage'), n('Sun')] },
      { kind: 'fusion', balls: [n('Ghost'), n('Burn')] },
    ];
    let s: Session = { run: emptyRun(4), undo: null };
    let applies = 0;
    let undos = 0;
    for (let i = 0; i < 300; i++) {
      let a: Action;
      switch (rand(12)) {
        case 0:
        case 1:
          a = { type: 'add', ball: pick(pool) };
          break;
        case 2:
          a = s.run.held.length ? { type: 'remove', held: pick(s.run.held) } : { type: 'clearOffers' };
          break;
        case 3:
          a = { type: 'togglePin', ball: pick(pool) };
          break;
        case 4:
          a = { type: 'addOffer', ball: pick(pool) };
          break;
        case 5:
          a = rand(2) ? { type: 'removeOffer', ball: pick(pool) } : { type: 'takeOffer', ball: pick(pool) };
          break;
        case 6:
          a = rand(2) ? { type: 'open', id: pick(targets).id as TargetId } : { type: 'close' };
          break;
        case 7:
        case 8:
        case 9: {
          // Mostly a plan that's ready right now, so the apply path actually runs.
          const plans = goals.map((g) => plan(cat, g, { owned: s.run.held, pinned: s.run.pinned, slots: 4 }));
          const ready = plans.filter(isReady);
          a = { type: 'apply', plan: ready.length && rand(4) ? pick(ready) : pick(plans) };
          break;
        }
        case 10:
          a = { type: 'undo' };
          break;
        default:
          a = rand(4) ? { type: 'setSlots', slots: 4 } : { type: 'newRun' };
      }
      const before = s;
      s = step(s, a);
      expectInvariants(s.run);
      if (a.type === 'apply' && isReady(a.plan)) {
        applies++;
        expect(s.undo?.before.held).toEqual(before.run.held);
      }
      if (a.type === 'undo' && before.undo) {
        undos++;
        expect(s.run.held).toEqual(before.undo.before.held);
      }
    }
    expect(applies).toBeGreaterThan(5);
    expect(undos).toBeGreaterThan(0);
  });
});
