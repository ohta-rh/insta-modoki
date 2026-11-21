import { and, desc, eq, inArray, lt, or } from 'drizzle-orm';
import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { loadPostViews, type PostView } from '../../post';
import { encodeCursor } from '../../../shared/db/cursor';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { follows, posts } from '../../../shared/db/schema';
import type { StorageEnv } from '../../../shared/storage';
import { FEED_PAGE_SIZE, parseGetFeedInput, type Page } from '../model/schema';

export type GetFeedDeps = { env?: AuthEnv & StorageEnv; headers: Headers };

/**
 * One page (12) of the home feed: the posts of the people the signed-in user follows and their
 * own, newest first by (created_at, id). It is always the session user's feed: the input names no
 * one. A broken cursor is VALIDATION; no session is UNAUTHENTICATED.
 */
export async function getFeed(input: unknown, deps: GetFeedDeps): Promise<Page<PostView>> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const viewer = await requireUser(deps.headers, { env });
  const { cursor } = parseGetFeedInput(input);
  const db = getDb(env);

  // One extra row says whether another page exists. The posts index
  // (author_id, created_at DESC, id DESC) serves each author; paging is by cursor only.
  const rows = await db
    .select({ id: posts.id, createdAt: posts.createdAt })
    .from(posts)
    .where(
      and(
        or(
          eq(posts.authorId, viewer.id),
          inArray(
            posts.authorId,
            db
              .select({ id: follows.followeeId })
              .from(follows)
              .where(eq(follows.followerId, viewer.id)),
          ),
        ),
        cursor
          ? or(
              lt(posts.createdAt, cursor.createdAt),
              and(eq(posts.createdAt, cursor.createdAt), lt(posts.id, cursor.id)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(FEED_PAGE_SIZE + 1);
  const pageRows = rows.slice(0, FEED_PAGE_SIZE);
  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    rows.length > FEED_PAGE_SIZE && last
      ? encodeCursor({ createdAt: last.createdAt, id: last.id })
      : null;
  const items = await loadPostViews(
    db,
    env,
    pageRows.map((r) => r.id),
    viewer.id,
  );
  return { items, nextCursor };
}
