import { and, count, eq } from 'drizzle-orm';
import { getSessionUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { follows, posts, users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { avatarUrl, type StorageEnv } from '../../../shared/storage';
import type { ProfileView } from '../model/schema';
import { lookupUsername } from '../model/username';

export type GetProfileDeps = { env?: AuthEnv & StorageEnv; headers: Headers };

/**
 * One user as a profile screen shows it. Anyone may read it; `isMe` and `isFollowing` are only
 * true for a signed-in viewer. The answer is built per viewer and never cached. A missing user,
 * or a name that can never be one, is NOT_FOUND without a query.
 */
export async function getProfile(input: unknown, deps: GetProfileDeps): Promise<ProfileView> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const username = lookupUsername((input as { username?: unknown } | null)?.username);
  if (username === null) throw new AppError('NOT_FOUND');

  const viewer = await getSessionUser(deps.headers, { env });
  const db = getDb(env);
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      bio: users.bio,
      avatarKey: users.avatarKey,
    })
    .from(users)
    .where(eq(users.username, username));
  if (!user) throw new AppError('NOT_FOUND');

  const [postRows, followerRows, followingRows, followRows] = await db.batch([
    db.select({ n: count() }).from(posts).where(eq(posts.authorId, user.id)),
    db.select({ n: count() }).from(follows).where(eq(follows.followeeId, user.id)),
    db.select({ n: count() }).from(follows).where(eq(follows.followerId, user.id)),
    // A viewer who is not signed in matches no row: the user id is never an empty string.
    db
      .select({ followerId: follows.followerId })
      .from(follows)
      .where(and(eq(follows.followerId, viewer?.id ?? ''), eq(follows.followeeId, user.id))),
  ]);
  return {
    username: user.username,
    displayName: user.displayName,
    avatarUrl: avatarUrl(env, user.avatarKey),
    bio: user.bio,
    postCount: postRows[0]?.n ?? 0,
    followerCount: followerRows[0]?.n ?? 0,
    followingCount: followingRows[0]?.n ?? 0,
    isMe: viewer?.id === user.id,
    isFollowing: followRows.length > 0,
  };
}
