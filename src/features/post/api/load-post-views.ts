import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../../shared/db/client';
import { likes, media, posts, users } from '../../../shared/db/schema';
import { mediaSrcset, publicUrl, type StorageEnv } from '../../../shared/storage';
import type { MediaView, PostView } from '../model/schema';

/** Ids per `IN`: a D1 statement binds at most 100 variables (docs/architecture/conventions.md). */
const CHUNK = 50;

/**
 * PostViews for `postIds`, in that order, built with a fixed number of D1 round trips per 50 ids
 * (posts with their authors, photos and the viewer's likes in one batch), never one per post.
 * An id with no post is skipped. `viewerId` null means nobody is signed in: nothing is liked.
 * This is the one way a PostView is built (getPost and the feed use it).
 */
export async function loadPostViews(
  db: Db,
  env: StorageEnv,
  postIds: readonly string[],
  viewerId: string | null,
): Promise<PostView[]> {
  const byId = new Map<string, PostView>();
  for (let i = 0; i < postIds.length; i += CHUNK) {
    const ids = postIds.slice(i, i + CHUNK);
    const [postRows, mediaRows, likeRows] = await db.batch([
      db
        .select({
          id: posts.id,
          caption: posts.caption,
          likeCount: posts.likeCount,
          commentCount: posts.commentCount,
          createdAt: posts.createdAt,
          username: users.username,
          displayName: users.displayName,
          avatarKey: users.avatarKey,
        })
        .from(posts)
        .innerJoin(users, eq(users.id, posts.authorId))
        .where(inArray(posts.id, ids)),
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
        .where(inArray(media.postId, ids))
        .orderBy(asc(media.position)),
      // A viewer who is not signed in matches no row: the user id is never an empty string.
      db
        .select({ postId: likes.postId })
        .from(likes)
        .where(and(inArray(likes.postId, ids), eq(likes.userId, viewerId ?? ''))),
    ]);

    const mediaOf = new Map<string, MediaView[]>();
    for (const m of mediaRows) {
      const list = mediaOf.get(m.postId) ?? [];
      list.push({
        type: m.type,
        width: m.width,
        height: m.height,
        altText: m.altText,
        thumbhash: m.thumbhash,
        srcset: mediaSrcset(env, m.storageKey),
      });
      mediaOf.set(m.postId, list);
    }
    const liked = new Set(likeRows.map((l) => l.postId));
    for (const post of postRows) {
      byId.set(post.id, {
        id: post.id,
        author: {
          username: post.username,
          displayName: post.displayName,
          avatarUrl: post.avatarKey ? publicUrl(env, `${post.avatarKey}/w320.webp`) : null,
        },
        caption: post.caption,
        media: mediaOf.get(post.id) ?? [],
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        likedByMe: liked.has(post.id),
        createdAt: post.createdAt.toISOString(),
      });
    }
  }
  return postIds.flatMap((id) => byId.get(id) ?? []);
}
