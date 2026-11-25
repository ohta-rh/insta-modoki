import { UNREAD_COUNT_CAP } from './constants';

// The unread-count stream (ADR-0050). Pure and free of zod: the browser bundle imports it.
export const STREAM_TICK_MS = 3000;
export const STREAM_PING_MS = 15000;
export const STREAM_WINDOW_MS = 60000;
export const STREAM_RETRY_MS = 1000;

export const PING_LINE = ': ping\n\n';

export const encodeUnreadEvent = (count: number): string =>
  `event: unread\ndata: {"unreadCount":${count}}\n\n`;

/** The count in an `unread` event's data, or null for anything that is not an integer 0..100. */
export function parseUnreadEvent(data: string): number | null {
  try {
    const n = (JSON.parse(data) as { unreadCount?: unknown } | null)?.unreadCount;
    return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= UNREAD_COUNT_CAP
      ? n
      : null;
  } catch {
    return null;
  }
}

/** The wait before re-opening a stream the browser gave up on: 1, 2, 4 s, then 10 s. */
export const reconnectDelay = (attempt: number): number =>
  attempt >= 3 ? 10000 : 1000 * 2 ** Math.max(0, attempt);
