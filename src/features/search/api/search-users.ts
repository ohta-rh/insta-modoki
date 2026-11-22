import { asc, or, sql } from 'drizzle-orm';
import type { AuthEnv } from '../../auth/api/auth-env';
import { requireUser } from '../../auth';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { consume } from '../../../shared/security/rate-limit';
import { avatarUrl, type StorageEnv } from '../../../shared/storage';
import type { UserSummary } from '../../post';
import { RESULT_LIMIT, SEARCH_RATE_LIMIT } from '../model/limits';
import { escapeLike } from '../model/like-pattern';
import { normalizeQuery } from '../model/normalize-query';
import { parseSearchQuery } from '../model/schema';

/**
 * Users whose username or display name contains the text: username prefix first, then username
 * contains, then display name contains (ties: username), 20 at most. Order: login, input checks,
 * the per-minute limit, one query. Every value is a bound parameter; `%`, `_` and `\` in the text
 * are escaped so they match themselves. No cursor: the order is by relevance.
 */
export async function searchUsers(
  input: unknown,
  deps: { env?: AuthEnv & StorageEnv; headers: Headers; now?: number },
): Promise<{ items: UserSummary[] }> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const user = await requireUser(deps.headers, { env });

  const q = (input ?? {}) as { q?: unknown };
  const parsed = parseSearchQuery(q.q);
  if (!parsed.ok) {
    throw new AppError('VALIDATION', {
      fieldErrors: parsed.fieldErrors,
      message: parsed.fieldErrors.q[0],
    });
  }

  const db = getDb(env);
  await consume(`search:user:${user.id}`, SEARCH_RATE_LIMIT, 60, 1, { db, now: deps.now });

  const p = escapeLike(normalizeQuery(parsed.q));
  const rank = sql<number>`CASE WHEN ${users.username} LIKE ${p + '%'} ESCAPE '\\' THEN 0 WHEN ${users.username} LIKE ${'%' + p + '%'} ESCAPE '\\' THEN 1 ELSE 2 END`;
  const rows = await db
    .select({
      username: users.username,
      displayName: users.displayName,
      avatarKey: users.avatarKey,
    })
    .from(users)
    .where(
      or(
        sql`${users.username} LIKE ${'%' + p + '%'} ESCAPE '\\'`,
        sql`${users.displayName} LIKE ${'%' + p + '%'} ESCAPE '\\'`,
      ),
    )
    .orderBy(rank, asc(users.username))
    .limit(RESULT_LIMIT);

  return {
    items: rows.map((r) => ({
      username: r.username,
      displayName: r.displayName,
      avatarUrl: avatarUrl(env, r.avatarKey),
    })),
  };
}
