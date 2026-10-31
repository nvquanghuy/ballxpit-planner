// Snapshot ball data + icons from https://ballxpit-evolution.github.io/
// Usage: npm run sync-data
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://ballxpit-evolution.github.io/';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_OUT = join(ROOT, 'src/data/balls.json');
const ICON_DIR = join(ROOT, 'public/balls');

const fetchText = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
};

export const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Walk the JS module graph from the page's scripts until we find the chunk
// holding the ball list (a JSON.parse payload with "unlockRequirement").
async function findBallData() {
  const html = await fetchText(SITE);
  const queue = [...html.matchAll(/(?:href|import\()\s*=?\s*["']([^"']+\.js)["']/g)].map((m) => new URL(m[1], SITE).href);
  const seen = new Set();
  while (queue.length) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const js = await fetchText(url);
    for (const m of js.matchAll(/JSON\.parse\(`([\s\S]*?)`\)/g)) {
      if (!m[1].includes('unlockRequirement')) continue;
      const list = JSON.parse(m[1]);
      if (Array.isArray(list) && list.some((b) => b.name && b.img)) return list;
    }
    for (const m of js.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+\.js)["']/g)) queue.push(new URL(m[1], url).href);
  }
  throw new Error('ball data chunk not found');
}

const raw = await findBallData();
const names = new Set(raw.map((b) => b.name));
const balls = raw.map((b) => {
  for (const p of (b.parents ?? []).flat()) if (!names.has(p)) throw new Error(`unknown parent "${p}" of ${b.name}`);
  return {
    name: b.name,
    slug: slug(b.name),
    description: b.description,
    img: `balls/${slug(b.name)}.jpg`,
    parents: b.parents?.length ? b.parents : undefined,
    unlockRequirement: b.unlockRequirement,
    damageType: b.damageType ?? [],
    statusEffect: b.statusEffect ?? [],
  };
});

const base = balls.filter((b) => !b.parents).length;
console.log(`balls: ${balls.length} (${base} base, ${balls.length - base} evolved)`);
if (balls.length < 90) throw new Error('expected at least 90 balls — site format changed?');

await mkdir(dirname(DATA_OUT), { recursive: true });
await writeFile(DATA_OUT, JSON.stringify(balls, null, 2) + '\n');

await mkdir(ICON_DIR, { recursive: true });
let missing = 0;
await Promise.all(raw.map(async (b) => {
  const res = await fetch(new URL(encodeURIComponent(b.img), SITE));
  if (!res.ok) { missing++; console.warn(`icon missing: ${b.name} (${res.status})`); return; }
  await writeFile(join(ICON_DIR, `${slug(b.name)}.jpg`), Buffer.from(await res.arrayBuffer()));
}));
console.log(`icons: ${raw.length - missing}/${raw.length} → public/balls/`);
if (missing) process.exitCode = 1;
