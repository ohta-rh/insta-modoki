import { eq } from 'drizzle-orm';
import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { posts } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { removeObjects as removeStoredObjects, type StorageEnv } from '../../../shared/storage';
import { isPostId } from '../model/schema';
import { removePost } from './remove-post';

export type DeletePostDeps = {
  env?: AuthEnv & StorageEnv;
  headers: Headers;
  /** Replaced by tests to make the storage fail. */
  removeObjects?: typeof removeStoredObjects;
  now?: number;
};

/**
 * Deletes the signed-in user's own post (the removal itself is `removePost`).
 * Order: login, id check, lookup, owner check.
 */
export async function deletePost(input: unknown, deps: DeletePostDeps): Promise<{ deleted: true }> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const user = await requireUser(deps.headers, { env });

  const postId = (input as { postId?: unknown } | null)?.postId;
  if (!isPostId(postId)) throw new AppError('NOT_FOUND');

  const db = getDb(env);
  const [post] = await db
    .select({ authorId: posts.authorId })
    .from(posts)
    .where(eq(posts.id, postId));
  // A post that is already gone has no owner to check: the same answer for everyone signed in.
  if (!post) return { deleted: true };
  if (post.authorId !== user.id) throw new AppError('FORBIDDEN');

  await removePost(env, postId, { removeObjects: deps.removeObjects, now: deps.now });
  return { deleted: true };
}
