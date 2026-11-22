'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { badgeText } from '../model/notification-text';
import { unreadStore } from './unread-store';

/**
 * The count as a pill: the digits are the visible text and carry the meaning (colour only
 * decorates). It sits outside the link and is hidden from screen readers: the unread count is
 * spoken by the link's own name ("通知（未読 N 件）"). 0 draws nothing. No aria-live: the count changes on its own every few seconds and must not interrupt.
 */
export function NotificationBadgeView({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      data-testid="notification-badge"
      className="inline-flex min-w-5 items-center justify-center rounded-full bg-indigo px-1.5 text-[length:var(--font-size-xs)] leading-5 font-bold text-bg"
    >
      {badgeText(count)}
    </span>
  );
}

/** `viewerId` is the signed-in user: the count in the store belongs to one person only. */
export function NotificationBadge({ viewerId }: { viewerId: string }) {
  const count = useSyncExternalStore(
    unreadStore.subscribe,
    () => unreadStore.getSnapshotFor(viewerId),
    () => 0,
  );
  useEffect(() => unreadStore.setViewer(viewerId), [viewerId]);
  return <NotificationBadgeView count={count} />;
}
