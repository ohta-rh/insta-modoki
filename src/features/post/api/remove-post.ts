import { eq } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { getDb, type DbEnv } from '../../../shared/db/client';
import { media, posts, storageOrphans } from '../../../shared/db/schema';
import {
  getStorageClient,
  removeObjects as removeStoredObjects,
  type StorageEnv,
} from '../../../shared/storage';

const VARIANTS = ['orig', 'w320', 'w640', 'w1080'] as const;

/** The four stored files of one `media.storage_key`. */
export const photoFileKeys = (storageKey: string): string[] =>
  VARIANTS.map((v) => `${storageKey}/${v}.webp`);

export type RemovePostOptions = {
  /** Statements run in the same batch as the delete (the admin's `admin_actions` row). */
  extra?: BatchItem<'sqlite'>[];
  /** Replaced by tests to make the storage fail. */
  removeObjects?: typeof removeStoredObjects;
  now?: number;
};

/**
 * Removes a post whose permission is already decided: one batch reads its media keys and deletes
 * the row (media, likes and comments go with it by ON DELETE CASCADE) together with `extra`, then
 * the stored files are removed. A file that cannot be removed is recorded in storage_orphans and
 * never brings the row back (conventions.md "削除").
 */
export async function removePost(
  env: DbEnv & StorageEnv,
  postId: string,
  options: RemovePostOptions = {},
): Promise<void> {
  const db = getDb(env);
  const batch: [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]] = [
    db.select({ storageKey: media.storageKey }).from(media).where(eq(media.postId, postId)),
    db.delete(posts).where(eq(posts.id, postId)),
    ...(options.extra ?? []),
  ];
  const [mediaRows] = (await db.batch(batch)) as [{ storageKey: string }[], ...unknown[]];

  const keys = mediaRows.flatMap((m) => photoFileKeys(m.storageKey));
  await removeFilesRecordingFailures(env, keys, options.removeObjects, options.now);
}

/**
 * Removes the files in one request; the keys that could not be removed (or all of them when the
 * request itself failed) go to storage_orphans with `attempts: 0`. Never throws.
 */
export async function removeFilesRecordingFailures(
  env: DbEnv & StorageEnv,
  keys: string[],
  remove: typeof removeStoredObjects = removeStoredObjects,
  now: number = Date.now(),
): Promise<void> {
  if (keys.length === 0) return;
  let failed: string[];
  try {
    failed = await remove(getStorageClient(env), keys);
  } catch (error) {
    console.error('storage delete failed', error instanceof Error ? error.name : 'unknown');
    failed = keys;
  }
  if (failed.length === 0) return;
  try {
    await getDb(env)
      .insert(storageOrphans)
      .values(failed.map((storageKey) => ({ storageKey, createdAt: new Date(now) })))
      .onConflictDoNothing();
  } catch (error) {
    // The rows are gone for good; nothing more can be done here, and the caller needs no error.
    console.error('storage_orphans insert failed', error instanceof Error ? error.name : 'unknown');
  }
}
