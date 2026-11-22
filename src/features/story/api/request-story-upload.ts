import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { newId } from '../../../shared/db/id';
import { getRequestEnv } from '../../../shared/db/request';
import { AppError } from '../../../shared/errors';
import { consume } from '../../../shared/security/rate-limit';
import { getStorageClient, presignPut, type StorageEnv } from '../../../shared/storage';
import { parseStoryUploadRequest } from '../model/schema';

export type StoryUploadSlot =
  | { key: string; putUrls: { orig: string; w320: string; w640: string; w1080: string } }
  | { key: string; putUrls: { video: string } };

const PHOTO_FILES = ['orig', 'w320', 'w640', 'w1080'] as const;
/** A presigned URL lives 5 minutes (ADR-0021). */
const URL_TTL_SEC = 300;
/** The same 300 an hour as photo posts (docs/architecture/conventions.md "上限とレート制限"). */
const HOURLY_UPLOAD_LIMIT = 300;

/**
 * Issues presigned PUT URLs for one story: four WebP files for a photo, `video.mp4` for a video.
 * Order: login, input checks, rate limit, issue. The server alone makes the key
 * (`stories/<session user id>/<UUIDv7>`); no key is read from the input.
 */
export async function requestStoryUpload(
  input: unknown,
  deps: { env?: AuthEnv & StorageEnv; headers: Headers; now?: number },
): Promise<StoryUploadSlot> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const user = await requireUser(deps.headers, { env });

  const parsed = parseStoryUploadRequest(input);
  if (!parsed.ok) {
    throw parsed.code === 'PAYLOAD_TOO_LARGE'
      ? new AppError('PAYLOAD_TOO_LARGE', { message: parsed.message })
      : new AppError('VALIDATION', { fieldErrors: parsed.fieldErrors, message: parsed.message });
  }

  await consume(`upload:user:${user.id}`, HOURLY_UPLOAD_LIMIT, 3600, 1, {
    db: getDb(env),
    now: deps.now,
  });

  const client = getStorageClient(env);
  const key = `stories/${user.id}/${newId()}`;
  const sign = (name: string, contentType: string, contentLength: number) =>
    presignPut(client, {
      key: `${key}/${name}`,
      contentType,
      contentLength,
      expiresInSec: URL_TTL_SEC,
      now: deps.now,
    });

  const { data } = parsed;
  if (data.kind === 'video') {
    return { key, putUrls: { video: await sign('video.mp4', 'video/mp4', data.size) } };
  }
  const putUrls = {} as Extract<StoryUploadSlot, { putUrls: { orig: string } }>['putUrls'];
  for (const name of PHOTO_FILES) {
    putUrls[name] = await sign(`${name}.webp`, 'image/webp', data.file.variantSizes[name]);
  }
  return { key, putUrls };
}
