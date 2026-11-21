import { and, count, desc, eq, inArray, lt, or } from 'drizzle-orm';
import type { AuthEnv } from '../../auth/api/auth-env';
import { decodeCursor, encodeCursor } from '../../../shared/db/cursor';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { media, posts, users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { mediaSrcset, type StorageEnv } from '../../../shared/storage';
import { PROFILE_PAGE_SIZE, type Page, type PostThumb } from '../model/schema';
import { lookupUsername } from '../model/username';

export type ListProfilePostsDeps = { env?: AuthEnv & StorageEnv };

/**
 * One page (12) of a user's posts, newest first by (created_at, id), as grid thumbnails. Anyone
 * may read it. A missing user is NOT_FOUND; a broken cursor is VALIDATION.
 */
export async function listProfilePosts(
  input: unknown,
  deps: ListProfilePostsDeps = {},
): Promise<Page<PostThumb>> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const { username: rawName, cursor: rawCursor } = (input ?? {}) as {
    username?: unknown;
    cursor?: unknown;
  };
  const username = lookupUsername(rawName);
  if (username === null) throw new AppError('NOT_FOUND');
  let cursor: ReturnType<typeof decodeCursor> | null = null;
  if (rawCursor !== undefined && rawCursor !== null) {
    if (typeof rawCursor !== 'string') throw new AppError('VALIDATION');
    cursor = decodeCursor(rawCursor);
  }

  const db = getDb(env);
  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
  if (!owner) throw new AppError('NOT_FOUND');

  // One extra row says whether another page exists.
  const rows = await db
    .select({ id: posts.id, createdAt: posts.createdAt })
    .from(posts)
    .where(
      and(
        eq(posts.authorId, owner.id),
        cursor
          ? or(
              lt(posts.createdAt, cursor.createdAt),
              and(eq(posts.createdAt, cursor.createdAt), lt(posts.id, cursor.id)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(PROFILE_PAGE_SIZE + 1);
  const pageRows = rows.slice(0, PROFILE_PAGE_SIZE);
  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    rows.length > PROFILE_PAGE_SIZE && last
      ? encodeCursor({ createdAt: last.createdAt, id: last.id })
      : null;
  if (pageRows.length === 0) return { items: [], nextCursor: null };

  const ids = pageRows.map((r) => r.id);
  const [covers, counts] = await db.batch([
    db
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
      .where(and(inArray(media.postId, ids), eq(media.position, 0))),
    db
      .select({ postId: media.postId, n: count() })
      .from(media)
      .where(inArray(media.postId, ids))
      .groupBy(media.postId),
  ]);
  const coverOf = new Map(covers.map((c) => [c.postId, c]));
  const countOf = new Map(counts.map((c) => [c.postId, c.n]));

  const items: PostThumb[] = [];
  for (const { id } of pageRows) {
    const cover = coverOf.get(id);
    if (!cover) continue; // a post always has a first photo; never show a broken tile
    items.push({
      id,
      cover: {
        type: cover.type,
        width: cover.width,
        height: cover.height,
        altText: cover.altText,
        thumbhash: cover.thumbhash,
        srcset: mediaSrcset(env, cover.storageKey),
      },
      mediaCount: countOf.get(id) ?? 1,
    });
  }
  return { items, nextCursor };
}
