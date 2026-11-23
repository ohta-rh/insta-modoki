import { desc, eq } from 'drizzle-orm';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { keysetBefore, readCursor, toPage } from '../../../shared/db/cursor';
import { getRequestEnv } from '../../../shared/db/request';
import { posts, users } from '../../../shared/db/schema';
import { dataOrThrow } from '../model/parse-or-throw';
import { requireAdmin } from '../model/require-admin';
import {
  ADMIN_PAGE_SIZE,
  CAPTION_EXCERPT_LENGTH,
  parseListAdminPosts,
  type AdminPage,
  type AdminPostRow,
} from '../model/schema';
import type { AdminListDeps } from './deps';

/** One page (20) of posts, the newest first, for the administrator's screen. */
export async function listAdminPosts(
  input: unknown,
  deps: AdminListDeps,
): Promise<AdminPage<AdminPostRow>> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv>());
  await requireAdmin(deps.headers, { env });
  const { cursor: raw } = dataOrThrow(parseListAdminPosts(input), null);
  const cursor = readCursor(raw);

  const rows = await getDb(env)
    .select({
      id: posts.id,
      authorUsername: users.username,
      caption: posts.caption,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .where(keysetBefore(posts.createdAt, posts.id, cursor))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(ADMIN_PAGE_SIZE + 1);
  const page = toPage(rows, ADMIN_PAGE_SIZE);
  return {
    items: page.items.map((r) => ({
      id: r.id,
      authorUsername: r.authorUsername,
      captionExcerpt: Array.from(r.caption).slice(0, CAPTION_EXCERPT_LENGTH).join(''),
      createdAt: r.createdAt,
    })),
    nextCursor: page.nextCursor,
  };
}
