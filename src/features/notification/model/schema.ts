import { z } from 'zod';
import type { MediaView, UserSummary } from '../../post';

/** The page size of the notification list (docs/architecture/routes.md). */
export const NOTIFICATIONS_PAGE_SIZE = 20;
/** The unread count stops here: it reads at most this many rows, and the badge shows "99+". */
export const UNREAD_COUNT_CAP = 100;
/** A comment is shown in a notification up to this many characters. */
export const COMMENT_PREVIEW_LENGTH = 100;

/** `.strict()`: the person is always the session's user, so any other key is VALIDATION. */
export const listNotificationsInput = z.strictObject({ cursor: z.string().optional() });
export const noInput = z.strictObject({});

export type NotificationType = 'like' | 'comment' | 'follow';

export type NotificationView = {
  id: string;
  type: NotificationType;
  actor: UserSummary;
  post: { id: string; cover: MediaView | null } | null;
  comment: { id: string; body: string; truncated: boolean } | null;
  read: boolean;
  /** ISO 8601, UTC. */
  createdAt: string;
};

export type NotificationPage = { items: NotificationView[]; nextCursor: string | null };
