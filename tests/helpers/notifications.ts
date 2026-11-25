import { newId } from '../../src/shared/db/id';
import { notifications, posts } from '../../src/shared/db/schema';
import type { Db } from '../../src/shared/db/client';

export const BASE_TIME = Date.UTC(2026, 10, 1, 0, 0, 0);

/**
 * Inserts `count` like notifications for `recipientId` from `actorId` in one batch: each is for its
 * own new bare post of the recipient (no photos), and the i-th (counting from `offset`) is one
 * second after the (i-1)-th. Returns the notification ids in that order.
 */
export async function seedNotifications(
  db: Db,
  options: {
    recipientId: string;
    actorId: string;
    count: number;
    offset?: number;
    read?: boolean;
  },
): Promise<string[]> {
  const ids: string[] = [];
  const offset = options.offset ?? 0;
  const statements = [];
  for (let i = 0; i < options.count; i += 1) {
    const postId = newId();
    const id = newId();
    ids.push(id);
    statements.push(
      db.insert(posts).values({
        id: postId,
        authorId: options.recipientId,
        caption: '',
        createdAt: new Date(BASE_TIME),
      }),
      db.insert(notifications).values({
        id,
        recipientId: options.recipientId,
        actorId: options.actorId,
        type: 'like',
        postId,
        commentId: null,
        readAt: options.read ? new Date(BASE_TIME) : null,
        createdAt: new Date(BASE_TIME + (offset + i) * 1000),
      }),
    );
  }
  if (statements.length > 0) await db.batch(statements as unknown as Parameters<Db['batch']>[0]);
  return ids;
}
