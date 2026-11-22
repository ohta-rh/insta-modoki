'use client';

import { useSyncExternalStore, type ComponentProps } from 'react';
import { badgeAccessibleText } from '../model/notification-text';
import { unreadStore } from './unread-store';

/** The label of the 通知 link: none with no unread, else "通知（未読 N 件）" (no space between). */
export function notificationLinkLabel(count: number): string | undefined {
  return count > 0 ? `通知${badgeAccessibleText(count)}` : undefined;
}

/**
 * The navigation link of 通知. The badge is outside the link and the unread count is told by
 * `aria-label` alone: the only visible text inside the link is "通知", which the name contains
 * (WCAG 2.5.3 / ACT 2ee8b8).
 */
export function NotificationNavLink(props: ComponentProps<'a'>) {
  const count = useSyncExternalStore(unreadStore.subscribe, unreadStore.getSnapshot, () => 0);
  return <a {...props} aria-label={notificationLinkLabel(count)} />;
}
