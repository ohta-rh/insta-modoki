import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, type DbEnv } from '../../../shared/db/client';
import { follows, media, posts, rateLimits, users } from '../../../shared/db/schema';

// The setup writes of the E2E suite, done by the Worker through its own D1 binding. A second
// process writing to the same SQLite file made the app fail with SQLITE_BUSY (ADR-0041). Every
// operation is named and its input bounded; nothing here accepts SQL.
const text = (max: number) => z.string().min(1).max(max);
const id = z.string().min(1).max(64);
const ms = z.number().int().min(0).max(8.64e15);

const mediaRow = z.strictObject({
  id,
  position: z.number().int().min(0).max(9),
  storageKey: text(200),
  width: z.number().int().min(1).max(10_000),
  height: z.number().int().min(1).max(10_000),
  altText: z.string().max(500),
  thumbhash: text(100),
});

export const operationSchema = z.discriminatedUnion('op', [
  z.strictObject({
    op: z.literal('seedUser'),
    username: text(30),
    email: text(254),
    displayName: text(30).optional(),
    bio: z.string().max(150).optional(),
  }),
  z.strictObject({
    op: z.literal('insertPost'),
    id,
    authorId: id,
    caption: z.string().max(2200),
    createdAt: ms,
    media: z.array(mediaRow).min(1).max(10),
  }),
  z.strictObject({ op: z.literal('follow'), followerId: id, followeeId: id }),
  z.strictObject({
    op: z.literal('setPostCount'),
    userId: id,
    count: z.number().int().min(0).max(1000),
  }),
  z.strictObject({ op: z.literal('clearRateLimits') }),
]);

export type Operation = z.infer<typeof operationSchema>;

export async function runOperation(env: DbEnv, operation: Operation): Promise<void> {
  const db = getDb(env);
  switch (operation.op) {
    case 'seedUser': {
      const now = new Date();
      await db.insert(users).values({
        id: crypto.randomUUID(),
        username: operation.username,
        email: operation.email,
        displayName: operation.displayName ?? operation.username,
        bio: operation.bio ?? '',
        createdAt: now,
        updatedAt: now,
      });
      return;
    }
    case 'insertPost': {
      await db.batch([
        db.insert(posts).values({
          id: operation.id,
          authorId: operation.authorId,
          caption: operation.caption,
          createdAt: new Date(operation.createdAt),
        }),
        db
          .insert(media)
          .values(
            operation.media.map((m) => ({ ...m, postId: operation.id, type: 'image' as const })),
          ),
      ]);
      return;
    }
    case 'follow': {
      await db.insert(follows).values({
        followerId: operation.followerId,
        followeeId: operation.followeeId,
        createdAt: new Date(),
      });
      return;
    }
    case 'setPostCount': {
      const key = `post:user:${operation.userId}`;
      const windowStart = Math.floor(Date.now() / 3_600_000) * 3_600_000;
      const statements = [db.delete(rateLimits).where(eq(rateLimits.key, key))] as const;
      if (operation.count === 0) {
        await db.batch(statements);
      } else {
        await db.batch([
          ...statements,
          db.insert(rateLimits).values({ key, windowStart, count: operation.count }),
        ]);
      }
      return;
    }
    case 'clearRateLimits': {
      // Counters of the documentation range 198.51.100.x and `post:user:<id>` belong to one
      // test's own state and are kept (see e2e/support/db.ts).
      await db
        .delete(rateLimits)
        .where(
          and(
            sql`${rateLimits.key} NOT LIKE 'login:ip:198.51.100.%'`,
            sql`${rateLimits.key} NOT LIKE 'post:user:%'`,
          ),
        );
      return;
    }
  }
}
