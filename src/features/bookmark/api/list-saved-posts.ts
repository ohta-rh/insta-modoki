import { and, desc, eq } from 'drizzle-orm';
import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { loadPostTiles, type Page, type PostTile } from '../../post';
import { getDb } from '../../../shared/db/client';
import { keysetBefore, readCursor, toPage } from '../../../shared/db/cursor';
import { getRequestEnv } from '../../../shared/db/request';
import { bookmarks } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import type { StorageEnv } from '../../../shared/storage';
import { listSavedPostsInput, SAVED_PAGE_SIZE } from '../model/schema';

export type ListSavedPostsDeps = { env?: AuthEnv & StorageEnv; headers: Headers };

/**
 * One page (12) of the signed-in user's saved posts as grid tiles, the newest save first (ties:
 * larger post id first). Only the session's own saves are read: the input names no user. The
 * cursor carries the last row's save time and post id (docs/architecture/conventions.md
 * "カーソル"); a broken one is VALIDATION. A deleted post's row is gone with it (ON DELETE CASCADE).
 */
export async function listSavedPosts(
  input: unknown,
  deps: ListSavedPostsDeps,
): Promise<Page<PostTile>> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const user = await requireUser(deps.headers, { env });
  const parsed = listSavedPostsInput.safeParse(input ?? {});
  if (!parsed.success) throw new AppError('VALIDATION');
  const cursor = readCursor(parsed.data.cursor);

  const db = getDb(env);
  const rows = await db
    .select({ postId: bookmarks.postId, createdAt: bookmarks.createdAt })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, user.id),
        keysetBefore(bookmarks.createdAt, bookmarks.postId, cursor),
      ),
    )
    .orderBy(desc(bookmarks.createdAt), desc(bookmarks.postId))
    .limit(SAVED_PAGE_SIZE + 1);
  const page = toPage(rows, SAVED_PAGE_SIZE, (r) => ({ createdAt: r.createdAt, id: r.postId }));
  const items = await loadPostTiles(
    db,
    env,
    page.items.map((r) => r.postId),
  );
  return { items, nextCursor: page.nextCursor };
}
