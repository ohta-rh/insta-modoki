import { getSessionUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { AppError } from '../../../shared/errors';
import type { StorageEnv } from '../../../shared/storage';
import { isPostId, type PostView } from '../model/schema';
import { loadPostViews } from './load-post-views';

export type GetPostDeps = { env?: AuthEnv & StorageEnv; headers: Headers };

/**
 * One post as a screen shows it. Anyone may read a post, so no login is needed; likedByMe is
 * only true for a signed-in viewer who liked it. A missing post or a non-UUID id is NOT_FOUND.
 */
export async function getPost(input: unknown, deps: GetPostDeps): Promise<PostView> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const postId = (input as { postId?: unknown } | null)?.postId;
  if (!isPostId(postId)) throw new AppError('NOT_FOUND');

  const viewer = await getSessionUser(deps.headers, { env });
  const [post] = await loadPostViews(getDb(env), env, [postId], viewer?.id ?? null);
  if (!post) throw new AppError('NOT_FOUND');
  return post;
}
