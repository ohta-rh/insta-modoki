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

/**
 * Text color / background pairs used for body text. text-muted and link are for white (bg)
 * only: they are not listed on surface because they fall under 4.5:1 there.
 */
export const BODY_PAIRS: ReadonlyArray<readonly [TokenName, TokenName]> = [
  ['--color-text', '--color-bg'],
  ['--color-text-secondary', '--color-bg'],
  ['--color-text-secondary', '--color-surface'],
  ['--color-text-muted', '--color-bg'],
  ['--color-link', '--color-bg'],
];

export const pairRatio = (fg: TokenName, bg: TokenName): number =>
  contrastRatio(TOKENS[fg], TOKENS[bg]);
