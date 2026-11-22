import { inArray, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Db } from '../../../shared/db/client';
import { newId } from '../../../shared/db/id';
import { hashtags, postHashtags } from './schema';

/**
 * The statements that store a post's tags, to be put at the end of the `db.batch` that creates
 * the post (one transaction, ADR-0019). `names` are normalized and distinct (at most 30). Each
 * name is inserted if new (one statement, 2 variables), then one insert-select links the post
 * to all of them (at most 32 variables, under D1's 100). No names, no statements.
 */
export function hashtagStatements(
  db: Db,
  input: { postId: string; names: readonly string[]; createdAt: Date },
): BatchItem<'sqlite'>[] {
  const { postId, names, createdAt } = input;
  if (names.length === 0) return [];
  return [
    ...names.map((name) =>
      db
        .insert(hashtags)
        .values({ id: newId(), name })
        .onConflictDoNothing({ target: hashtags.name }),
    ),
    db
      .insert(postHashtags)
      .select(
        db
          .select({
            postId: sql<string>`${postId}`.as('post_id'),
            hashtagId: hashtags.id,
            createdAt: sql<number>`${createdAt.getTime()}`.as('created_at'),
          })
          .from(hashtags)
          .where(inArray(hashtags.name, [...names])),
      )
      .onConflictDoNothing(),
  ];
}
