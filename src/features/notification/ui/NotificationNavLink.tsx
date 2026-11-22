'use client';

import { useSyncExternalStore, type ComponentProps } from 'react';
import { badgeAccessibleText } from '../model/notification-text';
import { unreadStore } from './unread-store';

/** The label of the 通知 link: none with no unread, else "通知（未読 N 件）" (no space between). */
export function notificationLinkLabel(count: number): string | undefined {
  return count > 0 ? `通知${badgeAccessibleText(count)}` : undefined;
}

/**
 * The navigation link of 通知. Its name is set with `aria-label`: made from the link's content
 * (the label and the badge's hidden text, separate blocks of a flex link) the name would read
 * "通知 （未読 N 件）" with a space.
 */
export function NotificationNavLink(props: ComponentProps<'a'>) {
  const count = useSyncExternalStore(unreadStore.subscribe, unreadStore.getSnapshot, () => 0);
  return <a {...props} aria-label={notificationLinkLabel(count)} />;
}
