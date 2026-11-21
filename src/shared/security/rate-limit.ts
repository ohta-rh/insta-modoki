import { sql } from 'drizzle-orm';
import { AppError } from '../errors';
import { rateLimits } from '../db/schema';
import type { Db } from '../db/client';
import { getRequestDb } from '../db/request';

export type ConsumeDeps = {
  /** The database; defaults to the current request's D1. */
  db?: Db;
  /** The current time in epoch milliseconds; tests pass a fixed value. */
  now?: number;
};

/**
 * Counts `cost` against `key` in the fixed window of `windowSec` seconds containing `now`, and
 * throws RATE_LIMITED once the window's count would exceed `limit`. One SQL statement (an upsert),
 * so concurrent calls never lose a count. An over-limit call still counts.
 */
export async function consume(
  key: string,
  limit: number,
  windowSec: number,
  cost = 1,
  deps: ConsumeDeps = {},
): Promise<void> {
  const db = deps.db ?? (await getRequestDb());
  const now = deps.now ?? Date.now();
  const windowMs = windowSec * 1000;
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: cost })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + ${cost}` },
    })
    .returning({ count: rateLimits.count });
  if (row === undefined || row.count > limit) {
    throw new AppError('RATE_LIMITED', {
      retryAfterSec: Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)),
    });
  }
}
