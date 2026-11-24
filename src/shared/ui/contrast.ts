import { TOKENS, type TokenName } from './tokens';

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio of two `#rgb` / `#rrggbb` colors (1..21). */
export function contrastRatio(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** WCAG AA for body text. */
export const meetsAA = (ratio: number): boolean => ratio >= 4.5;

/** WCAG 1.4.11 for graphics and input borders. */
export const meetsNonText = (ratio: number): boolean => ratio >= 3;

/**
 * Text color / background pairs used for body text. text-secondary is for bg and wash only:
 * it is not listed on surface or highlight because it falls under 4.5:1 there (4.34, 4.12).
 */
export const BODY_PAIRS: ReadonlyArray<readonly [TokenName, TokenName]> = [
  ['--color-text', '--color-bg'],
  ['--color-text', '--color-surface'],
  ['--color-text', '--color-highlight'],
  ['--color-text-secondary', '--color-bg'],
  ['--color-text-secondary', '--color-wash'],
  ['--color-link', '--color-bg'],
  ['--color-danger', '--color-bg'],
  ['--color-danger-on-surface', '--color-surface'],
  ['--color-bg', '--color-indigo'],
];

/** Shapes that carry meaning (not text): at least 3:1 on the page background. */
export const NON_TEXT_PAIRS: ReadonlyArray<readonly [TokenName, TokenName]> = [
  ['--color-like', '--color-bg'],
  ['--color-icon-secondary', '--color-bg'],
  ['--color-input-border', '--color-bg'],
];

export const pairRatio = (fg: TokenName, bg: TokenName): number =>
  contrastRatio(TOKENS[fg], TOKENS[bg]);
