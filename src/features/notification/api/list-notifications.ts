import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { keysetBefore, readCursor, toPage } from '../../../shared/db/cursor';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { comments, media, users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { avatarUrl, mediaSrcset, type StorageEnv } from '../../../shared/storage';
import { notifications } from '../db/schema';
import {
  COMMENT_PREVIEW_LENGTH,
  listNotificationsInput,
  NOTIFICATIONS_PAGE_SIZE,
  type NotificationPage,
  type NotificationView,
} from '../model/schema';

export type ListNotificationsDeps = { env?: AuthEnv & StorageEnv; headers: Headers; now?: number };

/**
 * The signed-in user's notifications, newest first by (created_at, id), 20 a page. The recipient
 * is always the session's user: the input has no user field and any extra key is VALIDATION, as is
 * a broken cursor. Only a preview of a comment is read (its first 100 characters and whether
 * there are more), and only the first photo of each post.
 */
export async function listNotifications(
  input: unknown,
  deps: ListNotificationsDeps,
): Promise<NotificationPage> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const user = await requireUser(deps.headers, { env });
  const parsed = listNotificationsInput.safeParse(input ?? {});
  if (!parsed.success) throw new AppError('VALIDATION');
  const cursor = readCursor(parsed.data.cursor);

  const db = getDb(env);
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      postId: notifications.postId,
      commentId: notifications.commentId,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      username: users.username,
      displayName: users.displayName,
      avatarKey: users.avatarKey,
      commentBody: sql<string | null>`substr(${comments.body}, 1, ${COMMENT_PREVIEW_LENGTH})`,
      commentTruncated: sql<number | null>`length(${comments.body}) > ${COMMENT_PREVIEW_LENGTH}`,
    })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.actorId))
    .leftJoin(comments, eq(comments.id, notifications.commentId))
    .where(
      and(
        eq(notifications.recipientId, user.id),
        keysetBefore(notifications.createdAt, notifications.id, cursor),
      ),
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(NOTIFICATIONS_PAGE_SIZE + 1);
  const page = toPage(rows, NOTIFICATIONS_PAGE_SIZE);
  if (page.items.length === 0) return { items: [], nextCursor: null };

  const postIds = [...new Set(page.items.flatMap((r) => (r.postId ? [r.postId] : [])))];
  const covers =
    postIds.length === 0
      ? []
      : await db
          .select({
            postId: media.postId,
            type: media.type,
            width: media.width,
            height: media.height,
            altText: media.altText,
            thumbhash: media.thumbhash,
            storageKey: media.storageKey,
          })
          .from(media)
          .where(and(inArray(media.postId, postIds), eq(media.position, 0)));
  const coverOf = new Map(covers.map((c) => [c.postId, c]));

  const items: NotificationView[] = page.items.map((r) => {
    const cover = r.postId ? coverOf.get(r.postId) : undefined;
    return {
      id: r.id,
      type: r.type,
      actor: {
        username: r.username,
        displayName: r.displayName,
        avatarUrl: avatarUrl(env, r.avatarKey),
      },
      post: r.postId
        ? {
            id: r.postId,
            cover: cover
              ? {
                  type: cover.type,
                  width: cover.width,
                  height: cover.height,
                  altText: cover.altText,
                  thumbhash: cover.thumbhash,
                  srcset: mediaSrcset(env, cover.storageKey),
                }
              : null,
          }
        : null,
      comment:
        r.commentId && r.commentBody !== null
          ? { id: r.commentId, body: r.commentBody, truncated: Boolean(r.commentTruncated) }
          : null,
      read: r.readAt !== null,
      createdAt: r.createdAt.toISOString(),
    };
  });
  return { items, nextCursor: page.nextCursor };
}
