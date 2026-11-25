import { desc, sql } from 'drizzle-orm';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { keysetBefore, readCursor, toPage } from '../../../shared/db/cursor';
import { getRequestEnv } from '../../../shared/db/request';
import { users } from '../../../shared/db/schema';
import { dataOrThrow } from '../model/parse-or-throw';
import { requireAdmin } from '../../auth';
import {
  ADMIN_PAGE_SIZE,
  parseListAdminUsers,
  type AdminPage,
  type AdminUserRow,
} from '../model/schema';
import type { AdminListDeps } from './deps';

/** `%`, `_` and `\` in the query are plain characters in a LIKE pattern. */
const likePrefix = (query: string) => `${query.replace(/[\\%_]/g, '\\$&')}%`;

/** One page (20) of users, the newest first; `query` keeps the user names that start with it. */
export async function listAdminUsers(
  input: unknown,
  deps: AdminListDeps,
): Promise<AdminPage<AdminUserRow>> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv>());
  await requireAdmin(deps.headers, { env });
  const { query, cursor: raw } = dataOrThrow(parseListAdminUsers(input), null);
  const cursor = readCursor(raw);
  const prefix = query?.trim().toLowerCase();

  const rows = await getDb(env)
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      createdAt: users.createdAt,
      postCount: sql<number>`(SELECT count(*) FROM posts WHERE posts.author_id = users.id)`,
    })
    .from(users)
    .where(
      prefix
        ? sql`${users.username} LIKE ${likePrefix(prefix)} ESCAPE '\\' AND ${keysetBefore(users.createdAt, users.id, cursor) ?? sql`1`}`
        : keysetBefore(users.createdAt, users.id, cursor),
    )
    .orderBy(desc(users.createdAt), desc(users.id))
    .limit(ADMIN_PAGE_SIZE + 1);
  const page = toPage(rows, ADMIN_PAGE_SIZE);
  return {
    items: page.items.map((r) => ({
      username: r.username,
      displayName: r.displayName,
      role: r.role,
      postCount: Number(r.postCount),
      createdAt: r.createdAt,
    })),
    nextCursor: page.nextCursor,
  };
}
