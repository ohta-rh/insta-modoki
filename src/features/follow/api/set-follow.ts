import { and, count, eq } from 'drizzle-orm';
import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { follows, users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { deleteFollowNotification, insertFollowNotification } from '../../notification';
import { lookupUsername } from '../../profile';
import { followInput, SELF_FOLLOW_MESSAGE, type FollowResult } from '../model/schema';

export type FollowDeps = { env?: AuthEnv; headers: Headers; now?: number };

/**
 * Puts the signed-in user's follow of `username` into the wanted state and returns the state
 * after. Both directions are "make it so": calling again gives the same answer.
 * Order: login, input shape, username, the person, self check, then one db.batch (ADR-0019): the
 * insert (ON CONFLICT DO NOTHING) or delete, then the count of the person's followers.
 */
export async function setFollow(
  input: unknown,
  deps: FollowDeps,
  following: boolean,
): Promise<FollowResult> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv>());
  const user = await requireUser(deps.headers, { env });

  const parsed = followInput.safeParse(input);
  if (!parsed.success) throw new AppError('VALIDATION');
  const username = lookupUsername(parsed.data.username);
  if (username === null) throw new AppError('NOT_FOUND');

  const db = getDb(env);
  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username));
  if (!target) throw new AppError('NOT_FOUND');
  if (target.id === user.id) {
    throw new AppError('VALIDATION', { fieldErrors: { username: [SELF_FOLLOW_MESSAGE] } });
  }

  const countFollowers = db
    .select({ n: count() })
    .from(follows)
    .where(eq(follows.followeeId, target.id));
  const [, counted] = following
    ? await db.batch([
        db
          .insert(follows)
          .values({
            followerId: user.id,
            followeeId: target.id,
            createdAt: new Date(deps.now ?? Date.now()),
          })
          .onConflictDoNothing(),
        countFollowers,
        insertFollowNotification(db, {
          actorId: user.id,
          followeeId: target.id,
          now: deps.now ?? Date.now(),
        }),
      ])
    : await db.batch([
        db
          .delete(follows)
          .where(and(eq(follows.followerId, user.id), eq(follows.followeeId, target.id))),
        countFollowers,
        deleteFollowNotification(db, { actorId: user.id, followeeId: target.id }),
      ]);
  return { following, followerCount: counted[0]?.n ?? 0 };
}
