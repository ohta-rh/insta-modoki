import { and, desc, eq, gte, lt, lte, ne, notInArray, or } from 'drizzle-orm';
import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { loadPostTiles, type Page, type PostTile } from '../../post';
import { getDb, type Db } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { follows, posts } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import type { StorageEnv } from '../../../shared/storage';
import { decodeExploreCursor, encodeExploreCursor, type ExploreCursor } from '../model/cursor';
import { EXPLORE_PAGE_SIZE, EXPLORE_WINDOW_MS } from '../model/schema';

export type ListExploreDeps = { env?: AuthEnv & StorageEnv; headers: Headers; now?: number };

/**
 * The rows of one page (one more than a page, to know whether a next one exists): posts made in
 * the 7 days up to `asOf`, by people the viewer is not and does not follow, most liked first, ties
 * newest first, then by id. `cursor` continues after the (like_count, created_at, id) it names.
 */
export function exploreQuery(db: Db, viewerId: string, asOf: number, cursor: ExploreCursor | null) {
  return db
    .select({ id: posts.id, likeCount: posts.likeCount, createdAt: posts.createdAt })
    .from(posts)
    .where(
      and(
        gte(posts.createdAt, new Date(asOf - EXPLORE_WINDOW_MS)),
        lte(posts.createdAt, new Date(asOf)),
        ne(posts.authorId, viewerId),
        notInArray(
          posts.authorId,
          db
            .select({ id: follows.followeeId })
            .from(follows)
            .where(eq(follows.followerId, viewerId)),
        ),
        cursor
          ? or(
              lt(posts.likeCount, cursor.likeCount),
              and(eq(posts.likeCount, cursor.likeCount), lt(posts.createdAt, cursor.createdAt)),
              and(
                eq(posts.likeCount, cursor.likeCount),
                eq(posts.createdAt, cursor.createdAt),
                lt(posts.id, cursor.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(posts.likeCount), desc(posts.createdAt), desc(posts.id))
    .limit(EXPLORE_PAGE_SIZE + 1);
}

/**
 * One page (24) of the discover list as grid tiles: posts of the last 7 days from people the
 * viewer does not follow, most liked first. The window is counted at the time of the first page
 * (`asOf`, carried in the cursor) so paging does not shift it. Signed-in users only; a broken
 * cursor is VALIDATION.
 */
export async function listExplorePosts(
  input: unknown,
  deps: ListExploreDeps,
): Promise<Page<PostTile>> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const viewer = await requireUser(deps.headers, { env });
  const now = deps.now ?? Date.now();

  const raw = (input ?? {}) as { cursor?: unknown };
  if (raw.cursor !== undefined && raw.cursor !== null && typeof raw.cursor !== 'string') {
    throw new AppError('VALIDATION');
  }
  const cursor = typeof raw.cursor === 'string' ? decodeExploreCursor(raw.cursor, now) : null;
  const asOf = cursor ? cursor.asOf : now;

  const db = getDb(env);
  const rows = await exploreQuery(db, viewer.id, asOf, cursor);
  const pageRows = rows.slice(0, EXPLORE_PAGE_SIZE);
  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    rows.length > EXPLORE_PAGE_SIZE && last
      ? encodeExploreCursor({
          asOf,
          likeCount: last.likeCount,
          createdAt: last.createdAt,
          id: last.id,
        })
      : null;
  const items = await loadPostTiles(
    db,
    env,
    pageRows.map((r) => r.id),
  );
  return { items, nextCursor };
}
