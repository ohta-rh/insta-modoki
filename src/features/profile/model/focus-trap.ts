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
