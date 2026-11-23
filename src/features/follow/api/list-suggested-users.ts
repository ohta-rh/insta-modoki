import { getSessionUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getRequestEnv } from '../../../shared/db/request';
import { AppError } from '../../../shared/errors';
import { avatarUrl, type StorageEnv } from '../../../shared/storage';
import { listSuggestedUsersInput, SUGGEST_LIMIT, type SuggestedUser } from '../model/schema';

export type ListSuggestedDeps = { env?: AuthEnv & StorageEnv; headers?: Headers };

// One statement, one bound value (?1, the viewer): the people the viewer's followees follow and the
// viewer does not, most-followed-by-them first, newest account first on a tie; then, to fill up to
// the limit, everyone else by follower count. The viewer is never in it (docs/architecture/routes.md).
const QUERY = `
WITH mine AS (SELECT followee_id FROM follows WHERE follower_id = ?1),
via AS (
  SELECT f.followee_id AS id, COUNT(*) AS n, MIN(fu.username) AS first_name
  FROM follows f
  JOIN mine m ON f.follower_id = m.followee_id
  JOIN users fu ON fu.id = f.follower_id
  GROUP BY f.followee_id),
pop AS (SELECT followee_id AS id, COUNT(*) AS followers FROM follows GROUP BY followee_id)
SELECT u.id, u.username, u.display_name, u.avatar_key,
       COALESCE(via.n, 0) AS n, via.first_name, COALESCE(pop.followers, 0) AS followers
FROM users u
LEFT JOIN via ON via.id = u.id
LEFT JOIN pop ON pop.id = u.id
WHERE u.id <> ?1 AND u.id NOT IN (SELECT followee_id FROM mine)
ORDER BY n DESC,
         CASE WHEN COALESCE(via.n, 0) > 0 THEN 0 ELSE COALESCE(pop.followers, 0) END DESC,
         u.created_at DESC, u.id DESC
LIMIT ${SUGGEST_LIMIT}`;

type Row = {
  username: string;
  display_name: string;
  avatar_key: string | null;
  n: number;
  first_name: string | null;
};

const reasonOf = (n: number, firstName: string | null): string =>
  n === 0 || firstName === null
    ? 'おすすめ'
    : n === 1
      ? `${firstName} さんがフォロー中`
      : `${firstName} さん他 ${n - 1} 人がフォロー中`;

/**
 * Up to 5 people the signed-in user may want to follow, each with the reason in one sentence.
 * The viewer is always the session's user: the input is strictly empty, so no one else's
 * suggestions can be asked for. No HTTP entry and no Server Action: only the home's Server
 * Component calls it.
 */
export async function listSuggestedUsers(
  input: unknown = {},
  deps: ListSuggestedDeps = {},
): Promise<{ items: SuggestedUser[] }> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const viewer = await getSessionUser(deps.headers ?? new Headers(), { env });
  if (!viewer) throw new AppError('UNAUTHENTICATED');
  if (!listSuggestedUsersInput.safeParse(input).success) throw new AppError('VALIDATION');

  const { results } = (await env.DB.prepare(QUERY).bind(viewer.id).all()) as { results: Row[] };
  return {
    items: results.map((r) => ({
      username: r.username,
      displayName: r.display_name,
      avatarUrl: avatarUrl(env, r.avatar_key),
      reason: reasonOf(r.n, r.first_name),
    })),
  };
}
