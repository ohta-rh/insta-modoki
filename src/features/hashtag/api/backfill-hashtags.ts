import { asc, count, gt } from 'drizzle-orm';
import type { Db } from '../../../shared/db/client';
import { posts } from '../../../shared/db/schema';
import { MAX_HASHTAGS, extractHashtags, isTagName } from '../../../shared/hashtag';
import { hashtagStatements } from '../db/hashtag-statements';
import { postHashtags } from '../db/schema';

/**
 * Creates the tags of posts that were made before tags were stored. Posts are read `batchSize` at
 * a time in id order (keyset, no OFFSET); each page is one `db.batch`. A post keeps its first 30
 * tags and skips names that cannot be a tag (over 100 characters). `links` is how many
 * `post_hashtags` rows this run added, so a second run returns 0.
 */
export async function backfillHashtags(
  db: Db,
  options: { batchSize?: number } = {},
): Promise<{ posts: number; links: number }> {
  const batchSize = options.batchSize ?? 200;
  const total = async () => (await db.select({ n: count() }).from(postHashtags))[0]?.n ?? 0;
  const before = await total();

  let scanned = 0;
  let lastId: string | null = null;
  for (;;) {
    const page = await db
      .select({ id: posts.id, caption: posts.caption, createdAt: posts.createdAt })
      .from(posts)
      .where(lastId === null ? undefined : gt(posts.id, lastId))
      .orderBy(asc(posts.id))
      .limit(batchSize);
    if (page.length === 0) break;
    scanned += page.length;
    lastId = page[page.length - 1]!.id;

    const statements = page.flatMap((post) =>
      hashtagStatements(db, {
        postId: post.id,
        names: extractHashtags(post.caption).filter(isTagName).slice(0, MAX_HASHTAGS),
        createdAt: post.createdAt,
      }),
    );
    if (statements.length > 0) await db.batch(statements as [(typeof statements)[0]]);
    if (page.length < batchSize) break;
  }
  return { posts: scanned, links: (await total()) - before };
}
