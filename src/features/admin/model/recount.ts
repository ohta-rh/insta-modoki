import { inArray, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Db } from '../../../shared/db/client';
import { posts } from '../../../shared/db/schema';

/** D1 binds at most 100 values per statement; the ids go 90 at a time. */
export const RECOUNT_CHUNK = 90;

/**
 * Statements that set `like_count` and `comment_count` of the given posts from the rows that are
 * actually there (the two denormalised counters of data-model.md). Run them in a `db.batch`
 * after the delete that made them stale.
 */
export function recountPostCounters(db: Db, postIds: string[]): BatchItem<'sqlite'>[] {
  const statements: BatchItem<'sqlite'>[] = [];
  for (let i = 0; i < postIds.length; i += RECOUNT_CHUNK) {
    statements.push(
      db
        .update(posts)
        .set({
          likeCount: sql`(SELECT count(*) FROM likes WHERE likes.post_id = posts.id)`,
          commentCount: sql`(SELECT count(*) FROM comments WHERE comments.post_id = posts.id)`,
        })
        .where(inArray(posts.id, postIds.slice(i, i + RECOUNT_CHUNK))),
    );
  }
  return statements;
}
