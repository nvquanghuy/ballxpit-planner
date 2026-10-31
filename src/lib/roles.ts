// Ball roles: what a ball does in a line-up. Researched tags (data/roles.json) + your edits on top.
// Parsing lives in parse.ts (parseRoleTags).
import type { BallName, Held } from './domain';

export const ROLES = ['enabler', 'babymaker', 'effect', 'executioner', 'hitter', 'control', 'sustain', 'amplifier'] as const;
export type Role = (typeof ROLES)[number];
export const VS = ['waves', 'bosses', 'both'] as const;
export type Vs = (typeof VS)[number];

export const ROLE_INFO: Record<Role, string> = {
  enabler: "makes a partner's on-hit effect land on far more enemies (screen pulses, hits everything)",
  babymaker: "spawns baby balls that carry the partner's effect",
  effect: "on-hit status/proc that gets stronger the more it's applied",
  executioner: 'instakill chance or %-HP damage; boss killers',
  hitter: 'big direct damage on its own',
  control: 'freeze, slow, blind, charm, stop time',
  sustain: 'healing or lifesteal',
  amplifier: 'makes enemies take more damage, boosting other balls',
};

export interface RoleTag {
  /** Most important first. */
  roles: Role[];
  vs?: Vs;
  why?: string;
}

/** Tag for one ball, or undefined when untagged. */
export type RoleLookup = (name: BallName) => RoleTag | undefined;
export type RoleTags = Partial<Record<BallName, RoleTag>>;

/** Your edit wins over the researched tag; the researched `why` is kept. */
export const lookupWith =
  (base: RoleTags, edits: RoleTags): RoleLookup =>
  (name) => {
    const e = edits[name];
    return e ? { ...e, why: base[name]?.why } : base[name];
  };

/** Waves + bosses cover both. */
export function mergeVs(vs: (Vs | undefined)[]): Vs | undefined {
  const w = vs.some((v) => v === 'waves' || v === 'both');
  const b = vs.some((v) => v === 'bosses' || v === 'both');
  return w && b ? 'both' : w ? 'waves' : b ? 'bosses' : undefined;
}

/** Tag of a held ball; a fused ball gets the union of its parts, in display order. */
export function tagOf(h: Held, lookup: RoleLookup): RoleTag | undefined {
  if (h.kind === 'ball') return lookup(h.name);
  const parts = h.parts.map(lookup).filter((t) => !!t);
  if (!parts.length) return undefined;
  const has = new Set(parts.flatMap((t) => t.roles));
  return { roles: ROLES.filter((r) => has.has(r)), vs: mergeVs(parts.map((t) => t.vs)) };
}

/** Grid filter: no roles picked = everything; otherwise any picked role. */
export const hasAnyRole = (name: BallName, picked: Role[], lookup: RoleLookup) =>
  !picked.length || !!lookup(name)?.roles.some((r) => picked.includes(r));

export interface BuildSummary {
  counts: { role: Role; n: number }[];
  /** Short hints for gaps that matter. */
  missing: string[];
  untagged: number;
}

/** Roles present across held balls (fused count once, as their union) and the gaps worth knowing. */
export function summarize(owned: readonly Held[], lookup: RoleLookup): BuildSummary {
  const tags = owned.map((n) => tagOf(n, lookup));
  const known = tags.filter((t) => !!t);
  const n = (r: Role) => known.filter((t) => t.roles.includes(r)).length;
  const counts = ROLES.map((role) => ({ role, n: n(role) })).filter((c) => c.n);
  const missing: string[] = [];
  if (known.length) {
    if (!n('enabler') && !n('babymaker')) missing.push('no enabler/babymaker');
    if (!n('effect') && !n('executioner')) missing.push('no effect/executioner');
    if (!n('sustain')) missing.push('no sustain');
    const vs = mergeVs(known.map((t) => t.vs));
    if (vs === 'waves') missing.push('weak vs bosses');
    if (vs === 'bosses') missing.push('weak vs waves');
  }
  return { counts, missing, untagged: tags.length - known.length };
}

const SPREAD: Role[] = ['enabler', 'babymaker'];
const PAYLOAD: Role[] = ['effect', 'executioner'];

/** "enabler + effect" when one part spreads and the other carries the payload (the top-fusion pattern). */
export function comboOf(a: BallName, b: BallName, lookup: RoleLookup): string | null {
  const ra = lookup(a)?.roles ?? [];
  const rb = lookup(b)?.roles ?? [];
  const pair = (x: Role[], y: Role[]) => {
    const s = x.find((r) => SPREAD.includes(r));
    const p = y.find((r) => PAYLOAD.includes(r));
    return s && p ? `${s} + ${p}` : null;
  };
  return pair(ra, rb) ?? pair(rb, ra);
}
