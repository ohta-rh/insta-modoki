import { eq } from 'drizzle-orm';
import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb, type Db } from '../../../shared/db/client';
import { newId } from '../../../shared/db/id';
import { getRequestEnv } from '../../../shared/db/request';
import { AppError } from '../../../shared/errors';
import { consume } from '../../../shared/security/rate-limit';
import {
  getRange,
  getStorageClient,
  headObject,
  type StorageClient,
  type StorageEnv,
} from '../../../shared/storage';
import { stories } from '../db/schema';
import {
  HOURLY_STORY_LIMIT,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_MS,
  NOT_UPLOADED,
  STORY_TTL_MS,
  VIDEO_TOO_LONG,
  VIDEO_UNREADABLE,
} from '../model/limits';
import { readMp4Info } from '../model/mp4-info';
import { parseCreateStory } from '../model/schema';

const PHOTO_FILES = ['orig', 'w320', 'w640', 'w1080'];
/** `stories/<owner>/<UUIDv7>`: the owner is any one segment; only the tail is checked here. */
const KEY_SHAPE =
  /^stories\/([^/]+)\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** The `stories` table allows 1 to 10,000 pixels. */
const MAX_PIXELS = 10_000;

const notUploaded = () => new AppError('VALIDATION', { message: NOT_UPLOADED });

/** Whether the error, or anything in its cause chain, has a message matching `pattern`. */
function hasMessage(error: unknown, pattern: RegExp): boolean {
  for (let e: unknown = error, i = 0; e && i < 5; i += 1) {
    if (pattern.test(e instanceof Error ? e.message : String(e))) return true;
    e = e instanceof Error ? e.cause : undefined;
  }
  return false;
}

async function existingStoryId(db: Db, storageKey: string): Promise<string | null> {
  const [row] = await db
    .select({ id: stories.id })
    .from(stories)
    .where(eq(stories.storageKey, storageKey))
    .limit(1);
  return row?.id ?? null;
}

/** A stored file must be of the expected type and size, else the upload is not complete. */
async function check(client: StorageClient, key: string, type: string, max: number) {
  const info = await headObject(client, key);
  if (info === null || info.contentType !== type || info.size < 1 || info.size > max) {
    throw notUploaded();
  }
  return info;
}

/**
 * Makes a story out of files already stored under `key`. Order: login, input checks, the key is
 * the caller's own (FORBIDDEN) and well shaped, a repeat of the same key (returns the first
 * result, not counted), the hourly limit, the storage checks, the video's length read from the
 * file itself (never from the client), then one insert.
 */
export async function createStory(
  input: unknown,
  deps: { env?: AuthEnv & StorageEnv; headers: Headers; now?: number },
): Promise<{ storyId: string }> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const user = await requireUser(deps.headers, { env });

  const parsed = parseCreateStory(input);
  if (!parsed.ok) {
    const first = Object.values(parsed.fieldErrors)[0]?.[0];
    throw new AppError('VALIDATION', { fieldErrors: parsed.fieldErrors, message: first });
  }
  const { key, type, altText } = parsed.data;

  const shape = KEY_SHAPE.exec(key);
  if (shape === null) throw notUploaded();
  if (shape[1] !== user.id) throw new AppError('FORBIDDEN');

  const db = getDb(env);
  const earlier = await existingStoryId(db, key);
  if (earlier !== null) return { storyId: earlier };

  await consume(`story:user:${user.id}`, HOURLY_STORY_LIMIT, 3600, 1, { db, now: deps.now });

  const client = getStorageClient(env);
  let width: number;
  let height: number;
  let durationMs: number | null = null;
  if (type === 'image') {
    // `parseCreateStory` requires both for a photo.
    width = parsed.data.width!;
    height = parsed.data.height!;
    await Promise.all(
      PHOTO_FILES.map((n) => check(client, `${key}/${n}.webp`, 'image/webp', MAX_PHOTO_BYTES)),
    );
  } else {
    const file = `${key}/video.mp4`;
    const info = await check(client, file, 'video/mp4', MAX_VIDEO_BYTES);
    const mp4 = await readMp4Info(
      (offset, length) => getRange(client, file, offset, length),
      info.size,
    );
    if (mp4 === null || mp4.durationMs < 1 || mp4.width > MAX_PIXELS || mp4.height > MAX_PIXELS) {
      throw new AppError('VALIDATION', { message: VIDEO_UNREADABLE });
    }
    if (mp4.durationMs > MAX_VIDEO_MS) {
      throw new AppError('VALIDATION', {
        message: VIDEO_TOO_LONG,
        fieldErrors: { media: [VIDEO_TOO_LONG] },
      });
    }
    ({ width, height, durationMs } = mp4);
  }

  const storyId = newId();
  const now = deps.now ?? Date.now();
  try {
    await db.insert(stories).values({
      id: storyId,
      authorId: user.id,
      type,
      storageKey: key,
      width,
      height,
      durationMs,
      altText,
      createdAt: new Date(now),
      expiresAt: new Date(now + STORY_TTL_MS),
    });
  } catch (error) {
    // A second call with the same key raced this one and won: return its story.
    if (hasMessage(error, /UNIQUE constraint failed: stories\.storage_key/)) {
      const winner = await existingStoryId(db, key);
      if (winner !== null) return { storyId: winner };
    }
    throw error;
  }
  return { storyId };
}
