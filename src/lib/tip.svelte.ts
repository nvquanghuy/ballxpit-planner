// One shared ball popover: `use:balltip` on any anchor, <BallTip /> mounted once in App.
import type { Action } from 'svelte/action';
import type { BallName, Tier } from './domain';

/** Targets an offered ball moves forward, shown instead of its recipes. */
export interface TipDirection {
  label: string;
  tier: Tier;
  before: number;
  after: number;
}

type Balls = BallName | readonly BallName[];
export type TipArg = Balls | { balls: Balls; tap?: boolean; directions?: TipDirection[] };

export const tip = $state<{ names: BallName[]; anchor: HTMLElement | null; hover: boolean; directions: TipDirection[] | null }>({
  names: [],
  anchor: null,
  hover: false,
  directions: null,
});

export const openTip = (anchor: HTMLElement, names: BallName[], hover = false, directions: TipDirection[] | null = null) => {
  cancelClose();
  tip.anchor = anchor;
  tip.names = names;
  tip.hover = hover;
  tip.directions = directions;
};

export const closeTip = () => {
  cancelClose();
  tip.anchor = null;
  tip.names = [];
  tip.directions = null;
};

// A hover popover lingers briefly after the pointer leaves, so it can travel onto the panel.
const GRACE_MS = 200;
let closing: ReturnType<typeof setTimeout> | undefined;
export const cancelClose = () => clearTimeout(closing);
export const closeSoon = () => {
  clearTimeout(closing);
  closing = setTimeout(() => tip.hover && closeTip(), GRACE_MS);
};

const HOVER_MS = 250;
const PRESS_MS = 450;

const parse = (arg: TipArg) => {
  const o = typeof arg === 'object' && !Array.isArray(arg) ? (arg as Exclude<TipArg, Balls>) : { balls: arg as Balls };
  return {
    names: ([] as BallName[]).concat(o.balls),
    tap: !!o.tap,
    directions: 'directions' in o ? (o.directions ?? null) : null,
  };
};

export const balltip: Action<HTMLElement, TipArg> = (node, arg) => {
  let { names, tap, directions } = parse(arg);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let start: { x: number; y: number } | null = null;
  let suppress = false;
  const clear = () => {
    clearTimeout(timer);
    start = null;
  };

  const enter = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(timer);
    if (tip.anchor === node) return cancelClose();
    timer = setTimeout(() => openTip(node, names, true, directions), HOVER_MS);
  };
  const leave = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(timer);
    if (tip.anchor === node && tip.hover) closeSoon();
  };
  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    suppress = false;
    start = { x: e.clientX, y: e.clientY };
    clearTimeout(timer);
    timer = setTimeout(() => {
      start = null;
      suppress = true;
      setTimeout(() => (suppress = false), 800);
      openTip(node, names, false, directions);
    }, PRESS_MS);
  };
  const move = (e: PointerEvent) => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) clear();
  };
  const click = (e: MouseEvent) => {
    if (suppress) {
      suppress = false;
      e.preventDefault();
      e.stopPropagation();
    } else if (tap) {
      e.preventDefault();
      e.stopPropagation();
      if (tip.anchor === node && !tip.hover) closeTip();
      else openTip(node, names, false, directions);
    }
  };
  const menu = (e: Event) => {
    if (start || suppress) e.preventDefault();
  };

  const on = [
    ['pointerenter', enter],
    ['pointerleave', leave],
    ['pointerdown', down],
    ['pointermove', move],
    ['pointerup', clear],
    ['pointercancel', clear],
    ['contextmenu', menu],
  ] as const;
  for (const [t, f] of on) node.addEventListener(t, f as EventListener);
  node.addEventListener('click', click, true);
  node.classList.add('balltip');

  return {
    update(next) {
      ({ names, tap, directions } = parse(next));
      if (tip.anchor === node) {
        tip.names = names;
        tip.directions = directions;
      }
    },
    destroy() {
      clear();
      for (const [t, f] of on) node.removeEventListener(t, f as EventListener);
      node.removeEventListener('click', click, true);
      if (tip.anchor === node) closeTip();
    },
  };
};
