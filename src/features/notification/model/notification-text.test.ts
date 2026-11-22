import { describe, expect, it } from 'vitest';
import type { NotificationView } from './schema';
import { badgeAccessibleText, badgeText, notificationText } from './notification-text';

const base: NotificationView = {
  id: 'n1',
  type: 'like',
  actor: { username: 'haru', displayName: 'はる', avatarUrl: null },
  post: { id: 'p1', cover: null },
  comment: null,
  read: false,
  createdAt: '2026-11-01T00:00:00.000Z',
};

describe('notificationText', () => {
  it('種類ごとの文言を作る', () => {
    expect(notificationText(base)).toBe('はるさんがあなたの投稿にいいねしました');
    expect(
      notificationText({
        ...base,
        type: 'comment',
        comment: { id: 'c1', body: 'すてき', truncated: false },
      }),
    ).toBe('はるさんがコメントしました: すてき');
    expect(notificationText({ ...base, type: 'follow', post: null })).toBe(
      'はるさんがあなたをフォローしました',
    );
  });

  it('切り詰められたコメントの末尾に … を付ける', () => {
    const text = notificationText({
      ...base,
      type: 'comment',
      comment: { id: 'c1', body: 'あ'.repeat(100), truncated: true },
    });
    expect(text.endsWith(`${'あ'.repeat(100)}…`)).toBe(true);
  });
});

describe('バッジの文字', () => {
  it('99 件までは数、100 件は 99+ と出し、名前に未読の数を含める', () => {
    expect(badgeText(0)).toBe('');
    expect(badgeText(1)).toBe('1');
    expect(badgeText(99)).toBe('99');
    expect(badgeText(100)).toBe('99+');
    expect(badgeAccessibleText(0)).toBe('');
    expect(badgeAccessibleText(1)).toBe('（未読 1 件）');
    expect(badgeAccessibleText(99)).toBe('（未読 99 件）');
    expect(badgeAccessibleText(100)).toBe('（未読 99 件以上）');
  });
});
