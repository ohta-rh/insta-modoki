import { UNREAD_COUNT_CAP } from './constants';
import type { NotificationView } from './schema';

/** The sentence of one notification row. A comment's text ends with "…" when it was cut. */
export function notificationText(view: NotificationView): string {
  const name = view.actor.displayName;
  switch (view.type) {
    case 'like':
      return `${name}さんがあなたの投稿にいいねしました`;
    case 'comment':
      return `${name}さんがコメントしました: ${view.comment?.body ?? ''}${view.comment?.truncated ? '…' : ''}`;
    case 'follow':
      return `${name}さんがあなたをフォローしました`;
  }
}

/** What the badge shows: nothing for 0, the number up to 99, and "99+" at the cap. */
export function badgeText(count: number): string {
  if (count <= 0) return '';
  return count >= UNREAD_COUNT_CAP ? '99+' : String(count);
}

/** The text that goes into the link's name for a screen reader (not colour, not position). */
export function badgeAccessibleText(count: number): string {
  if (count <= 0) return '';
  return count >= UNREAD_COUNT_CAP ? '（未読 99 件以上）' : `（未読 ${count} 件）`;
}
