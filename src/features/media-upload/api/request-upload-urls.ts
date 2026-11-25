import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { newId } from '../../../shared/db/id';
import { getRequestEnv } from '../../../shared/db/request';
import { AppError } from '../../../shared/errors';
import { consume } from '../../../shared/security/rate-limit';
import { getStorageClient, presignPut, type StorageEnv } from '../../../shared/storage';
import { parseUploadRequest } from '../model/schema';

export type UploadVariant = 'orig' | 'w320' | 'w640' | 'w1080';
export type UploadSlot = { key: string; putUrls: Record<UploadVariant, string> };

const VARIANTS: UploadVariant[] = ['orig', 'w320', 'w640', 'w1080'];
/** A presigned URL lives 5 minutes (ADR-0021). */
const URL_TTL_SEC = 300;
/** 300 photos per hour per user (docs/architecture/conventions.md "上限とレート制限"). */
const HOURLY_LIMIT = 300;

/**
 * Issues presigned PUT URLs for 1 to 10 photos. Order: login, input checks, rate limit, issue.
 * The server alone makes the key (`media/<session user id>/<UUIDv7>`); no key is read from the input.
 */
export async function requestUploadUrls(
  input: unknown,
  deps: { env?: AuthEnv & StorageEnv; headers: Headers; now?: number },
): Promise<{ uploads: UploadSlot[] }> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const user = await requireUser(deps.headers, { env });

  const parsed = parseUploadRequest(input);
  if (!parsed.ok) {
    throw parsed.code === 'PAYLOAD_TOO_LARGE'
      ? new AppError('PAYLOAD_TOO_LARGE')
      : new AppError('VALIDATION', { fieldErrors: parsed.fieldErrors });
  }
  const { files } = parsed.data;

  await consume(`upload:user:${user.id}`, HOURLY_LIMIT, 3600, files.length, {
    db: getDb(env),
    now: deps.now,
  });

  const client = getStorageClient(env);
  const uploads: UploadSlot[] = [];
  for (const file of files) {
    const key = `media/${user.id}/${newId()}`;
    const putUrls = {} as Record<UploadVariant, string>;
    for (const name of VARIANTS) {
      putUrls[name] = await presignPut(client, {
        key: `${key}/${name}.webp`,
        contentType: 'image/webp',
        contentLength: file.variantSizes[name],
        expiresInSec: URL_TTL_SEC,
        now: deps.now,
      });
    }
    uploads.push({ key, putUrls });
  }
  return { uploads };
}
