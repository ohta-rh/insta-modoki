import { eq } from 'drizzle-orm';
import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import type { UserSummary } from '../../post';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { users } from '../../../shared/db/schema';
import { avatarUrl, type StorageEnv } from '../../../shared/storage';
import { findActiveStories, findSeenStoryIds } from '../db/queries';
import { TRAY_MAX } from '../model/limits';
import { buildTray } from '../model/tray';

export type StoryTrayItem = { user: UserSummary; hasUnseen: boolean; latestAt: string };
export type StoryTrayView = { me: UserSummary; hasOwn: boolean; items: StoryTrayItem[] };
export type ListStoryTrayDeps = { env?: AuthEnv & StorageEnv; headers: Headers; now?: number };

/**
 * The story tray of the signed-in user: the people they follow who have an unexpired story
 * (unseen first, at most 50), and whether they have one of their own. The input names no one.
 * No session is UNAUTHENTICATED.
 */
export async function listStoryTray(
  _input: unknown,
  deps: ListStoryTrayDeps,
): Promise<StoryTrayView> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const me = await requireUser(deps.headers, { env });
  const now = deps.now ?? Date.now();
  const db = getDb(env);
  const [followed, own, seen, profile] = await Promise.all([
    findActiveStories(db, { authors: { followedBy: me.id }, now }),
    findActiveStories(db, { authors: { ids: [me.id] }, now }),
    findSeenStoryIds(db, { viewerId: me.id, now }),
    db
      .select({ displayName: users.displayName, avatarKey: users.avatarKey })
      .from(users)
      .where(eq(users.id, me.id))
      .get(),
  ]);
  const items = buildTray(
    followed.filter((s) => s.authorId !== me.id),
    seen,
    now,
  )
    .slice(0, TRAY_MAX)
    .map((e) => ({
      user: {
        username: e.user.username,
        displayName: e.user.displayName,
        avatarUrl: avatarUrl(env, e.user.avatarKey),
      },
      hasUnseen: e.hasUnseen,
      latestAt: new Date(e.latestAt).toISOString(),
    }));
  return {
    me: {
      username: me.username,
      displayName: profile?.displayName ?? me.username,
      avatarUrl: avatarUrl(env, profile?.avatarKey ?? null),
    },
    hasOwn: own.length > 0,
    items,
  };
}
