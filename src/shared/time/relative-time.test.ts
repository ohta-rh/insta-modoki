import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './relative-time';

const NOW = Date.parse('2026-11-21T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('formatRelativeTime', () => {
  it.each([
    [0, 'たった今'],
    [59_000, 'たった今'],
    [60_000, '1分前'],
    [59 * MIN, '59分前'],
    [HOUR, '1時間前'],
    [2 * HOUR, '2時間前'],
    [23 * HOUR + 59 * MIN, '23時間前'],
    [DAY, '1日前'],
    [6 * DAY, '6日前'],
    [7 * DAY, '1週間前'],
    [27 * DAY, '3週間前'],
  ])('%i ミリ秒前のとき「%s」を返す', (ms, text) => {
    expect(formatRelativeTime(ago(ms), NOW)).toBe(text);
  });

  it('4 週間より前は日付を返し 去年以前は年も付ける', () => {
    expect(formatRelativeTime(new Date('2026-10-01T03:00:00.000Z'), NOW)).toBe('10月1日');
    expect(formatRelativeTime(new Date('2025-03-05T03:00:00.000Z'), NOW)).toBe('2025年3月5日');
  });

  it('未来の時刻は たった今 にする', () => {
    expect(formatRelativeTime(new Date(NOW + 5 * MIN), NOW)).toBe('たった今');
  });
});
