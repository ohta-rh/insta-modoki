import { eq, sql } from 'drizzle-orm';
import { removePost } from '../../post';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { newId } from '../../../shared/db/id';
import { getRequestEnv } from '../../../shared/db/request';
import { adminActions, posts } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import type { StorageEnv } from '../../../shared/storage';
import { dataOrThrow } from '../model/parse-or-throw';
import { requireAdmin } from '../../auth';
import { parseAdminDeletePost } from '../model/schema';
import type { AdminDeps } from './deps';

/**
 * Deletes any post, as an administrator: the row and the `admin_actions` record go in one batch
 * (`removePost`), then the files. A failed delete (FORBIDDEN, NOT_FOUND) records nothing.
 */
export async function adminDeletePost(input: unknown, deps: AdminDeps): Promise<{ deleted: true }> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const admin = await requireAdmin(deps.headers, { env });
  const { postId } = dataOrThrow(parseAdminDeletePost(input), 'postId');

  const db = getDb(env);
  const [post] = await db.select({ id: posts.id }).from(posts).where(eq(posts.id, postId));
  if (!post) throw new AppError('NOT_FOUND');

  const now = deps.now ?? Date.now();
  await removePost(env, postId, {
    extra: [
      // Recorded from the post's own row, before the delete in the same batch: a delete that
      // lost a race (the row is already gone) writes no second record.
      db.insert(adminActions).select(
        db
          .select({
            id: sql<string>`${newId()}`.as('id'),
            adminId: sql<string>`${admin.id}`.as('adminId'),
            action: sql<string>`'delete_post'`.as('action'),
            targetId: posts.id,
            createdAt: sql<number>`${now}`.as('createdAt'),
          })
          .from(posts)
          .where(eq(posts.id, postId)),
      ),
    ],
    removeObjects: deps.removeObjects,
    now,
  });
  return { deleted: true };
}
