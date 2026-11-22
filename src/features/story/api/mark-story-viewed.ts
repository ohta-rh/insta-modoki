import { eq } from 'drizzle-orm';
import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { AppError } from '../../../shared/errors';
import type { StorageEnv } from '../../../shared/storage';
import { stories, storyViews } from '../db/schema';
import { isStoryId, markStoryViewedInput } from '../model/schema';

export type MarkStoryViewedDeps = { env?: AuthEnv & StorageEnv; headers: Headers; now?: number };

/**
 * Records that the signed-in user has seen a story. Safe to call any number of times: the first
 * call makes the row, later ones change nothing, and a person's own story makes none. An expired,
 * missing or malformed id is NOT_FOUND; no session is UNAUTHENTICATED.
 */
export async function markStoryViewed(
  input: unknown,
  deps: MarkStoryViewedDeps,
): Promise<{ viewed: true }> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const me = await requireUser(deps.headers, { env });
  const parsed = markStoryViewedInput.safeParse(input);
  if (!parsed.success) throw new AppError('VALIDATION');
  const id = parsed.data.storyId;
  if (!isStoryId(id)) throw new AppError('NOT_FOUND');
  const now = deps.now ?? Date.now();
  const db = getDb(env);

  const story = await db
    .select({ authorId: stories.authorId, expiresAt: stories.expiresAt })
    .from(stories)
    .where(eq(stories.id, id))
    .get();
  if (!story || story.expiresAt.getTime() <= now) throw new AppError('NOT_FOUND');
  if (story.authorId !== me.id) {
    await db
      .insert(storyViews)
      .values({ storyId: id, viewerId: me.id, createdAt: new Date(now) })
      .onConflictDoNothing();
  }
  return { viewed: true };
}
