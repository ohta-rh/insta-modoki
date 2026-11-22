import { z } from 'zod';
import type { MediaView, UserSummary } from '../../post';

export { COMMENT_PREVIEW_LENGTH, NOTIFICATIONS_PAGE_SIZE, UNREAD_COUNT_CAP } from './constants';

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
