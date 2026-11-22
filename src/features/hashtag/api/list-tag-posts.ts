import { and, count, desc, eq } from 'drizzle-orm';
import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { loadPostTiles, type Page, type PostTile } from '../../post';
import { getDb } from '../../../shared/db/client';
import { keysetBefore, readCursor, toPage } from '../../../shared/db/cursor';
import { getRequestEnv } from '../../../shared/db/request';
import { AppError } from '../../../shared/errors';
import { isTagName, normalizeTag } from '../../../shared/hashtag';
import type { StorageEnv } from '../../../shared/storage';
import { hashtags, postHashtags } from '../db/schema';

export const TAG_PAGE_SIZE = 12;

export type TagPostsPage = Page<PostTile> & { name: string; postCount: number };
export type ListTagPostsDeps = { env?: AuthEnv & StorageEnv; headers: Headers };

/**
 * One page (12) of the posts that carry a tag, newest first by (post_hashtags.created_at, post_id),
 * as grid tiles, with the tag's name and its number of posts. Signed-in users only. The tag may be
 * written in any case or width. A name that cannot be a tag, or a tag nobody ever used, is
 * NOT_FOUND; a tag whose posts are all gone is an empty list; a broken cursor is VALIDATION.
 */
export async function listTagPosts(input: unknown, deps: ListTagPostsDeps): Promise<TagPostsPage> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  await requireUser(deps.headers, { env });

  const { tag, cursor: rawCursor } = (input ?? {}) as { tag?: unknown; cursor?: unknown };
  if (typeof tag !== 'string') throw new AppError('NOT_FOUND');
  const name = normalizeTag(tag);
  if (!isTagName(name)) throw new AppError('NOT_FOUND');
  const cursor = readCursor(rawCursor);

  const db = getDb(env);
  const [row] = await db.select({ id: hashtags.id }).from(hashtags).where(eq(hashtags.name, name));
  if (!row) throw new AppError('NOT_FOUND');

  const [counts, rows] = await db.batch([
    db.select({ n: count() }).from(postHashtags).where(eq(postHashtags.hashtagId, row.id)),
    db
      .select({ postId: postHashtags.postId, createdAt: postHashtags.createdAt })
      .from(postHashtags)
      .where(
        and(
          eq(postHashtags.hashtagId, row.id),
          keysetBefore(postHashtags.createdAt, postHashtags.postId, cursor),
        ),
      )
      .orderBy(desc(postHashtags.createdAt), desc(postHashtags.postId))
      .limit(TAG_PAGE_SIZE + 1),
  ]);
  const { items: pageRows, nextCursor } = toPage(rows, TAG_PAGE_SIZE, (r) => ({
    createdAt: r.createdAt,
    id: r.postId,
  }));
  const items = await loadPostTiles(
    db,
    env,
    pageRows.map((r) => r.postId),
  );
  return { name, postCount: counts[0]?.n ?? 0, items, nextCursor };
}
