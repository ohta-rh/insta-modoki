import { newId } from '../../src/shared/db/id';
import { notifications } from '../../src/shared/db/schema';
import type { Db } from '../../src/shared/db/client';
import { createPost } from './posts';

export const BASE_TIME = Date.UTC(2026, 10, 1, 0, 0, 0);

/**
 * Inserts `count` follow-free like notifications for `recipientId` directly: each is for its own
 * new post of the recipient and from `actorId`, the i-th (counting from `offset`) one second after
 * the (i-1)-th. They are likes so the unique indexes allow many rows.
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
  for (let i = 0; i < options.count; i += 1) {
    const post = await createPost(db, options.recipientId);
    const id = newId();
    ids.push(id);
    await db.insert(notifications).values({
      id,
      recipientId: options.recipientId,
      actorId: options.actorId,
      type: 'like',
      postId: post.id,
      commentId: null,
      readAt: options.read ? new Date(BASE_TIME) : null,
      createdAt: new Date(BASE_TIME + (offset + i) * 1000),
    });
  }
  return ids;
}
