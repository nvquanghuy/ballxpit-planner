// The game data, parsed once at load. A bad data file fails here, loudly, not somewhere in the UI.
import ballsFile from '../data/balls.json';
import targetsFile from '../../data/targets.json';
import rolesFile from '../../data/roles.json';
import { getBall } from './catalog';
import type { BallName } from './domain';
import { parseBalls, parseRoleTags, parseTargets } from './parse';

export const catalog = parseBalls(ballsFile);
export const targets = parseTargets(targetsFile.targets, catalog);
/** Researched role tags; your edits go on top (roleEdits.svelte.ts). */
export const researchedRoles = parseRoleTags((rolesFile as { balls: unknown }).balls, catalog);

export const allBalls = catalog.balls;
export const icon = (name: BallName) => getBall(catalog, name).img;
