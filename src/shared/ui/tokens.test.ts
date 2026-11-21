import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOKENS } from './tokens';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function parseCssVariables(source: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const match of source.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    const name = match[1];
    if (!(name in vars)) vars[name] = match[2].trim().replace(/\s+/g, ' ');
  }
  return vars;
}

describe('tokens.css と tokens.ts', () => {
  it('tokens.css と tokens.ts の値が一致する', () => {
    const fromCss = parseCssVariables(css);
    expect(Object.keys(fromCss).sort()).toEqual(Object.keys(TOKENS).sort());
    for (const [name, value] of Object.entries(TOKENS)) {
      expect(fromCss[name], name).toBe(value);
    }
  });

  it('色の値は企画書のパレットと同じ', () => {
    expect(TOKENS).toMatchObject({
      '--color-bg': '#ffffff',
      '--color-surface': '#f4f6f9',
      '--color-text': '#111827',
      '--color-text-secondary': '#374151',
      '--color-text-muted': '#6b7280',
      '--color-border': '#e5e7eb',
      '--color-link': '#2b6cf6',
      '--color-teal': '#0bb8a9',
      '--color-indigo': '#4f46c8',
      '--color-coral': '#ff6b5e',
      '--gradient-window': 'linear-gradient(120deg, #0bb8a9, #2b6cf6 62%, #4f46c8)',
    });
  });

  it('余白・文字の大きさ・切り替えの幅・タップ領域の値がある', () => {
    const spaces = [4, 8, 12, 16, 24, 32, 48, 64];
    spaces.forEach((px, i) =>
      expect(TOKENS[`--space-${i + 1}` as keyof typeof TOKENS]).toBe(`${px}px`),
    );
    const fonts = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 };
    for (const [key, px] of Object.entries(fonts)) {
      expect(TOKENS[`--font-size-${key}` as keyof typeof TOKENS]).toBe(`${px}px`);
    }
    expect(TOKENS['--breakpoint-nav']).toBe('768px');
    expect(TOKENS['--tap-min']).toBe('44px');
    expect(TOKENS['--motion-fast']).toBe('150ms');
    expect(TOKENS['--font-family']).not.toMatch(/https?:/);
  });

  it('視差効果を減らす設定のとき --motion-fast が 0ms', () => {
    const block = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\{[^}]*\}/);
    expect(block?.[0]).toMatch(/--motion-fast:\s*0ms/);
  });
});
