import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../../../shared/ui/contrast';
import { TOKENS } from '../../../shared/ui/tokens';
import type { StoryTrayView } from '../api/list-story-tray';
import { StoryTray } from './StoryTray';

const user = (username: string) => ({ username, displayName: username, avatarUrl: null });
const view = (over: Partial<StoryTrayView> = {}): StoryTrayView => ({
  me: user('me'),
  hasOwn: false,
  items: [
    { user: user('bob'), hasUnseen: true, latestAt: '2026-01-01T00:00:00.000Z' },
    { user: user('cat'), hasUnseen: false, latestAt: '2026-01-01T00:00:00.000Z' },
  ],
  ...over,
});
const render = (v: StoryTrayView | null) => renderToStaticMarkup(<StoryTray view={v} />);

describe('StoryTray', () => {
  it('未視聴と視聴済みを読み上げの名前で区別する', () => {
    const html = render(view({ hasOwn: true }));
    expect(html).toContain('>bobのストーリー（未視聴）<');
    expect(html).toContain('>catのストーリー（視聴済み）<');
    expect(html).toContain('>あなたのストーリー<');
    expect(html).toContain('>ストーリーを追加<');
    expect(html).toContain('<nav aria-label="ストーリー"');
  });

  it('先頭が追加ボタンで、続けて自分、未読、既読の順に並ぶ', () => {
    const html = render(view({ hasOwn: true }));
    const order = ['ストーリーを追加', 'あなたのストーリー', 'bobの', 'catの'].map((s) =>
      html.indexOf(s),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(html).toContain('href="/stories/create"');
    expect(html).toContain('href="/stories/bob"');
  });

  it('view が null のときは追加ボタンだけを描く', () => {
    const html = render(null);
    expect(html).toContain('>ストーリーを追加<');
    expect(html).not.toContain('href="/stories/bob"');
  });

  it('リングの色のコントラストが 3:1 以上', () => {
    for (const color of ['--color-indigo', '--color-link', '--color-icon-secondary'] as const) {
      expect(contrastRatio(TOKENS[color], TOKENS['--color-bg']), color).toBeGreaterThanOrEqual(3);
    }
    const html = render(view());
    expect(html).toContain(
      'conic-gradient(var(--color-indigo), var(--color-link), var(--color-indigo))',
    );
    expect(html).toContain('var(--color-icon-secondary)');
    expect(html).not.toContain('--color-border');
  });
});
