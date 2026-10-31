// App state lives in the URL hash so a run can be bookmarked.
export interface UrlState {
  slots: number | null;
  owned: string[];
  pinned: string[];
  target: string | null;
  overrides: Record<string, number>;
  offers: string[];
}

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);

export function readHash(): UrlState {
  const q = new URLSearchParams(location.hash.slice(1));
  const slots = Number(q.get('slots'));
  const overrides: Record<string, number> = {};
  for (const pair of list(q.get('r'))) {
    const [name, i] = pair.split(':');
    if (name && !Number.isNaN(Number(i))) overrides[name] = Number(i);
  }
  return {
    slots: slots > 0 ? slots : null,
    owned: list(q.get('owned')),
    pinned: list(q.get('pinned')),
    // fusion ids contain '+', which URLSearchParams decodes as a space
    target: q.get('target')?.replaceAll(' ', '+') ?? null,
    overrides,
    offers: list(q.get('offer')),
  };
}

export function writeHash(s: UrlState) {
  const q = new URLSearchParams();
  if (s.slots) q.set('slots', String(s.slots));
  if (s.owned.length) q.set('owned', s.owned.join(','));
  if (s.pinned.length) q.set('pinned', s.pinned.join(','));
  if (s.target) q.set('target', s.target);
  if (s.offers.length) q.set('offer', s.offers.join(','));
  const r = Object.entries(s.overrides).map(([k, v]) => `${k}:${v}`);
  if (r.length) q.set('r', r.join(','));
  history.replaceState(null, '', `#${q.toString()}`);
}
