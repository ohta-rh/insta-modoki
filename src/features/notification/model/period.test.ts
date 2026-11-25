import { describe, expect, it } from 'vitest';
import { groupByPeriod } from './period';
import type { NotificationView } from './schema';

// 2026-11-23 12:00 in Japan (03:00 UTC).
const NOW = Date.UTC(2026, 10, 23, 3, 0, 0);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const at = (id: string, ms: number): NotificationView => ({
  id,
  type: 'follow',
  actor: { username: 'haru', displayName: 'はる', avatarUrl: null },
  post: null,
  comment: null,
  read: true,
  createdAt: new Date(ms).toISOString(),
});
const ids = (groups: ReturnType<typeof groupByPeriod>) =>
  groups.map((g) => [g.period, g.items.map((i) => i.id)]);

describe('groupByPeriod', () => {
  it('通知を日本時間の今日・今週・今月・それ以前に分け、境目を正しく扱う', () => {
    const items = [
      at('now', NOW),
      // 00:00 in Japan on the same date is still today, though 12 hours back.
      at('midnight', Date.UTC(2026, 10, 22, 15, 0, 0)),
      // 23:59:59.999 the day before: not today.
      at('before-midnight', Date.UTC(2026, 10, 22, 14, 59, 59, 999)),
      at('seven', NOW - 7 * DAY),
      at('seven-plus', NOW - 7 * DAY - 1),
      at('thirty', NOW - 30 * DAY),
      at('thirty-plus', NOW - 30 * DAY - 1),
    ];
    expect(ids(groupByPeriod(items, NOW))).toEqual([
      ['今日', ['now', 'midnight']],
      ['今週', ['before-midnight', 'seven']],
      ['今月', ['seven-plus', 'thirty']],
      ['それ以前', ['thirty-plus']],
    ]);
  });

  it('空の期間は返さず、入力の順を保つ', () => {
    expect(groupByPeriod([], NOW)).toEqual([]);
    const items = [at('a', NOW - 40 * DAY), at('b', NOW - 50 * DAY)];
    expect(ids(groupByPeriod(items, NOW))).toEqual([['それ以前', ['a', 'b']]]);
  });

  it('日本時間の日付で今日を決める（UTC では前日でも日本では今日）', () => {
    // 2026-11-23 00:30 JST = 2026-11-22 15:30 UTC; now is 23:00 JST the same day.
    const now = Date.UTC(2026, 10, 23, 14, 0, 0);
    const item = at('early', Date.UTC(2026, 10, 22, 15, 30, 0));
    expect(ids(groupByPeriod([item], now))).toEqual([['今日', ['early']]]);
  });
});
