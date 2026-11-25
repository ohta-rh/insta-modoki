import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { charLength } from '../../../shared/text';
import { notificationText } from '../model/notification-text';
import type { NotificationView } from '../model/schema';
import { NotificationItem } from './NotificationItem';

const NOW = Date.UTC(2026, 10, 1, 2, 0, 0);
const cover = {
  type: 'image' as const,
  width: 10,
  height: 10,
  altText: '海の写真',
  thumbhash: 'x',
  srcset: {
    w320: 'https://m/a/w320.webp',
    w640: 'https://m/a/w640.webp',
    w1080: 'https://m/a/w1080.webp',
  },
};
const view = (over: Partial<NotificationView>): NotificationView => ({
  id: 'n1',
  type: 'like',
  actor: { username: 'haru', displayName: 'はる', avatarUrl: null },
  post: { id: 'p1', cover },
  comment: null,
  read: false,
  createdAt: new Date(NOW - 2 * 3_600_000).toISOString(),
  ...over,
});
const render = (v: NotificationView) =>
  renderToStaticMarkup(
    <ul>
      <NotificationItem view={v} now={NOW} />
    </ul>,
  );

describe('NotificationItem', () => {
  it('種類ごとの文言とリンクと画像を出す', () => {
    const like = render(view({}));
    // The name leads the sentence in semibold; the rest follows it directly.
    expect(like).toContain(
      '<span class="font-semibold">はる</span>さんがあなたの投稿にいいねしました',
    );
    expect(like).toContain('href="/p/p1"');
    expect(like).toContain('alt="海の写真"');
    expect(like).toContain('新着');
    expect(like).toContain('<time dateTime="2026-11-01T00:00:00.000Z">2時間前</time>');
    expect(like.match(/<a /g)).toHaveLength(1);

    const comment = render(
      view({ type: 'comment', comment: { id: 'c1', body: 'すてき', truncated: false } }),
    );
    expect(comment).toContain(
      '<span class="font-semibold">はる</span>さんがコメントしました: すてき',
    );
    expect(comment).toContain('href="/p/p1"');
    expect(comment).toContain('alt="海の写真"');

    const follow = render(view({ type: 'follow', post: null, read: true }));
    expect(follow).toContain(
      '<span class="font-semibold">はる</span>さんがあなたをフォローしました',
    );
    expect(follow).toContain('href="/haru"');
    expect(follow).not.toContain('<img');
    expect(follow).not.toContain('新着');
  });

  it('100 字ちょうどはそのまま、101 字は 100 字と…にする', () => {
    const exact = notificationText(
      view({ type: 'comment', comment: { id: 'c', body: 'あ'.repeat(100), truncated: false } }),
    );
    expect(exact.endsWith('あ')).toBe(true);
    // The server cuts at 100 and sets truncated; the sentence then ends with the mark.
    const cut = notificationText(
      view({ type: 'comment', comment: { id: 'c', body: 'あ'.repeat(100), truncated: true } }),
    );
    expect(cut.endsWith('…')).toBe(true);
    expect(charLength(cut.split(': ')[1]!)).toBe(101);
  });
});
