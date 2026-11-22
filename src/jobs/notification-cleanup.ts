import type { Job, JobContext } from './types.ts';

/** A notification is deleted once it is older than this (proposal: 90 days from creation). */
export const NOTIFICATION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
/** Rows per DELETE and statements per run: 5,000 rows x 6 writes stays inside D1's free writes. */
export const CLEANUP_BATCH_SIZE = 500;
export const CLEANUP_MAX_BATCHES = 10;

// D1 cannot rely on `DELETE ... LIMIT`, so the oldest ids are picked by a subquery on the
// `notifications_created_at_idx` index.
const DELETE_OLD =
  'DELETE FROM notifications WHERE id IN (SELECT id FROM notifications WHERE created_at < ?1 ORDER BY created_at LIMIT ?2) RETURNING id';

/**
 * Deletes notifications created more than 90 days before `ctx.now` (read or not, any type), at
 * most `maxBatches` statements of `batchSize` rows. What is left is deleted by the next run.
 */
export async function cleanupOldNotifications(
  ctx: JobContext,
  opts: { batchSize?: number; maxBatches?: number } = {},
): Promise<{ deleted: number }> {
  const batchSize = opts.batchSize ?? CLEANUP_BATCH_SIZE;
  const maxBatches = opts.maxBatches ?? CLEANUP_MAX_BATCHES;
  const cutoff = ctx.now.getTime() - NOTIFICATION_RETENTION_MS;
  let deleted = 0;
  for (let i = 0; i < maxBatches; i += 1) {
    const { results } = await ctx.env.DB.prepare(DELETE_OLD)
      .bind(cutoff, batchSize)
      .all<{ id: string }>();
    deleted += results.length;
    if (results.length < batchSize) break;
  }
  return { deleted };
}
cleanupOldNotifications satisfies Job;
