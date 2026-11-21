import { and, eq, sql } from 'drizzle-orm';
import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { isPostId } from '../../post';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { likes, posts } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { likeInput, type LikeResult } from '../model/schema';

export type LikeDeps = { env?: AuthEnv; headers: Headers; now?: number };

/**
 * Puts the signed-in user's like on a post into the wanted state and returns the state after.
 * Both directions are "make it so" operations: calling again gives the same answer.
 * Order: login, input shape, post id, then one db.batch (ADR-0019): the likes row change and the
 * counter update run in one transaction, and the counter moves by `changes()`, the number of rows
 * the statement just before it really inserted or deleted, so a repeat or a race moves it by 0.
 */
export async function setLike(input: unknown, deps: LikeDeps, liked: boolean): Promise<LikeResult> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv>());
  const user = await requireUser(deps.headers, { env });

  const parsed = likeInput.safeParse(input);
  if (!parsed.success) throw new AppError('VALIDATION');
  const { postId } = parsed.data;
  if (!isPostId(postId)) throw new AppError('NOT_FOUND');

  const db = getDb(env);
  const [, updated] = liked
    ? await db.batch([
        // Inserting from the posts row means a missing post inserts nothing (no foreign key error).
        db
          .insert(likes)
          .select(
            db
              .select({
                userId: sql<string>`${user.id}`.as('user_id'),
                postId: posts.id,
                createdAt: sql<number>`${deps.now ?? Date.now()}`.as('created_at'),
              })
              .from(posts)
              .where(eq(posts.id, postId)),
          )
          .onConflictDoNothing(),
        db
          .update(posts)
          .set({ likeCount: sql`${posts.likeCount} + changes()` })
          .where(eq(posts.id, postId))
          .returning({ likeCount: posts.likeCount }),
      ])
    : await db.batch([
        db.delete(likes).where(and(eq(likes.postId, postId), eq(likes.userId, user.id))),
        db
          .update(posts)
          .set({ likeCount: sql`max(${posts.likeCount} - changes(), 0)` })
          .where(eq(posts.id, postId))
          .returning({ likeCount: posts.likeCount }),
      ]);

  const row = updated[0];
  if (!row) throw new AppError('NOT_FOUND');
  return { liked, likeCount: row.likeCount };
}
