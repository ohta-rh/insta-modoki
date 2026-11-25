import { expect, type Locator } from '@playwright/test';

/** The three widths the reference UI is measured at (docs/research/web-ui-reference.md). */
export const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  narrow: { width: 1024, height: 768 },
  wide: { width: 1280, height: 800 },
} as const;

export type Rect = { x: number; y: number; width: number; height: number };

/** `getBoundingClientRect()` of the element, in CSS px. */
export function rect(locator: Locator): Promise<Rect> {
  return locator.evaluate((el) => {
    const { x, y, width, height } = el.getBoundingClientRect();
    return { x, y, width, height };
  });
}

/** `getComputedStyle()` values of the given properties (kebab-case names). */
export function styles(locator: Locator, props: string[]): Promise<Record<string, string>> {
  return locator.evaluate((el, names) => {
    const computed = getComputedStyle(el);
    return Object.fromEntries(names.map((name) => [name, computed.getPropertyValue(name)]));
  }, props);
}

/** Within 1px of the reference value; the failure message names what was measured. */
export function expectPx(actual: number, expected: number, label: string): void {
  expect(Math.abs(actual - expected) <= 1, `${label}: ${actual}px（参照 ${expected}px ±1）`).toBe(
    true,
  );
}
