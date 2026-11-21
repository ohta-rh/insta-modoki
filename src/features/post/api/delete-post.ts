import { and, eq } from 'drizzle-orm';
import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { media, posts, storageOrphans } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import {
  getStorageClient,
  removeObjects as removeStoredObjects,
  type StorageEnv,
} from '../../../shared/storage';
import { isPostId } from '../model/schema';

const VARIANTS = ['orig', 'w320', 'w640', 'w1080'] as const;
/** At most this many files are deleted at once, so a failure points at a small set of keys. */
const CHUNK = 8;

export type DeletePostDeps = {
  env?: AuthEnv & StorageEnv;
  headers: Headers;
  /** Replaced by tests to make the storage fail. */
  removeObjects?: typeof removeStoredObjects;
  now?: number;
};

/**
 * Deletes the signed-in user's own post: one batch removes the row (media, likes and comments go
 * with it by ON DELETE CASCADE), then the stored files are removed. A file that cannot be removed
 * is recorded in storage_orphans and never brings the row back (conventions.md "削除").
 * Order: login, id check, lookup, owner check.
 */
export async function deletePost(input: unknown, deps: DeletePostDeps): Promise<{ deleted: true }> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const user = await requireUser(deps.headers, { env });

  const postId = (input as { postId?: unknown } | null)?.postId;
  if (!isPostId(postId)) throw new AppError('NOT_FOUND');

  const db = getDb(env);
  const [post] = await db
    .select({ authorId: posts.authorId })
    .from(posts)
    .where(eq(posts.id, postId));
  // A post that is already gone has no owner to check: the same answer for everyone signed in.
  if (!post) return { deleted: true };
  if (post.authorId !== user.id) throw new AppError('FORBIDDEN');

  // The media keys are read in the same batch as the delete; the owner is checked again in the
  // delete itself so a changed post cannot be removed by someone else.
  const [mediaRows] = await db.batch([
    db.select({ storageKey: media.storageKey }).from(media).where(eq(media.postId, postId)),
    db.delete(posts).where(and(eq(posts.id, postId), eq(posts.authorId, user.id))),
  ]);

  const keys = mediaRows.flatMap((m) => VARIANTS.map((v) => `${m.storageKey}/${v}.webp`));
  const failed = await removeFiles(env, keys, deps.removeObjects ?? removeStoredObjects);
  if (failed.length > 0) {
    try {
      await db
        .insert(storageOrphans)
        .values(
          failed.map((storageKey) => ({ storageKey, createdAt: new Date(deps.now ?? Date.now()) })),
        )
        .onConflictDoNothing();
    } catch (error) {
      // The row is gone for good; nothing more can be done here, and the user needs no error.
      console.error(
        'storage_orphans insert failed',
        error instanceof Error ? error.name : 'unknown',
      );
    }
  }
  return { deleted: true };
}

/** Removes the files; returns the keys that could not be removed. Never throws. */
async function removeFiles(
  env: StorageEnv,
  keys: string[],
  remove: typeof removeStoredObjects,
): Promise<string[]> {
  if (keys.length === 0) return [];
  let client;
  try {
    client = getStorageClient(env);
  } catch {
    return keys;
  }
  const failed: string[] = [];
  for (let i = 0; i < keys.length; i += CHUNK) {
    const chunk = keys.slice(i, i + CHUNK);
    try {
      await remove(client, chunk);
    } catch (error) {
      console.error('storage delete failed', error instanceof Error ? error.name : 'unknown');
      failed.push(...chunk);
    }
  }
  return failed;
}
