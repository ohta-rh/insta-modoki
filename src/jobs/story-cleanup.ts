import { getStorageClient } from '../shared/storage/client.ts';
import { removeObjects as removeStorageObjects } from '../shared/storage/remove.ts';
import type { Job } from './types.ts';

/** Rows deleted per statement: D1 allows 100 bound variables, and one round costs 2 queries. */
const PAGE = 100;
/** At most 10 rounds (1,000 rows) per run: inside the free plan's 50 queries / 50 subrequests. */
const MAX_ROUNDS = 10;
const PHOTO_FILES = ['orig', 'w320', 'w640', 'w1080'].map((n) => `${n}.webp`);

type Deleted = { type: string; storage_key: string };

/** The object keys a story's `storage_key` stands for (derived from its type, never listed). */
const keysOf = ({ type, storage_key }: Deleted): string[] =>
  type === 'video' ? [`${storage_key}/video.mp4`] : PHOTO_FILES.map((f) => `${storage_key}/${f}`);

/**
 * Deletes the stories whose `expires_at` has passed (their `story_views` cascade), then their
 * files. A file that cannot be removed goes to `storage_orphans`; the row is never restored.
 */
export const cleanupExpiredStories: Job = async ({ env, now, removeObjects }) => {
  const remove = removeObjects ?? removeStorageObjects;
  const client = getStorageClient(env);
  let deleted = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { results } = await env.DB.prepare(
      'DELETE FROM stories WHERE id IN (SELECT id FROM stories WHERE expires_at <= ?1 ORDER BY expires_at, id LIMIT 100) RETURNING type, storage_key',
    )
      .bind(now.getTime())
      .all<Deleted>();
    if (results.length === 0) break;
    deleted += results.length;
    const failed = await remove(client, results.flatMap(keysOf));
    if (failed.length > 0) {
      await env.DB.prepare(
        'INSERT INTO storage_orphans (storage_key, created_at, attempts) SELECT value, ?2, 0 FROM json_each(?1) WHERE true ON CONFLICT (storage_key) DO NOTHING',
      )
        .bind(JSON.stringify(failed), now.getTime())
        .run();
    }
    if (results.length < PAGE) break;
  }
  return { deleted };
};
