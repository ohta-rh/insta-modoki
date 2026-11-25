import { runAll } from './index.ts';
import type { JobEnv } from './types.ts';

/** Daily at 18:00 UTC = 03:00 in Japan. Must equal `triggers.crons` in wrangler.jsonc. */
export const DAILY_CRON = '0 18 * * *';

/**
 * The Worker's `scheduled` handler. Awaited (not `waitUntil`) so a failure lands in Cloudflare's
 * run record; an unknown expression runs nothing.
 */
export async function onScheduled(
  controller: { cron: string; scheduledTime: number },
  env: JobEnv,
): Promise<void> {
  if (controller.cron !== DAILY_CRON) {
    console.error('unknown cron');
    return;
  }
  await runAll(env, new Date(controller.scheduledTime));
}
