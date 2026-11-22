'use server';

import { run, type ActionResult } from '../../../shared/action';
import { getUnreadNotificationCount } from './get-unread-notification-count';
import { listNotifications } from './list-notifications';
import { markNotificationsRead } from './mark-notifications-read';
import type { NotificationPage } from '../model/schema';

/** The Server Actions the notification screen and the badge call. They return the error body, never throw. */
export async function listNotificationsAction(
  input: unknown,
): Promise<ActionResult<NotificationPage>> {
  return run('listNotifications', (headers) => listNotifications(input, { headers }));
}

export async function getUnreadNotificationCountAction(): Promise<ActionResult<{ count: number }>> {
  return run('getUnreadNotificationCount', (headers) =>
    getUnreadNotificationCount({}, { headers }),
  );
}

export async function markNotificationsReadAction(): Promise<ActionResult<{ readCount: number }>> {
  return run('markNotificationsRead', (headers) => markNotificationsRead({}, { headers }));
}
