import { eq, sql } from 'drizzle-orm';
import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { comments, posts } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { isId } from '../model/schema';

export type DeleteCommentDeps = { env?: AuthEnv; headers: Headers };

/**
 * Deletes a comment (and, for a top-level comment, its replies by ON DELETE CASCADE). Only the
 * comment's author or the post's author may. One batch lowers `posts.comment_count` by the rows
 * that really exist (the comment and its replies, counted inside the statement) and deletes them.
 * Order: login, id check, lookup, permission check.
 */
export async function deleteComment(
  input: unknown,
  deps: DeleteCommentDeps,
): Promise<{ deleted: true }> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv>());
  const user = await requireUser(deps.headers, { env });

  const commentId = (input as { commentId?: unknown } | null)?.commentId;
  if (!isId(commentId)) throw new AppError('NOT_FOUND');

  const db = getDb(env);
  const [row] = await db
    .select({ authorId: comments.authorId, postId: comments.postId, postAuthorId: posts.authorId })
    .from(comments)
    .innerJoin(posts, eq(posts.id, comments.postId))
    .where(eq(comments.id, commentId));
  if (!row) throw new AppError('NOT_FOUND');
  if (row.authorId !== user.id && row.postAuthorId !== user.id) throw new AppError('FORBIDDEN');

  await db.batch([
    // The count is taken before the delete, in the same statement that lowers it; it never goes below 0.
    db
      .update(posts)
      .set({
        commentCount: sql`MAX(0, ${posts.commentCount} - (SELECT count(*) FROM comments WHERE id = ${commentId} OR parent_id = ${commentId}))`,
      })
      .where(eq(posts.id, row.postId)),
    db.delete(comments).where(eq(comments.id, commentId)),
  ]);
  return { deleted: true };
}
