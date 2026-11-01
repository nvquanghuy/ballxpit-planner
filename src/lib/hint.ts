// A small styled tooltip for tags: `use:hint={text}`. Quicker and easier to see than `title`,
// and a tap shows it on touch (except on buttons, where a tap is the action).
import type { Action } from 'svelte/action';

const SHOW_MS = 120;
const TAP_MS = 2500;

let box: HTMLDivElement | null = null;
let owner: HTMLElement | null = null;
let tapTimer: ReturnType<typeof setTimeout> | undefined;

function show(anchor: HTMLElement, text: string) {
  if (!text) return;
  if (!box) {
    box = document.createElement('div');
    box.className = 'taghint';
    box.setAttribute('role', 'tooltip');
    addEventListener('scroll', () => hide(), true);
  }
  owner = anchor;
  box.textContent = text;
  document.body.append(box);
  const a = anchor.getBoundingClientRect();
  const { offsetWidth: w, offsetHeight: h } = box;
  const above = a.top - h - 6;
  box.style.left = `${Math.max(8, Math.min(a.left + a.width / 2 - w / 2, innerWidth - w - 8))}px`;
  box.style.top = `${above < 8 ? a.bottom + 6 : above}px`;
}

function hide(anchor?: HTMLElement) {
  if (anchor && anchor !== owner) return;
  clearTimeout(tapTimer);
  box?.remove();
  owner = null;
}

export const hint: Action<HTMLElement, string> = (node, initial) => {
  let text = initial;
  let wait: ReturnType<typeof setTimeout> | undefined;
  const enter = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(wait);
    wait = setTimeout(() => show(node, text), SHOW_MS);
  };
  const leave = () => {
    clearTimeout(wait);
    hide(node);
  };
  // a finger lifting also fires pointerleave; a tapped hint times out instead
  const pointerLeave = (e: PointerEvent) => e.pointerType === 'mouse' && leave();
  const tap = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || node instanceof HTMLButtonElement) return;
    show(node, text);
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => hide(node), TAP_MS);
  };
  const focus = () => show(node, text);
  node.setAttribute('aria-label', `${node.textContent?.trim() ?? ''}: ${text}`);
  node.addEventListener('pointerenter', enter);
  node.addEventListener('pointerleave', pointerLeave);
  node.addEventListener('pointerdown', tap);
  node.addEventListener('focus', focus);
  node.addEventListener('blur', leave);
  return {
    update(v) {
      text = v;
      node.setAttribute('aria-label', `${node.textContent?.trim() ?? ''}: ${text}`);
      if (owner === node) show(node, text);
    },
    destroy() {
      leave();
      for (const [ev, fn] of [['pointerenter', enter], ['pointerleave', pointerLeave], ['pointerdown', tap], ['focus', focus], ['blur', leave]] as const)
        node.removeEventListener(ev, fn as EventListener);
    },
  };
};
