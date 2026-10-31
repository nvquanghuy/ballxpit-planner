import balls from '../data/balls.json';
import targetsFile from '../../data/targets.json';
import { Catalog } from './planner';
import type { TargetEntry } from './targets';

export type BallInfo = (typeof balls)[number];

export const catalog = new Catalog(balls);
export const ballInfo = new Map<string, BallInfo>(balls.map((b) => [b.name, b]));
export const allBalls = balls;
export const targets = targetsFile.targets as TargetEntry[];

export const icon = (name: string) => ballInfo.get(name)?.img ?? '';
