import { and, desc, eq } from 'drizzle-orm';
import type { AuthEnv } from '../../auth/api/auth-env';
import { keysetBefore, readCursor, toPage } from '../../../shared/db/cursor';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { likes, posts, users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { publicUrl, type StorageEnv } from '../../../shared/storage';
import type { UserSummary } from '../../post';
import { isPostId, LIKERS_PAGE_SIZE, listLikersInput } from '../model/schema';

export type ListLikersDeps = { env?: AuthEnv & StorageEnv };
export type LikersPage = { items: UserSummary[]; nextCursor: string | null };

/**
 * The people who liked a post, newest like first (ties: larger user id first), 20 a page.
 * Anyone may read it, so no login is needed. The cursor carries the last row's like time and
 * user id (docs/architecture/conventions.md "カーソル"); a broken one is VALIDATION.
 */
export async function listLikers(input: unknown, deps: ListLikersDeps = {}): Promise<LikersPage> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const parsed = listLikersInput.safeParse(input);
  if (!parsed.success) throw new AppError('VALIDATION');
  const { postId, cursor } = parsed.data;
  const after = readCursor(cursor);
  if (!isPostId(postId)) throw new AppError('NOT_FOUND');

  const db = getDb(env);
  const [postRows, rows] = await db.batch([
    db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId)),
    db
      .select({
        userId: likes.userId,
        createdAt: likes.createdAt,
        username: users.username,
        displayName: users.displayName,
        avatarKey: users.avatarKey,
      })
      .from(likes)
      .innerJoin(users, eq(users.id, likes.userId))
      .where(and(eq(likes.postId, postId), keysetBefore(likes.createdAt, likes.userId, after)))
      .orderBy(desc(likes.createdAt), desc(likes.userId))
      .limit(LIKERS_PAGE_SIZE + 1),
  ]);
  if (postRows.length === 0) throw new AppError('NOT_FOUND');

  const page = toPage(rows, LIKERS_PAGE_SIZE, (r) => ({ createdAt: r.createdAt, id: r.userId }));
  return {
    items: page.items.map((r) => ({
      username: r.username,
      displayName: r.displayName,
      avatarUrl: r.avatarKey ? publicUrl(env, `${r.avatarKey}/w320.webp`) : null,
    })),
    nextCursor: page.nextCursor,
  };
}
