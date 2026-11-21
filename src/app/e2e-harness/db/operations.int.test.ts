import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createPost, createLike } from '../../../../tests/helpers/posts';
import { createUser } from '../../../../tests/helpers/users';
import { follows, likes, media, posts, rateLimits, users } from '../../../shared/db/schema';
import { operationSchema, runOperation, type Operation } from './operations';

const t = useTestDb();
const run = (operation: unknown) =>
  runOperation({ DB: t.d1 as never }, operationSchema.parse(operation) as Operation);

describe('E2E ハーネスの操作', () => {
  it('seedUser が既定の表示名と空の自己紹介で利用者の行を書く', async () => {
    await run({ op: 'seedUser', username: 'harness_a', email: 'harness_a@example.com' });
    await run({
      op: 'seedUser',
      username: 'harness_b',
      email: 'harness_b@example.com',
      displayName: 'ビー',
      bio: '自己紹介',
    });
    const rows = await t.db.select().from(users).orderBy(users.username);
    expect(rows.map((r) => [r.username, r.email, r.displayName, r.bio])).toEqual([
      ['harness_a', 'harness_a@example.com', 'harness_a', ''],
      ['harness_b', 'harness_b@example.com', 'ビー', '自己紹介'],
    ]);
  });

  it('insertPost が投稿と写真の行をまとめて書き 失敗すると何も残さない', async () => {
    const author = await createUser(t.db);
    const post = {
      op: 'insertPost',
      id: crypto.randomUUID(),
      authorId: author.id,
      caption: 'こんにちは',
      createdAt: Date.UTC(2026, 10, 1),
      media: [0, 1].map((position) => ({
        id: crypto.randomUUID(),
        position,
        storageKey: `media/${author.id}/${crypto.randomUUID()}`,
        width: 1200,
        height: 800,
        altText: position === 0 ? '猫' : '',
        thumbhash: 'YJqGPQw7sFlslqhFafSE+Q6oJ1h2iHB2Rw==',
      })),
    };
    await run(post);
    const [row] = await t.db.select().from(posts).where(eq(posts.id, post.id));
    expect(row).toMatchObject({ authorId: author.id, caption: 'こんにちは' });
    expect(row!.createdAt.getTime()).toBe(Date.UTC(2026, 10, 1));
    const photos = await t.db.select().from(media).where(eq(media.postId, post.id));
    expect(photos.map((m) => [m.position, m.altText]).sort()).toEqual([
      [0, '猫'],
      [1, ''],
    ]);

    // Two photos at one position violate the unique index: the post row is rolled back with them.
    const broken = {
      ...post,
      id: crypto.randomUUID(),
      media: post.media.map((m) => ({
        ...m,
        id: crypto.randomUUID(),
        storageKey: `k/${m.id}`,
        position: 0,
      })),
    };
    await expect(run(broken)).rejects.toThrow();
    expect(await t.db.select().from(posts).where(eq(posts.id, broken.id))).toEqual([]);
  });

  it('follow がフォローの行を書く', async () => {
    const a = await createUser(t.db);
    const b = await createUser(t.db);
    await run({ op: 'follow', followerId: a.id, followeeId: b.id });
    const rows = await t.db.select().from(follows);
    expect(rows.map((r) => [r.followerId, r.followeeId])).toEqual([[a.id, b.id]]);
  });

  it('setPostCount が n のとき 1 行を置き換え 0 のとき消す', async () => {
    const user = await createUser(t.db);
    const key = `post:user:${user.id}`;
    await run({ op: 'setPostCount', userId: user.id, count: 30 });
    await run({ op: 'setPostCount', userId: user.id, count: 7 });
    let rows = await t.db.select().from(rateLimits).where(eq(rateLimits.key, key));
    expect(rows.map((r) => r.count)).toEqual([7]);
    await run({ op: 'setPostCount', userId: user.id, count: 0 });
    rows = await t.db.select().from(rateLimits).where(eq(rateLimits.key, key));
    expect(rows).toEqual([]);
  });

  it('clearRateLimits が login:ip:198.51.100. と post:user: 以外の回数を消す', async () => {
    const values = [
      'signup:ip:local',
      'checkname:ip:10.1.2.3',
      'login:ip:198.51.100.7',
      'login:ip:203.0.113.9',
      'post:user:abc',
    ].map((key) => ({ key, windowStart: 0, count: 1 }));
    await t.db.insert(rateLimits).values(values);
    await run({ op: 'clearRateLimits' });
    const left = (await t.db.select().from(rateLimits)).map((r) => r.key).sort();
    expect(left).toEqual(['login:ip:198.51.100.7', 'post:user:abc']);
  });

  it('seedLikers が利用者と いいねの行と like_count を一緒に書き 時刻の順に並べられる', async () => {
    const author = await createUser(t.db);
    const post = await createPost(t.db, author.id);
    const likedAt = Date.UTC(2026, 10, 1);
    await run({
      op: 'seedLikers',
      postId: post.id,
      likers: [0, 1, 2].map((i) => ({
        username: `liker_${i}`,
        email: `liker_${i}@example.com`,
        likedAt: likedAt + i * 1000,
      })),
    });
    const rows = await t.db.select().from(likes).where(eq(likes.postId, post.id));
    expect(rows.map((r) => r.createdAt.getTime()).sort()).toEqual([
      likedAt,
      likedAt + 1000,
      likedAt + 2000,
    ]);
    expect((await t.db.select().from(users).where(eq(users.username, 'liker_1'))).length).toBe(1);
    const [row] = await t.db.select().from(posts).where(eq(posts.id, post.id));
    expect(row!.likeCount).toBe(3);
  });

  it('seedLikers が上限の 50 人でも書ける（D1 は 1 つの文の束縛が 100 まで）', async () => {
    const author = await createUser(t.db);
    const post = await createPost(t.db, author.id);
    await run({
      op: 'seedLikers',
      postId: post.id,
      likers: Array.from({ length: 50 }, (_, i) => ({
        username: `many_${i}`,
        email: `many_${i}@example.com`,
        likedAt: 1000 + i,
      })),
    });
    const [row] = await t.db.select().from(posts).where(eq(posts.id, post.id));
    expect(row!.likeCount).toBe(50);
    expect(await t.db.select().from(likes)).toHaveLength(50);
  });

  it('seedLikers が既にいいねのある投稿でも like_count を行の数に合わせる', async () => {
    const author = await createUser(t.db);
    const fan = await createUser(t.db);
    const post = await createPost(t.db, author.id);
    await createLike(t.db, fan.id, post.id);
    await run({
      op: 'seedLikers',
      postId: post.id,
      likers: [{ username: 'liker_x', email: 'liker_x@example.com', likedAt: 1 }],
    });
    const [row] = await t.db.select().from(posts).where(eq(posts.id, post.id));
    expect(row!.likeCount).toBe(2);
  });

  it('seedLikers が途中で失敗すると何も残さない', async () => {
    const author = await createUser(t.db);
    const post = await createPost(t.db, author.id);
    await expect(
      run({
        op: 'seedLikers',
        postId: post.id,
        likers: [
          { username: 'dup_a', email: 'dup_a@example.com', likedAt: 1 },
          { username: 'dup_a', email: 'dup_b@example.com', likedAt: 2 },
        ],
      }),
    ).rejects.toThrow();
    expect(await t.db.select().from(likes)).toEqual([]);
    expect((await t.db.select().from(users).where(eq(users.username, 'dup_a'))).length).toBe(0);
  });

  it('deletePost が投稿と いいね・写真を消す', async () => {
    const author = await createUser(t.db);
    const fan = await createUser(t.db);
    const post = await createPost(t.db, author.id, { mediaCount: 2 });
    await createLike(t.db, fan.id, post.id);
    await run({ op: 'deletePost', postId: post.id });
    expect(await t.db.select().from(posts)).toEqual([]);
    expect(await t.db.select().from(likes)).toEqual([]);
    expect(await t.db.select().from(media)).toEqual([]);
  });
});
