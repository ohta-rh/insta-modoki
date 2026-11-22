import { and, asc, eq, gt, inArray } from 'drizzle-orm';
import type { Db } from '../../../shared/db/client';
import { follows, users } from '../../../shared/db/schema';
import { stories, storyViews } from './schema';

/** D1 allows 100 bound variables in one statement; `now` and the rest use a few of them. */
const MAX_AUTHOR_IDS = 90;

export type AuthorFilter = { ids: string[] } | { followedBy: string };

/**
 * The stories that have not expired (`expires_at > now`, so the instant of expiry is out), oldest
 * first, with the author's name and icon key. `now` comes from the caller so a test can fix it.
 * `ids` takes 1 to 90 authors; more or none throws. Anything that limits who may see a story
 * (a private account, #66) is added here.
 */
export async function findActiveStories(db: Db, o: { authors: AuthorFilter; now: number }) {
  let who;
  if ('ids' in o.authors) {
    if (o.authors.ids.length < 1 || o.authors.ids.length > MAX_AUTHOR_IDS) {
      throw new Error(`ids は 1〜${MAX_AUTHOR_IDS} 件です: ${o.authors.ids.length}`);
    }
    who = inArray(stories.authorId, o.authors.ids);
  } else {
    who = inArray(
      stories.authorId,
      db
        .select({ id: follows.followeeId })
        .from(follows)
        .where(eq(follows.followerId, o.authors.followedBy)),
    );
  }
  return db
    .select({
      id: stories.id,
      authorId: stories.authorId,
      type: stories.type,
      storageKey: stories.storageKey,
      width: stories.width,
      height: stories.height,
      durationMs: stories.durationMs,
      altText: stories.altText,
      createdAt: stories.createdAt,
      expiresAt: stories.expiresAt,
      username: users.username,
      displayName: users.displayName,
      avatarKey: users.avatarKey,
    })
    .from(stories)
    .innerJoin(users, eq(users.id, stories.authorId))
    .where(and(who, gt(stories.expiresAt, new Date(o.now))))
    .orderBy(asc(stories.createdAt), asc(stories.id));
}

/** The ids of the unexpired stories this viewer has opened. */
export async function findSeenStoryIds(
  db: Db,
  o: { viewerId: string; now: number },
): Promise<Set<string>> {
  const rows = await db
    .select({ id: storyViews.storyId })
    .from(storyViews)
    .innerJoin(stories, eq(stories.id, storyViews.storyId))
    .where(and(eq(storyViews.viewerId, o.viewerId), gt(stories.expiresAt, new Date(o.now))));
  return new Set(rows.map((r) => r.id));
}
