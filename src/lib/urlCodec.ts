// The run lives in the URL hash so it can be bookmarked. Pure text <-> fields; parseRun (run.ts) types them.
export interface UrlFields {
  slots: number | null;
  owned: string[];
  pinned: string[];
  target: string | null;
  overrides: Record<string, number>;
  offers: string[];
}

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);

/** `location.hash`, with or without the leading '#'. */
export function decodeHash(hash: string): UrlFields {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const slots = Number(q.get('slots'));
  const overrides: Record<string, number> = {};
  for (const pair of list(q.get('r'))) {
    const [name, i] = pair.split(':');
    if (name && i && Number.isInteger(Number(i))) overrides[name] = Number(i);
  }
  return {
    slots: Number.isInteger(slots) && slots > 0 ? slots : null,
    owned: list(q.get('owned')),
    pinned: list(q.get('pinned')),
    // fusion ids contain '+', which URLSearchParams decodes as a space
    target: q.get('target')?.replaceAll(' ', '+') || null,
    overrides,
    offers: list(q.get('offer')),
  };
}

/** The hash text, without '#'. */
export function encodeHash(f: UrlFields): string {
  const q = new URLSearchParams();
  if (f.slots) q.set('slots', String(f.slots));
  if (f.owned.length) q.set('owned', f.owned.join(','));
  if (f.pinned.length) q.set('pinned', f.pinned.join(','));
  if (f.target) q.set('target', f.target);
  if (f.offers.length) q.set('offer', f.offers.join(','));
  const r = Object.entries(f.overrides).map(([k, v]) => `${k}:${v}`);
  if (r.length) q.set('r', r.join(','));
  return q.toString();
}
