import type { NotificationView } from './schema';

export type Period = '今日' | '今週' | '今月' | 'それ以前';

const DAY = 24 * 3_600_000;
const ORDER: Period[] = ['今日', '今週', '今月', 'それ以前'];

// The zone is fixed so the server and the browser draw the same boundaries.
const jstDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function periodOf(createdAt: number, now: number): Period {
  if (jstDate.format(createdAt) === jstDate.format(now)) return '今日';
  const age = now - createdAt;
  if (age <= 7 * DAY) return '今週';
  if (age <= 30 * DAY) return '今月';
  return 'それ以前';
}

/** Splits notifications (newest first) by age in Japan time; empty periods are left out. */
export function groupByPeriod(
  items: NotificationView[],
  now: number,
): { period: Period; items: NotificationView[] }[] {
  const buckets = new Map<Period, NotificationView[]>();
  for (const item of items) {
    const period = periodOf(Date.parse(item.createdAt), now);
    buckets.set(period, [...(buckets.get(period) ?? []), item]);
  }
  return ORDER.flatMap((period) => {
    const list = buckets.get(period);
    return list ? [{ period, items: list }] : [];
  });
}
