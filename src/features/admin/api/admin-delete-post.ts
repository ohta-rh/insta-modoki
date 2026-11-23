import { eq } from 'drizzle-orm';
import { removePost } from '../../post';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { newId } from '../../../shared/db/id';
import { getRequestEnv } from '../../../shared/db/request';
import { adminActions, posts } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import type { StorageEnv } from '../../../shared/storage';
import { dataOrThrow } from '../model/parse-or-throw';
import { requireAdmin } from '../model/require-admin';
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
      db.insert(adminActions).values({
        id: newId(),
        adminId: admin.id,
        action: 'delete_post',
        targetId: postId,
        createdAt: new Date(now),
      }),
    ],
    removeObjects: deps.removeObjects,
    now,
  });
  return { deleted: true };
}
