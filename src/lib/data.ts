import balls from '../data/balls.json';
import targetsFile from '../../data/targets.json';
import rolesFile from '../../data/roles.json';
import { Catalog } from './planner';
import type { TargetEntry } from './targets';
import { sanitizeRoles } from './roles';

export type BallInfo = (typeof balls)[number];

export const catalog = new Catalog(balls);
export const ballInfo = new Map<string, BallInfo>(balls.map((b) => [b.name, b]));
export const allBalls = balls;
export const targets = targetsFile.targets as TargetEntry[];
/** Researched role tags; your edits go on top (roleEdits.svelte.ts). */
export const researchedRoles = sanitizeRoles((rolesFile as unknown as { balls: unknown }).balls, (n) => ballInfo.has(n));

export const icon = (name: string) => ballInfo.get(name)?.img ?? '';
