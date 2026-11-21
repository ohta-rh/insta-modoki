import { and, asc, eq } from 'drizzle-orm';
import { getSessionUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { likes, media, posts, users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { mediaSrcset, publicUrl, type StorageEnv } from '../../../shared/storage';
import { isPostId, type PostView } from '../model/schema';

export type GetPostDeps = { env?: AuthEnv & StorageEnv; headers: Headers };

/**
 * One post as a screen shows it. Anyone may read a post, so no login is needed; likedByMe is
 * only true for a signed-in viewer who liked it. A missing post or a non-UUID id is NOT_FOUND.
 */
export async function getPost(input: unknown, deps: GetPostDeps): Promise<PostView> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const postId = (input as { postId?: unknown } | null)?.postId;
  if (!isPostId(postId)) throw new AppError('NOT_FOUND');

  const viewer = await getSessionUser(deps.headers, { env });
  const db = getDb(env);
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
      .where(eq(posts.id, postId)),
    db
      .select({
        type: media.type,
        width: media.width,
        height: media.height,
        altText: media.altText,
        thumbhash: media.thumbhash,
        storageKey: media.storageKey,
      })
      .from(media)
      .where(eq(media.postId, postId))
      .orderBy(asc(media.position)),
    // A viewer who is not signed in matches no row: the user id is never an empty string.
    db
      .select({ userId: likes.userId })
      .from(likes)
      .where(and(eq(likes.postId, postId), eq(likes.userId, viewer?.id ?? ''))),
  ]);

  const post = postRows[0];
  if (!post) throw new AppError('NOT_FOUND');
  return {
    id: post.id,
    author: {
      username: post.username,
      displayName: post.displayName,
      avatarUrl: post.avatarKey ? publicUrl(env, `${post.avatarKey}/w320.webp`) : null,
    },
    caption: post.caption,
    media: mediaRows.map((m) => ({
      type: m.type,
      width: m.width,
      height: m.height,
      altText: m.altText,
      thumbhash: m.thumbhash,
      srcset: mediaSrcset(env, m.storageKey),
    })),
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    likedByMe: likeRows.length > 0,
    createdAt: post.createdAt.toISOString(),
  };
}
