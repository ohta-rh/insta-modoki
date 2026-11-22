import { getStorageClient } from '../shared/storage/client.ts';
import { removeObjects as removeStorageObjects } from '../shared/storage/remove.ts';
import type { Job } from './types.ts';

/** A key that still cannot be removed after this many retries is left for a person to look at. */
const MAX_ATTEMPTS = 10;

/**
 * Retries the files whose removal failed earlier (`storage_orphans`, written by the post delete
 * and the story cleanup): up to 100 keys per run, one storage request.
 */
export const retryStorageOrphans: Job = async ({ env, removeObjects }) => {
  const rows = (
    await env.DB.prepare(
      `SELECT storage_key, attempts FROM storage_orphans WHERE attempts < ${MAX_ATTEMPTS} ORDER BY created_at, storage_key LIMIT 100`,
    )
      .bind()
      .all<{ storage_key: string; attempts: number }>()
  ).results;
  if (rows.length === 0) return { deleted: 0 };

  const keys = rows.map((r) => r.storage_key);
  const failed = new Set(await (removeObjects ?? removeStorageObjects)(getStorageClient(env), keys));
  const removed = keys.filter((k) => !failed.has(k));

  if (removed.length > 0) {
    await env.DB.prepare(
      'DELETE FROM storage_orphans WHERE storage_key IN (SELECT value FROM json_each(?1))',
    )
      .bind(JSON.stringify(removed))
      .run();
  }
  if (failed.size > 0) {
    const bumped = (
      await env.DB.prepare(
        'UPDATE storage_orphans SET attempts = attempts + 1 WHERE storage_key IN (SELECT value FROM json_each(?1)) RETURNING attempts',
      )
        .bind(JSON.stringify([...failed]))
        .all<{ attempts: number }>()
    ).results;
    const exhausted = bumped.filter((r) => r.attempts >= MAX_ATTEMPTS).length;
    if (exhausted > 0) {
      console.error(`storage_orphans: 再試行の上限に達しました: ${exhausted} 件`);
    }
  }
  return { deleted: removed.length };
};
