const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
/** Dates are written in Japan time, the audience's own calendar. */
const JST_OFFSET = 9 * HOUR;

/** "たった今", "2時間前", "3週間前"; four weeks and older become a date ("10月1日", "2025年3月5日"). */
export function formatRelativeTime(date: Date, now: number): string {
  const diff = now - date.getTime();
  if (diff < MINUTE) return 'たった今';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}分前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}時間前`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}日前`;
  if (diff < 4 * WEEK) return `${Math.floor(diff / WEEK)}週間前`;
  const at = new Date(date.getTime() + JST_OFFSET);
  const thisYear = new Date(now + JST_OFFSET).getUTCFullYear();
  const md = `${at.getUTCMonth() + 1}月${at.getUTCDate()}日`;
  return at.getUTCFullYear() === thisYear ? md : `${at.getUTCFullYear()}年${md}`;
}
