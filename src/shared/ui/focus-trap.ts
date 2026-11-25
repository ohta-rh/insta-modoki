/**
 * Where a Tab press must send the focus to keep it inside a modal, or null to let the browser move
 * it. `items` are the modal's focusable elements in order and `active` the focused one (or any
 * value outside the list). Generic so it can be tested without a DOM.
 */
export function wrapFocus<T>(items: T[], active: T | null, shift: boolean): T | null {
  const first = items[0];
  const last = items[items.length - 1];
  if (first === undefined || last === undefined) return null;
  const index = active === null ? -1 : items.indexOf(active);
  if (index === -1) return shift ? last : first;
  if (shift && index === 0) return last;
  if (!shift && index === items.length - 1) return first;
  return null;
}

/** What a focus trap uses of a modal: its focusable descendants and whether it holds an element. */
export type TrapContainer = {
  querySelectorAll(selector: string): ArrayLike<HTMLElement>;
  contains(node: Node | null): boolean;
};

export type TabKeyEvent = { key: string; shiftKey: boolean; preventDefault(): void };

export const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Keydown handler body for a modal: on Tab / Shift+Tab at the edge of `container`, moves the focus
 * to the other edge so it never leaves. Returns true when it moved the focus (and so called
 * `preventDefault`). Hidden elements are skipped.
 */
export function trapTab(
  e: TabKeyEvent,
  container: TrapContainer,
  active: HTMLElement | null = document.activeElement as HTMLElement | null,
): boolean {
  if (e.key !== 'Tab') return false;
  const items = Array.from(container.querySelectorAll(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0,
  );
  const target = wrapFocus(items, active && container.contains(active) ? active : null, e.shiftKey);
  if (!target) return false;
  e.preventDefault();
  target.focus();
  return true;
}
