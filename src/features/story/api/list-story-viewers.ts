import { and, desc, eq } from 'drizzle-orm';
import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import type { Page, UserSummary } from '../../post';
import { keysetBefore, readCursor, toPage } from '../../../shared/db/cursor';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { avatarUrl, type StorageEnv } from '../../../shared/storage';
import { stories, storyViews } from '../db/schema';
import { VIEWERS_PAGE_SIZE } from '../model/limits';
import { isStoryId, listStoryViewersInput } from '../model/schema';

export type ListStoryViewersDeps = { env?: AuthEnv & StorageEnv; headers: Headers; now?: number };

/**
 * The people who viewed a story, newest first (ties: larger user id first), 20 a page. Only the
 * author may read it (FORBIDDEN otherwise). A missing, expired or malformed story id is NOT_FOUND,
 * a broken cursor is VALIDATION, no session is UNAUTHENTICATED.
 */
export async function listStoryViewers(
  input: unknown,
  deps: ListStoryViewersDeps,
): Promise<Page<UserSummary>> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const me = await requireUser(deps.headers, { env });
  const parsed = listStoryViewersInput.safeParse(input);
  if (!parsed.success) throw new AppError('VALIDATION');
  const after = readCursor(parsed.data.cursor);
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
  if (story.authorId !== me.id) throw new AppError('FORBIDDEN');

  const rows = await db
    .select({
      viewerId: storyViews.viewerId,
      createdAt: storyViews.createdAt,
      username: users.username,
      displayName: users.displayName,
      avatarKey: users.avatarKey,
    })
    .from(storyViews)
    .innerJoin(users, eq(users.id, storyViews.viewerId))
    .where(
      and(
        eq(storyViews.storyId, id),
        keysetBefore(storyViews.createdAt, storyViews.viewerId, after),
      ),
    )
    .orderBy(desc(storyViews.createdAt), desc(storyViews.viewerId))
    .limit(VIEWERS_PAGE_SIZE + 1);
  const page = toPage(rows, VIEWERS_PAGE_SIZE, (r) => ({ createdAt: r.createdAt, id: r.viewerId }));
  return {
    items: page.items.map((r) => ({
      username: r.username,
      displayName: r.displayName,
      avatarUrl: avatarUrl(env, r.avatarKey),
    })),
    nextCursor: page.nextCursor,
  };
}
