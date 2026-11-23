import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TOKENS } from './tokens';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const globals = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');

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

  it('色のトークンが参照の Web 版の値（自前の主の色・いいねの赤を除く）になっている', () => {
    expect(TOKENS).toMatchObject({
      '--color-bg': '#ffffff',
      '--color-surface': '#f3f5f7',
      '--color-highlight': '#efefef',
      '--color-wash': '#fafafa',
      '--color-text': '#000000',
      '--color-text-secondary': '#737373',
      '--color-icon': '#262626',
      '--color-icon-secondary': '#737373',
      '--color-border': '#dbdbdb',
      '--color-input-border': '#8e8e8e',
      '--color-link': '#4f46c8',
      '--color-indigo': '#4f46c8',
      '--color-danger': '#d62d3c',
      '--color-like': '#f2545b',
      '--color-teal': '#0bb8a9',
      '--color-coral': '#ff6b5e',
      '--gradient-window': 'linear-gradient(120deg, #0bb8a9, #2b6cf6 62%, #4f46c8)',
    });
    expect(TOKENS).not.toHaveProperty('--color-text-muted');
  });

  it('骨格の幅と境目のトークンが参照の Web 版の値になっている', () => {
    expect(TOKENS).toMatchObject({
      '--nav-wide-width': '244px',
      '--nav-narrow-width': '72px',
      '--bottom-nav-height': '50px',
      '--mobile-top-bar-height': '45px',
      '--public-top-bar-height': '60px',
      '--feed-width': '470px',
      '--feed-item-gap': '20px',
      '--content-max': '630px',
      '--aside-width': '319px',
      '--aside-gap': '64px',
      '--site-width-wide': '935px',
      '--post-aside-width': '335px',
      '--side-panel-width': '397px',
      '--breakpoint-nav': '768px',
      '--breakpoint-aside': '1160px',
      '--breakpoint-nav-wide': '1264px',
    });
  });

  it('文字・角丸・影・動きのトークンが決めた値になっている', () => {
    expect(TOKENS).toMatchObject({
      '--font-family':
        "-apple-system, system-ui, 'Segoe UI', Roboto, Helvetica, Arial, 'Noto Sans JP', sans-serif",
      '--leading-xs': '16px',
      '--leading-sm': '18px',
      '--leading-md': '24px',
      '--leading-lg': '25px',
      '--leading-xl': '30px',
      '--radius-pill': '22px',
      '--shadow-panel': '0 4px 32px 0 rgba(11, 16, 20, 0.16)',
      '--ease-move-in': 'cubic-bezier(0.17, 0.17, 0, 1)',
      '--motion-panel': '200ms',
    });
    const block = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\{[^}]*\}/);
    expect(block?.[0]).toMatch(/--motion-panel:\s*0ms/);
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

  it('body の行の高さは絶対値で、文字の大きさを自分で決める部品には対の行の高さが付く', () => {
    expect(globals).toMatch(/body\s*\{[^}]*line-height:\s*var\(--leading-sm\)/);
    for (const size of ['xs', 'sm', 'md', 'lg', 'xl']) {
      const rule = `[class~='text-[length:var(--font-size-${size})]'] { line-height: var(--leading-${size}); }`;
      expect(globals.replace(/\s+/g, ' '), size).toContain(rule.replace(/\s+/g, ' '));
    }
  });
});
