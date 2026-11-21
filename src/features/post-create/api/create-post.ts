import { and, eq, inArray } from 'drizzle-orm';
import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb, type Db } from '../../../shared/db/client';
import { newId } from '../../../shared/db/id';
import { getRequestEnv } from '../../../shared/db/request';
import { media, posts, users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { consume } from '../../../shared/security/rate-limit';
import {
  getStorageClient,
  headObject,
  removeObjects,
  type StorageClient,
  type StorageEnv,
} from '../../../shared/storage';
import { NOT_UPLOADED_MESSAGE, parseCreatePost } from '../model/schema';

/** 30 posts per hour per user (docs/architecture/conventions.md "上限とレート制限"). */
const HOURLY_LIMIT = 30;
const VARIANTS = ['orig', 'w320', 'w640', 'w1080'];
/** A stored file may not be larger than a source photo is allowed to be. */
const MAX_OBJECT_BYTES = 10_485_760;
const KEY_TAIL = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const notUploaded = () => new AppError('VALIDATION', { message: NOT_UPLOADED_MESSAGE });

/** Whether the error, or anything in its cause chain, has a message matching `pattern`. */
function hasMessage(error: unknown, pattern: RegExp): boolean {
  for (let e: unknown = error, i = 0; e && i < 5; i += 1) {
    if (pattern.test(e instanceof Error ? e.message : String(e))) return true;
    e = e instanceof Error ? e.cause : undefined;
  }
  return false;
}

const isRequestIdClash = (error: unknown): boolean =>
  hasMessage(error, /UNIQUE constraint failed: posts\.author_id, posts\.client_request_id/);

async function existingPostId(db: Db, authorId: string, clientRequestId: string) {
  const [row] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.authorId, authorId), eq(posts.clientRequestId, clientRequestId)))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Every key must be the caller's own (`media/<user id>/<UUIDv7>`), listed once, used by no post
 * and no profile picture yet, and have its four WebP files in storage. Files that are there but
 * are not WebP or are too large are deleted; nothing else is.
 */
async function checkKeys(db: Db, client: StorageClient, userId: string, keys: string[]) {
  const prefix = `media/${userId}/`;
  const ownShape = (key: string) =>
    key.startsWith(prefix) && KEY_TAIL.test(key.slice(prefix.length));
  if (!keys.every(ownShape) || new Set(keys).size !== keys.length) throw notUploaded();

  const [inPosts, inAvatars] = await Promise.all([
    db
      .select({ key: media.storageKey })
      .from(media)
      .where(inArray(media.storageKey, keys))
      .limit(1),
    db.select({ key: users.avatarKey }).from(users).where(inArray(users.avatarKey, keys)).limit(1),
  ]);
  if (inPosts.length > 0 || inAvatars.length > 0) throw notUploaded();

  const files = keys.flatMap((key) => VARIANTS.map((name) => `${key}/${name}.webp`));
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
      await removeObjects(client, unusable);
    } catch {
      // The sweep job removes what is left (conventions.md "削除").
    }
    throw notUploaded();
  }
}

/**
 * Creates a post with 1 to 10 photos that `uploadImages` already stored. Order: login, input
 * checks, a repeat of the same `clientRequestId` (returns the first result, not counted), the
 * hourly limit, the storage checks, then one `db.batch` for the `posts` and `media` rows.
 */
export async function createPost(
  input: unknown,
  deps: { env?: AuthEnv & StorageEnv; headers: Headers; now?: number },
): Promise<{ postId: string }> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const user = await requireUser(deps.headers, { env });

  const parsed = parseCreatePost(input);
  if (!parsed.ok) {
    const first = Object.values(parsed.fieldErrors)[0]?.[0];
    throw new AppError('VALIDATION', { fieldErrors: parsed.fieldErrors, message: first });
  }
  const { caption, media: photos, clientRequestId } = parsed.data;

  const db = getDb(env);
  const earlier = await existingPostId(db, user.id, clientRequestId);
  if (earlier !== null) return { postId: earlier };

  await consume(`post:user:${user.id}`, HOURLY_LIMIT, 3600, 1, { db, now: deps.now });
  await checkKeys(
    db,
    getStorageClient(env),
    user.id,
    photos.map((p) => p.key),
  );

  const postId = newId();
  try {
    await db.batch([
      db.insert(posts).values({
        id: postId,
        authorId: user.id,
        caption,
        clientRequestId,
        createdAt: new Date(deps.now ?? Date.now()),
      }),
      ...photos.map((p, position) =>
        db.insert(media).values({
          id: newId(),
          postId,
          position,
          type: 'image',
          storageKey: p.key,
          width: p.width,
          height: p.height,
          altText: p.altText,
          thumbhash: p.thumbhash,
        }),
      ),
    ]);
  } catch (error) {
    // A second call with the same id raced this one and won: return its post.
    if (isRequestIdClash(error)) {
      const winner = await existingPostId(db, user.id, clientRequestId);
      if (winner !== null) return { postId: winner };
    }
    // Another post took one of these photos between the check and the insert.
    if (hasMessage(error, /UNIQUE constraint failed: media\.storage_key/)) throw notUploaded();
    throw error;
  }
  return { postId };
}
