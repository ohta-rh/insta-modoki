import { and, eq, ne, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { avatarFileKeys } from '../../profile';
import { photoFileKeys, removeFilesRecordingFailures } from '../../post';
import { storyFileKeys } from '../../story';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { newId } from '../../../shared/db/id';
import { getRequestEnv } from '../../../shared/db/request';
import {
  adminActions,
  comments,
  likes,
  media,
  posts,
  stories,
  users,
} from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import type { StorageEnv } from '../../../shared/storage';
import { dataOrThrow } from '../model/parse-or-throw';
import { recountPostCounters } from '../model/recount';
import { requireAdmin } from '../../auth';
import { parseAdminDeleteUser } from '../model/schema';
import type { AdminDeps } from './deps';

/**
 * Deletes a user, as an administrator, with everything that is theirs. Reads what is needed first
 * (their files, the other people's posts they touched), then one batch deletes the row (posts,
 * media, likes, comments, sessions, stories and the rest go by ON DELETE CASCADE), recounts the
 * touched posts' counters and writes the `admin_actions` record; the files go last, a failure
 * landing in storage_orphans. Oneself and other administrators are FORBIDDEN.
 */
export async function adminDeleteUser(input: unknown, deps: AdminDeps): Promise<{ deleted: true }> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const admin = await requireAdmin(deps.headers, { env });
  const { username } = dataOrThrow(parseAdminDeleteUser(input), 'username');

  const db = getDb(env);
  const [target] = await db
    .select({ id: users.id, role: users.role, avatarKey: users.avatarKey })
    .from(users)
    .where(eq(users.username, username.toLowerCase()));
  if (!target) throw new AppError('NOT_FOUND');
  if (target.id === admin.id || target.role === 'admin') throw new AppError('FORBIDDEN');

  const [postMedia, storyRows, likedPosts, commentedPosts] = await db.batch([
    db
      .select({ storageKey: media.storageKey })
      .from(media)
      .innerJoin(posts, eq(posts.id, media.postId))
      .where(eq(posts.authorId, target.id)),
    db
      .select({ type: stories.type, storageKey: stories.storageKey })
      .from(stories)
      .where(eq(stories.authorId, target.id)),
    db
      .select({ id: likes.postId })
      .from(likes)
      .innerJoin(posts, eq(posts.id, likes.postId))
      .where(and(eq(likes.userId, target.id), ne(posts.authorId, target.id))),
    db
      .select({ id: comments.postId })
      .from(comments)
      .innerJoin(posts, eq(posts.id, comments.postId))
      .where(and(eq(comments.authorId, target.id), ne(posts.authorId, target.id))),
  ]);
  const touchedPostIds = [...new Set([...likedPosts, ...commentedPosts].map((r) => r.id))];

  const now = deps.now ?? Date.now();
  const batch: [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] = [
    // Recorded from the row itself, and only while it is a plain user: the same condition the
    // delete below carries, so a record never names a user who was not deleted.
    db.insert(adminActions).select(
      db
        .select({
          id: sql<string>`${newId()}`.as('id'),
          adminId: sql<string>`${admin.id}`.as('adminId'),
          action: sql<string>`'delete_user'`.as('action'),
          targetId: users.id,
          createdAt: sql<number>`${now}`.as('createdAt'),
        })
        .from(users)
        .where(and(eq(users.id, target.id), eq(users.role, 'user'))),
    ),
    db.delete(users).where(and(eq(users.id, target.id), eq(users.role, 'user'))),
    ...recountPostCounters(db, touchedPostIds),
  ];
  await db.batch(batch);

  const [still] = await db.select({ id: users.id }).from(users).where(eq(users.id, target.id));
  if (still) throw new AppError('FORBIDDEN');

  const keys = [
    ...postMedia.flatMap((m) => photoFileKeys(m.storageKey)),
    ...storyRows.flatMap((s) => storyFileKeys(s.type, s.storageKey)),
    ...(target.avatarKey ? avatarFileKeys(target.avatarKey) : []),
  ];
  await removeFilesRecordingFailures(env, keys, deps.removeObjects, now);
  return { deleted: true };
}
