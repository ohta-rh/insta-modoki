import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { hashtagStatements } from '../../../features/hashtag';
import { getDb, type DbEnv } from '../../../shared/db/client';
import {
  bookmarks,
  comments,
  follows,
  likes,
  media,
  notifications,
  posts,
  rateLimits,
  stories,
  storyViews,
  users,
} from '../../../shared/db/schema';

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
  z.strictObject({
    op: z.literal('seedLikers'),
    postId: id,
    likers: z
      .array(z.strictObject({ username: text(30), email: text(254), likedAt: ms }))
      .min(1)
      .max(50),
  }),
  z.strictObject({ op: z.literal('deletePost'), postId: id }),
  z.strictObject({ op: z.literal('clearRateLimits') }),
  z.strictObject({
    op: z.literal('setUploadCount'),
    userId: id,
    count: z.number().int().min(0).max(1000),
  }),
  // Comments and replies (#35): a parent is listed before its replies; the posts' counts follow.
  z.strictObject({
    op: z.literal('insertComments'),
    comments: z
      .array(
        z.strictObject({
          id,
          postId: id,
          authorId: id,
          parentId: id.nullable(),
          body: text(2200),
          createdAt: ms,
        }),
      )
      .min(1)
      .max(100),
  }),
  z.strictObject({
    op: z.literal('seedFollowers'),
    followeeId: id,
    followers: z
      .array(z.strictObject({ username: text(30), email: text(254), followedAt: ms }))
      .min(1)
      .max(50),
  }),
  // Stories (#47): one insert per row in one batch.
  z.strictObject({
    op: z.literal('insertStories'),
    stories: z
      .array(
        z.strictObject({
          id,
          authorId: id,
          type: z.enum(['image', 'video']),
          storageKey: text(200),
          width: z.number().int().min(1).max(10_000),
          height: z.number().int().min(1).max(10_000),
          durationMs: z.number().int().min(1).max(15_000).nullable(),
          altText: z.string().max(500),
          createdAt: ms,
          expiresAt: ms,
        }),
      )
      .min(1)
      .max(60),
  }),
  z.strictObject({
    op: z.literal('insertStoryViews'),
    views: z
      .array(z.strictObject({ storyId: id, viewerId: id, createdAt: ms }))
      .min(1)
      .max(60),
  }),
  // Tags an inserted post as createPost would (hashtags #49): `insertPost` writes none.
  z.strictObject({
    op: z.literal('tagPost'),
    postId: id,
    createdAt: ms,
    names: z.array(text(100)).min(1).max(30),
  }),
  z.strictObject({
    op: z.literal('seedNotification'),
    recipientId: id,
    actorId: id,
    type: z.enum(['like', 'follow']),
    postId: id.optional(),
    createdAt: ms,
  }),
  // Saved posts (#51): one insert per row in one batch; a repeat is ignored.
  z.strictObject({
    op: z.literal('insertBookmarks'),
    userId: id,
    items: z
      .array(z.strictObject({ postId: id, savedAt: ms }))
      .min(1)
      .max(50),
  }),
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
    case 'seedLikers': {
      // New users, their likes and the counter in one batch, so like_count always equals the rows.
      const now = new Date();
      const people = operation.likers.map((l) => ({ ...l, id: crypto.randomUUID() }));
      // One insert per row: D1 allows 100 bound variables in one statement.
      const counter = db
        .update(posts)
        .set({
          likeCount: sql`(SELECT count(*) FROM ${likes} WHERE ${likes.postId} = ${posts.id})`,
        })
        .where(eq(posts.id, operation.postId));
      const rows = [
        ...people.map((p) =>
          db.insert(users).values({
            id: p.id,
            username: p.username,
            email: p.email,
            displayName: p.username,
            createdAt: now,
            updatedAt: now,
          }),
        ),
        ...people.map((p) =>
          db
            .insert(likes)
            .values({ userId: p.id, postId: operation.postId, createdAt: new Date(p.likedAt) }),
        ),
      ];
      // The counter runs last, after every row is in. The array is never empty (min 1 liker).
      await db.batch([...rows, counter] as unknown as Parameters<typeof db.batch>[0]);
      return;
    }
    case 'deletePost': {
      // Media, likes and comments go with the post by ON DELETE CASCADE.
      await db.delete(posts).where(eq(posts.id, operation.postId));
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
    case 'seedNotification': {
      // A row as the app would write it, for a screen test that needs notifications at once.
      await db.insert(notifications).values({
        id: crypto.randomUUID(),
        recipientId: operation.recipientId,
        actorId: operation.actorId,
        type: operation.type,
        postId: operation.type === 'like' ? (operation.postId ?? null) : null,
        createdAt: new Date(operation.createdAt),
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
    case 'setUploadCount': {
      const key = `upload:user:${operation.userId}`;
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
    case 'insertComments': {
      const perPost = new Map<string, number>();
      for (const c of operation.comments) perPost.set(c.postId, (perPost.get(c.postId) ?? 0) + 1);
      await db.batch([
        ...operation.comments.map((c) =>
          db.insert(comments).values({ ...c, createdAt: new Date(c.createdAt) }),
        ),
        ...[...perPost].map(([postId, n]) =>
          db
            .update(posts)
            .set({ commentCount: sql`${posts.commentCount} + ${n}` })
            .where(eq(posts.id, postId)),
        ),
      ] as unknown as Parameters<typeof db.batch>[0]);
      return;
    }
    case 'seedFollowers': {
      // New users and their follows of `followeeId` in one batch; one insert per row (D1 allows
      // 100 bound variables in one statement). The array is never empty (min 1 follower).
      const now = new Date();
      const people = operation.followers.map((f) => ({ ...f, id: crypto.randomUUID() }));
      const rows = [
        ...people.map((p) =>
          db.insert(users).values({
            id: p.id,
            username: p.username,
            email: p.email,
            displayName: p.username,
            createdAt: now,
            updatedAt: now,
          }),
        ),
        ...people.map((p) =>
          db.insert(follows).values({
            followerId: p.id,
            followeeId: operation.followeeId,
            createdAt: new Date(p.followedAt),
          }),
        ),
      ];
      await db.batch(rows as unknown as Parameters<typeof db.batch>[0]);
      return;
    }
    case 'insertStories': {
      await db.batch(
        operation.stories.map((r) =>
          db.insert(stories).values({
            ...r,
            createdAt: new Date(r.createdAt),
            expiresAt: new Date(r.expiresAt),
          }),
        ) as unknown as Parameters<typeof db.batch>[0],
      );
      return;
    }
    case 'insertStoryViews': {
      await db.batch(
        operation.views.map((r) =>
          db.insert(storyViews).values({ ...r, createdAt: new Date(r.createdAt) }),
        ) as unknown as Parameters<typeof db.batch>[0],
      );
      return;
    }
    case 'insertBookmarks': {
      await db.batch(
        operation.items.map((item) =>
          db
            .insert(bookmarks)
            .values({
              userId: operation.userId,
              postId: item.postId,
              createdAt: new Date(item.savedAt),
            })
            .onConflictDoNothing(),
        ) as unknown as Parameters<typeof db.batch>[0],
      );
      return;
    }
    case 'tagPost': {
      await db.batch(
        hashtagStatements(db, {
          postId: operation.postId,
          names: operation.names,
          createdAt: new Date(operation.createdAt),
        }) as unknown as Parameters<typeof db.batch>[0],
      );
      return;
    }
  }
}
