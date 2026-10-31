// Parsers at the edges: untyped JSON and text in, domain types out.
// Data files are ours, so a bad one throws with every problem listed. Stored edits are the
// user's, so those parsers drop bad entries instead.
import { asBall, fusionProblem, isBase, makeCatalog, type Catalog } from './catalog';
import { fused, held, TIERS, type Ball, type BallName, type Held, type TargetEntry, type TargetId, type Tier } from './domain';
import { ROLES, VS, type Role, type RoleTag, type Vs } from './roles';

export class ParseError extends Error {
  constructor(
    what: string,
    readonly problems: string[],
  ) {
    super(`${what}:\n  ${problems.join('\n  ')}`);
  }
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const strs = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

/** src/data/balls.json: every recipe must name balls that exist. */
export function parseBalls(raw: unknown): Catalog {
  const problems: string[] = [];
  if (!Array.isArray(raw)) throw new ParseError('balls', ['not a list']);
  const names = new Set<string>();
  for (const b of raw) {
    if (!isObj(b) || !isStr(b.name) || !b.name) problems.push(`not a ball: ${JSON.stringify(b)}`);
    else if (names.has(b.name)) problems.push(`duplicate ball "${b.name}"`);
    else names.add(b.name);
  }
  const balls: Ball[] = [];
  for (const b of raw.filter(isObj)) {
    if (!isStr(b.name)) continue;
    const parents = b.parents ?? [];
    if (!Array.isArray(parents) || !parents.every(strs)) {
      problems.push(`${b.name}: bad recipes`);
      continue;
    }
    for (const r of parents) {
      if (r.length < 2) problems.push(`${b.name}: recipe ${r.join(' + ')} has fewer than 2 balls`);
      for (const p of r) if (!names.has(p)) problems.push(`${b.name}: unknown ball "${p}" in a recipe`);
    }
    if (!isStr(b.img) || !isStr(b.description)) problems.push(`${b.name}: missing img or description`);
    balls.push({
      name: b.name as BallName,
      slug: isStr(b.slug) ? b.slug : '',
      description: isStr(b.description) ? b.description : '',
      img: isStr(b.img) ? b.img : '',
      ...(isStr(b.unlockRequirement) ? { unlockRequirement: b.unlockRequirement } : {}),
      damageType: strs(b.damageType) ? b.damageType : [],
      statusEffect: strs(b.statusEffect) ? b.statusEffect : [],
      parents: parents as BallName[][],
    });
  }
  if (problems.length) throw new ParseError('balls', problems);
  return makeCatalog(balls);
}

const isTier = (v: unknown): v is Tier => TIERS.includes(v as Tier);

/** data/targets.json `targets`: real balls, real fusions, unique ids. */
export function parseTargets(raw: unknown, cat: Catalog): TargetEntry[] {
  if (!Array.isArray(raw)) throw new ParseError('targets', ['not a list']);
  const problems: string[] = [];
  const out: TargetEntry[] = [];
  const ids = new Set<string>();
  for (const t of raw) {
    if (!isObj(t) || !isStr(t.id) || !t.id) {
      problems.push(`not a target: ${JSON.stringify(t)}`);
      continue;
    }
    const at = (p: string) => problems.push(`${t.id}: ${p}`);
    const before = problems.length;
    if (ids.has(t.id)) at('duplicate id');
    ids.add(t.id);
    if (!isTier(t.tier)) at(`bad tier ${String(t.tier)}`);
    if (!isStr(t.why)) at('missing why');
    if (t.effect !== undefined && !isStr(t.effect)) at('effect must be text');
    if (t.sources !== undefined && !strs(t.sources)) at('sources must be a list of links');
    const ball = (s: unknown) => {
      const n = isStr(s) ? asBall(cat, s) : null;
      if (!n) at(`unknown ball "${String(s)}"`);
      return n;
    };
    let target: TargetEntry | null = null;
    const common = {
      id: t.id as TargetId,
      tier: t.tier as Tier,
      why: t.why as string,
      ...(isStr(t.effect) ? { effect: t.effect } : {}),
      sources: strs(t.sources) ? t.sources : [],
      ...(t.unverified === true ? { unverified: true } : {}),
    };
    if (t.kind === 'evolution') {
      const b = ball(t.ball);
      if (b && isBase(cat, b)) at(`${b} is a base ball`);
      if (b) target = { ...common, kind: 'evolution', ball: b };
    } else if (t.kind === 'fusion') {
      if (!Array.isArray(t.balls) || t.balls.length !== 2) at('a fusion needs exactly 2 balls');
      else {
        const a = ball(t.balls[0]);
        const b = ball(t.balls[1]);
        const p = a && b && fusionProblem(cat, a, b);
        if (p) at(p);
        if (a && b) target = { ...common, kind: 'fusion', balls: [a, b] };
      }
    } else at(`bad kind ${String(t.kind)}`);
    if (target && problems.length === before) out.push(target);
  }
  if (problems.length) throw new ParseError('targets', problems);
  return out;
}

/** A held ball as written in the URL: "Burn", or "A ⊕ B" for a pair that may be fused. */
export function parseHeld(cat: Catalog, s: string): Held | null {
  const parts = s.split(' ⊕ ');
  if (parts.length === 1) {
    const n = asBall(cat, s);
    return n && held(n);
  }
  if (parts.length !== 2) return null;
  const [a, b] = parts.map((p) => asBall(cat, p));
  return a && b && !fusionProblem(cat, a, b) ? fused(a, b) : null;
}

const isRole = (r: unknown): r is Role => ROLES.includes(r as Role);
const isVs = (v: unknown): v is Vs => VS.includes(v as Vs);

/** Role tags (roles.json `balls`, or your saved edits): keeps known balls, roles and vs; drops the rest. */
export function parseRoleTags(raw: unknown, cat: Catalog): Partial<Record<BallName, RoleTag>> {
  const out: Partial<Record<BallName, RoleTag>> = {};
  if (!isObj(raw)) return out;
  for (const [name, v] of Object.entries(raw)) {
    const n = asBall(cat, name);
    if (!n || !isObj(v) || !Array.isArray(v.roles)) continue;
    const tag: RoleTag = { roles: [...new Set(v.roles.filter(isRole))] };
    if (isVs(v.vs)) tag.vs = v.vs;
    if (isStr(v.why) && v.why) tag.why = v.why;
    out[n] = tag;
  }
  return out;
}
