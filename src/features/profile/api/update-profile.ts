import { and, eq, ne } from 'drizzle-orm';
import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb, type Db } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { media, storageOrphans, users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import {
  getStorageClient,
  headObject,
  removeObjects as removeStoredObjects,
  type StorageClient,
  type StorageEnv,
} from '../../../shared/storage';
import { avatarFileKeys } from '../model/files';
import { AVATAR_MESSAGE, parseUpdateProfile, type ProfileView } from '../model/schema';
import { getProfile } from './get-profile';

/** A stored file may not be larger than a source photo is allowed to be. */
const MAX_OBJECT_BYTES = 10_485_760;
const KEY_TAIL = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type UpdateProfileDeps = {
  env?: AuthEnv & StorageEnv;
  headers: Headers;
  /** Replaced by tests to make the storage fail. */
  removeObjects?: typeof removeStoredObjects;
  now?: number;
};

const reselect = () => new AppError('VALIDATION', { message: AVATAR_MESSAGE });
const filesOf = avatarFileKeys;

/**
 * A new icon must be in the caller's own area (`media/<user id>/<UUIDv7>`), used by no post and
 * no other profile, and have its four WebP files in storage. Files that are there but are not
 * WebP or are too large are deleted; nothing else is.
 */
async function checkAvatarKey(db: Db, client: StorageClient, userId: string, key: string) {
  const prefix = `media/${userId}/`;
  if (!key.startsWith(prefix) || !KEY_TAIL.test(key.slice(prefix.length))) throw reselect();

  const [inPosts, inAvatars] = await Promise.all([
    db.select({ key: media.storageKey }).from(media).where(eq(media.storageKey, key)).limit(1),
    db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.avatarKey, key), ne(users.id, userId)))
      .limit(1),
  ]);
  if (inPosts.length > 0 || inAvatars.length > 0) throw reselect();

  const files = filesOf(key);
  const found = await Promise.all(files.map((file) => headObject(client, file)));
  const unusable: string[] = [];
  let complete = true;
  found.forEach((info, i) => {
    if (info === null) complete = false;
    else if (info.contentType !== 'image/webp' || info.size < 1 || info.size > MAX_OBJECT_BYTES) {
      complete = false;
      unusable.push(files[i]!);
    }
  });
  if (!complete) {
    try {
      await removeStoredObjects(client, unusable);
    } catch {
      // The sweep job removes what is left (conventions.md "削除").
    }
    throw reselect();
  }
}

/**
 * Changes the signed-in user's own display name, bio and (when `avatarKey` is sent) icon. Order:
 * login, input checks, storage checks, one UPDATE of the session user's row, then the old icon's
 * files are removed (a failure is recorded in storage_orphans and never fails the save).
 * Saving the same input again gives the same result.
 */
export async function updateProfile(input: unknown, deps: UpdateProfileDeps): Promise<ProfileView> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const user = await requireUser(deps.headers, { env });

  const parsed = parseUpdateProfile(input);
  if (!parsed.ok) {
    const first = Object.values(parsed.fieldErrors)[0]?.[0];
    throw new AppError('VALIDATION', { fieldErrors: parsed.fieldErrors, message: first });
  }
  const { displayName, bio, avatarKey } = parsed.data;

  const db = getDb(env);
  const client = getStorageClient(env);
  const [current] = await db
    .select({ avatarKey: users.avatarKey })
    .from(users)
    .where(eq(users.id, user.id));
  const oldKey = current?.avatarKey ?? null;
  const replacing = avatarKey !== undefined && avatarKey !== oldKey;
  if (replacing) await checkAvatarKey(db, client, user.id, avatarKey);

  await db
    .update(users)
    .set({
      displayName,
      bio,
      ...(avatarKey !== undefined ? { avatarKey } : {}),
      updatedAt: new Date(deps.now ?? Date.now()),
    })
    .where(eq(users.id, user.id));

  // Only files in the user's own area are ever deleted (an older seed key may live elsewhere).
  if (replacing && oldKey !== null && oldKey.startsWith(`media/${user.id}/`)) {
    const remove = deps.removeObjects ?? removeStoredObjects;
    let failed: string[];
    try {
      failed = await remove(client, filesOf(oldKey));
    } catch {
      failed = filesOf(oldKey);
    }
    if (failed.length > 0) {
      try {
        await db
          .insert(storageOrphans)
          .values(
            failed.map((storageKey) => ({
              storageKey,
              createdAt: new Date(deps.now ?? Date.now()),
            })),
          )
          .onConflictDoNothing();
      } catch (error) {
        console.error(
          'storage_orphans insert failed',
          error instanceof Error ? error.name : 'unknown',
        );
      }
    }
  }
  return getProfile({ username: user.username }, { env, headers: deps.headers });
}
