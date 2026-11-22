import { and, count, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../../shared/db/client';
import { media, posts, users } from '../../../shared/db/schema';
import { mediaSrcset, type StorageEnv } from '../../../shared/storage';
import type { PostTile } from '../model/schema';

/** Ids per `IN`: a D1 statement binds at most 100 variables (docs/architecture/conventions.md). */
const CHUNK = 50;

/**
 * Grid tiles for `ids`, in that order: the first photo, the number of photos and the author's
 * username, from one `db.batch` per 50 ids. An id with no post or no photo is skipped.
 */
export async function loadPostTiles(
  db: Db,
  env: StorageEnv,
  ids: readonly string[],
): Promise<PostTile[]> {
  const byId = new Map<string, PostTile>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const [covers, counts, authors] = await db.batch([
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
        .where(and(inArray(media.postId, chunk), eq(media.position, 0))),
      db
        .select({ postId: media.postId, n: count() })
        .from(media)
        .where(inArray(media.postId, chunk))
        .groupBy(media.postId),
      db
        .select({ postId: posts.id, username: users.username })
        .from(posts)
        .innerJoin(users, eq(users.id, posts.authorId))
        .where(inArray(posts.id, chunk)),
    ]);
    const countOf = new Map(counts.map((c) => [c.postId, c.n]));
    const usernameOf = new Map(authors.map((a) => [a.postId, a.username]));
    for (const cover of covers) {
      const username = usernameOf.get(cover.postId);
      if (username === undefined) continue;
      byId.set(cover.postId, {
        id: cover.postId,
        cover: {
          type: cover.type,
          width: cover.width,
          height: cover.height,
          altText: cover.altText,
          thumbhash: cover.thumbhash,
          srcset: mediaSrcset(env, cover.storageKey),
        },
        mediaCount: countOf.get(cover.postId) ?? 1,
        username,
      });
    }
  }
  return ids.flatMap((id) => byId.get(id) ?? []);
}
