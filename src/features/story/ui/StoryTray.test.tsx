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

  it('未読の輪は自前のグラデーション、見た人は 1px の灰色の輪で、名前にも状態が出る', () => {
    const html = render(view());
    const rings = [...html.matchAll(/<span aria-hidden="true"[^>]*data-story-ring[^>]*>/g)].map(
      (m) => m[0],
    );
    // The first ring is the add button's; the people's carry their state as a style.
    expect(rings).toHaveLength(3);
    rings.shift();
    expect(rings[0]).toContain('background:var(--gradient-window)');
    expect(rings[0]).not.toContain('conic-gradient');
    expect(rings[1]).toContain('box-shadow:inset 0 0 0 1px var(--color-border)');
    expect(rings[1]).not.toContain('--gradient-window');
    expect(html).not.toContain('#2b6cf6');
    expect(html).toContain('>bobのストーリー（未視聴）<');
    expect(html).toContain('>catのストーリー（視聴済み）<');
  });

  it('リングの図形の色（インディゴ・青・補助のアイコン）は白の上で 3:1 以上', () => {
    for (const color of [
      TOKENS['--color-indigo'],
      TOKENS['--color-blue'],
      TOKENS['--color-icon-secondary'],
    ]) {
      expect(contrastRatio(color, TOKENS['--color-bg']), color).toBeGreaterThanOrEqual(3);
    }
  });
});
