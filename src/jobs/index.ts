import { cleanupOldNotifications } from './notification-cleanup.ts';
import { retryStorageOrphans } from './storage-orphans-retry.ts';
import { cleanupExpiredStories } from './story-cleanup.ts';
import type { Job, JobEnv } from './types.ts';

/**
 * The scheduled jobs, in the order they run: files that failed yesterday are retried first.
 * A new job is one line here and follows the rules of ADR-0049 (`.ts` imports, D1 `prepare`).
 */
export const jobs = {
  'storage-orphans-retry': retryStorageOrphans,
  'story-cleanup': cleanupExpiredStories,
  'notification-cleanup': cleanupOldNotifications,
} satisfies Record<string, Job>;

/**
 * Runs every job one after another. A failing job is logged by name and error class only (never
 * its message: it may hold SQL or paths) and the rest still run; the run then throws.
 */
export async function runAll(
  env: JobEnv,
  now: Date,
  deps: { jobs?: Record<string, Job> } = {},
): Promise<void> {
  const failed: string[] = [];
  for (const [name, job] of Object.entries(deps.jobs ?? jobs)) {
    try {
      const { deleted } = await job({ env, now });
      console.log(`${name}: deleted=${deleted}`);
    } catch (error) {
      console.error('job failed', name, error instanceof Error ? error.name : 'unknown');
      failed.push(name);
    }
  }
  if (failed.length > 0) throw new Error('ジョブが失敗しました: ' + failed.join('、'));
}
