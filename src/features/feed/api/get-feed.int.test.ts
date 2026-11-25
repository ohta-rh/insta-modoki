import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { countQueries } from '../../../../tests/helpers/count-queries';
import { useTestDb } from '../../../../tests/helpers/db';
import { createLike, createPost } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser, type TestUser } from '../../../../tests/helpers/users';
import { follows } from '../../../shared/db/schema';
import type { StorageEnv } from '../../../shared/storage';
import { getFeed } from './get-feed';

const t = useTestDb();

let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const BASE = Date.UTC(2026, 10, 1);

async function follow(follower: TestUser, followee: TestUser) {
  await t.db.insert(follows).values({
    followerId: follower.id,
    followeeId: followee.id,
    createdAt: new Date(),
  });
}

/** `n` posts for the authors in turn, one minute apart from `start`; returns them newest first. */
async function seedPosts(authors: TestUser[], n: number, start = BASE) {
  const made = [];
  for (let i = 0; i < n; i++) {
    made.push(
      await createPost(t.db, authors[i % authors.length]!.id, {
        createdAt: new Date(start + i * 60_000),
      }),
    );
  }
  return made.reverse();
}

/** Calls getFeed as `viewer`; `d1` lets a test swap in a counting binding. */
async function feedOf(viewer: TestUser, input: unknown = {}, d1: unknown = t.d1) {
  const env = { ...testAuthEnv(d1), ...storage };
  return getFeed(input, { env, headers: await sessionHeadersFor(t.db, env, viewer) });
}

describe('getFeed', () => {
  it('13 件のとき 12 件と 1 件に分かれ、重複も欠けも無い', async () => {
    const [a, b, c] = [await createUser(t.db), await createUser(t.db), await createUser(t.db)];
    await follow(a, b);
    await follow(a, c);
    const expected = await seedPosts([b, c], 13);
    const first = await feedOf(a);
    expect(first.items).toHaveLength(12);
    expect(first.nextCursor).not.toBeNull();
    const second = await feedOf(a, { cursor: first.nextCursor });
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect([...first.items, ...second.items].map((p) => p.id)).toEqual(expected.map((p) => p.id));
  });

  it('同じ時刻の投稿も id の降順で欠けも重なりもなく並ぶ', async () => {
    const [a, b] = [await createUser(t.db), await createUser(t.db)];
    await follow(a, b);
    const same = new Date(BASE);
    const made = [];
    for (let i = 0; i < 14; i++) made.push(await createPost(t.db, b.id, { createdAt: same }));
    const ids = made
      .map((p) => p.id)
      .sort()
      .reverse();
    const first = await feedOf(a);
    const second = await feedOf(a, { cursor: first.nextCursor });
    expect([...first.items, ...second.items].map((p) => p.id)).toEqual(ids);
  });

  it('ちょうど 12 件のとき nextCursor が null になる', async () => {
    const [a, b] = [await createUser(t.db), await createUser(t.db)];
    await follow(a, b);
    await seedPosts([b], 12);
    const page = await feedOf(a);
    expect(page.items).toHaveLength(12);
    expect(page.nextCursor).toBeNull();
  });

  it('0 件のとき空の配列を返す', async () => {
    const [a, b] = [await createUser(t.db), await createUser(t.db)];
    expect(await feedOf(a)).toEqual({ items: [], nextCursor: null });
    await follow(a, b); // follows someone who has not posted
    expect(await feedOf(a)).toEqual({ items: [], nextCursor: null });
  });

  it('フォローしていない人の投稿を含まず、自分の投稿を含む', async () => {
    const [a, b, d] = [await createUser(t.db), await createUser(t.db), await createUser(t.db)];
    await follow(a, b);
    const made = await seedPosts([b, d, a], 6); // b, d, a, b, d, a (oldest first)
    const page = await feedOf(a);
    const expected = made.filter((p) => p.authorId !== d.id).map((p) => p.id);
    expect(page.items.map((p) => p.id)).toEqual(expected);
    expect(page.items.some((p) => p.author.username === d.username)).toBe(false);
    expect(page.items.some((p) => p.author.username === a.username)).toBe(true);
  });

  it('フォローの直後に相手の投稿が出て、解除すると消える', async () => {
    const [a, b] = [await createUser(t.db), await createUser(t.db)];
    const [post] = await seedPosts([b], 1);
    expect((await feedOf(a)).items).toEqual([]);
    await follow(a, b);
    expect((await feedOf(a)).items.map((p) => p.id)).toEqual([post!.id]);
    await t.db
      .delete(follows)
      .where(and(eq(follows.followerId, a.id), eq(follows.followeeId, b.id)));
    expect((await feedOf(a)).items).toEqual([]);
  });

  it('壊れたカーソルのとき VALIDATION を返す', async () => {
    const a = await createUser(t.db);
    for (const cursor of ['!!', 'abc', 7, '']) {
      const err = await feedOf(a, { cursor }).catch((x) => x);
      expect(err, String(cursor)).toMatchObject({
        code: 'VALIDATION',
        message: '入力を確認してください',
      });
    }
  });

  it('ログインしていないとき UNAUTHENTICATED を返す', async () => {
    const env = { ...testAuthEnv(t.d1), ...storage };
    const err = await getFeed({}, { env, headers: new Headers() }).catch((x) => x);
    expect(err).toMatchObject({ code: 'UNAUTHENTICATED', message: 'ログインしてください' });
  });

  it('PostView の形で likedByMe が正しく、内部の値を含まない', async () => {
    const [a, b] = [await createUser(t.db), await createUser(t.db)];
    await follow(a, b);
    const [liked, notLiked] = await seedPosts([b], 2);
    // newest first: `liked` is the newer one
    await createLike(t.db, a.id, liked!.id);
    await createLike(t.db, b.id, notLiked!.id);
    const page = await feedOf(a);
    expect(page.items.map((p) => [p.id, p.likedByMe])).toEqual([
      [liked!.id, true],
      [notLiked!.id, false],
    ]);
    const item = page.items[0]!;
    expect(Object.keys(item).sort()).toEqual(
      [
        'author',
        'caption',
        'commentCount',
        'createdAt',
        'id',
        'likeCount',
        'likedByMe',
        'media',
        'savedByMe',
      ].sort(),
    );
    expect(Object.keys(item.author).sort()).toEqual(['avatarUrl', 'displayName', 'username']);
    const text = JSON.stringify(page);
    expect(text).not.toContain(b.email);
    expect(text).not.toContain('storageKey');
    expect(text).not.toContain('"role"');
    expect(item.media[0]!.srcset.w640).toContain('/w640.webp');
  });

  it('12 件でも 1 件でも問い合わせの回数が同じ', async () => {
    const [a, b, c] = [await createUser(t.db), await createUser(t.db), await createUser(t.db)];
    await follow(a, b);
    await follow(c, b);
    await seedPosts([b], 12);
    const many = countQueries(t.d1);
    expect((await feedOf(a, {}, many.d1)).items).toHaveLength(12);
    // c follows b too, but only b's oldest post is on c's page: use a fresh author for one post.
    const solo = await createUser(t.db);
    const reader = await createUser(t.db);
    await follow(reader, solo);
    await seedPosts([solo], 1);
    const one = countQueries(t.d1);
    expect((await feedOf(reader, {}, one.d1)).items).toHaveLength(1);
    expect(many.count()).toBeGreaterThan(0);
    expect(many.count()).toBe(one.count());
  });
});
