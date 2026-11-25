import { and, eq, ne, sql } from 'drizzle-orm';
import type { Db } from '../../../shared/db/client';
import { newId } from '../../../shared/db/id';
import { comments, follows, likes, posts } from '../../../shared/db/schema';
import { notifications } from './schema';

// Statements for the like, comment and follow writes. D1 has no interactive transaction
// (ADR-0019), so each function returns a Drizzle query for the caller to put at the END of its
// db.batch: a create or delete that fails rolls back with the row it belongs to. Putting one
// before the posts counter update would break `changes()` there (ADR-0039).

const nul = (name: string) => sql`NULL`.as(name);

/** The post owner's "B liked your post". Nothing is inserted for your own post, an absent like row, or a resend. */
export function insertLikeNotification(
  db: Db,
  input: { actorId: string; postId: string; now: number },
) {
  return db
    .insert(notifications)
    .select(
      db
        .select({
          id: sql<string>`${newId()}`.as('id'),
          recipientId: posts.authorId,
          actorId: sql<string>`${input.actorId}`.as('actor_id'),
          type: sql<'like'>`'like'`.as('type'),
          postId: posts.id,
          commentId: nul('comment_id'),
          readAt: nul('read_at'),
          createdAt: sql<number>`${input.now}`.as('created_at'),
        })
        .from(posts)
        .innerJoin(likes, and(eq(likes.postId, posts.id), eq(likes.userId, input.actorId)))
        .where(and(eq(posts.id, input.postId), ne(posts.authorId, input.actorId))),
    )
    .onConflictDoNothing();
}

export function deleteLikeNotification(db: Db, input: { actorId: string; postId: string }) {
  return db
    .delete(notifications)
    .where(
      and(
        eq(notifications.type, 'like'),
        eq(notifications.actorId, input.actorId),
        eq(notifications.postId, input.postId),
      ),
    );
}

/** The post owner's "B commented" (a reply too). Needs the comment row to exist in the same batch. */
export function insertCommentNotification(
  db: Db,
  input: { actorId: string; postId: string; commentId: string; now: number },
) {
  return db.insert(notifications).select(
    db
      .select({
        id: sql<string>`${newId()}`.as('id'),
        recipientId: posts.authorId,
        actorId: sql<string>`${input.actorId}`.as('actor_id'),
        type: sql<'comment'>`'comment'`.as('type'),
        postId: posts.id,
        commentId: comments.id,
        readAt: nul('read_at'),
        createdAt: sql<number>`${input.now}`.as('created_at'),
      })
      .from(posts)
      .innerJoin(comments, and(eq(comments.id, input.commentId), eq(comments.postId, posts.id)))
      .where(and(eq(posts.id, input.postId), ne(posts.authorId, input.actorId))),
  );
}

export function insertFollowNotification(
  db: Db,
  input: { actorId: string; followeeId: string; now: number },
) {
  return db
    .insert(notifications)
    .select(
      db
        .select({
          id: sql<string>`${newId()}`.as('id'),
          recipientId: follows.followeeId,
          actorId: sql<string>`${input.actorId}`.as('actor_id'),
          type: sql<'follow'>`'follow'`.as('type'),
          postId: nul('post_id'),
          commentId: nul('comment_id'),
          readAt: nul('read_at'),
          createdAt: sql<number>`${input.now}`.as('created_at'),
        })
        .from(follows)
        .where(
          and(eq(follows.followerId, input.actorId), eq(follows.followeeId, input.followeeId)),
        ),
    )
    .onConflictDoNothing();
}

export function deleteFollowNotification(db: Db, input: { actorId: string; followeeId: string }) {
  return db
    .delete(notifications)
    .where(
      and(
        eq(notifications.type, 'follow'),
        eq(notifications.actorId, input.actorId),
        eq(notifications.recipientId, input.followeeId),
      ),
    );
}
