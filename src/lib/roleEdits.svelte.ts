// Your role edits: overrides on top of data/roles.json, kept in localStorage.
import { researchedRoles } from './data';
import type { Target } from './planner';
import { comboOf, lookupWith, sanitizeRoles, type RoleLookup, type RoleTag } from './roles';

const KEY = 'pit-planner.roleEdits';

const load = (): Record<string, RoleTag> => {
  try {
    return sanitizeRoles(JSON.parse(localStorage.getItem(KEY) ?? '{}'));
  } catch {
    return {};
  }
};

export const roleEdits = $state<Record<string, RoleTag>>(load());

const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify($state.snapshot(roleEdits)));
  } catch {
    // private mode or full storage: edits last for this visit only
  }
};

/** Effective tag for a ball name (reactive: reads your edits). */
export const roleOf: RoleLookup = (name) => lookupWith(researchedRoles, roleEdits)(name);

/** "enabler + effect" style hint for a fusion target, else null. */
export const comboFor = (t: Target) => (t.kind === 'fusion' ? comboOf(t.balls[0], t.balls[1], roleOf) : null);

export const setRoles = (name: string, tag: Pick<RoleTag, 'roles' | 'vs'>) => {
  roleEdits[name] = { roles: [...tag.roles], ...(tag.vs ? { vs: tag.vs } : {}) };
  save();
};

export const resetRoles = (name: string) => {
  delete roleEdits[name];
  save();
};

/** All edits as JSON in the roles.json `balls` shape, ready to merge. */
export const exportEdits = () => JSON.stringify($state.snapshot(roleEdits), null, 2);
