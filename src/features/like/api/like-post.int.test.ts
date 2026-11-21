import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createLike, createPost } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { createUser } from '../../../../tests/helpers/users';
import { likes, posts } from '../../../shared/db/schema';
import { likePost } from './like-post';

const t = useTestDb();

const setup = async () => {
  const env = testAuthEnv(t.d1);
  const author = await createUser(t.db);
  const post = await createPost(t.db, author.id);
  return { env, post };
};
const likeRows = (postId: string) => t.db.select().from(likes).where(eq(likes.postId, postId));
const countOf = async (postId: string) =>
  (await t.db.select({ n: posts.likeCount }).from(posts).where(eq(posts.id, postId)))[0]!.n;

describe('likePost', () => {
  it('いいねしていない投稿のとき liked が true で likeCount が 1 になる', async () => {
    const { env, post } = await setup();
    const a = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, env, a);

    const result = await likePost({ postId: post.id }, { env, headers });

    expect(result).toEqual({ liked: true, likeCount: 1 });
    expect(await likeRows(post.id)).toHaveLength(1);
    expect(await countOf(post.id)).toBe(1);
  });

  it('2 回呼んでも likeCount が 1 のまま', async () => {
    const { env, post } = await setup();
    const a = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, env, a);

    await likePost({ postId: post.id }, { env, headers });
    const again = await likePost({ postId: post.id }, { env, headers });

    expect(again).toEqual({ liked: true, likeCount: 1 });
    expect(await likeRows(post.id)).toHaveLength(1);
    expect(await countOf(post.id)).toBe(1);
  });

  it('ほかの人のいいねがあるとき likeCount はその分に足される', async () => {
    const { env, post } = await setup();
    const a = await createUser(t.db);
    const b = await createUser(t.db);
    await likePost({ postId: post.id }, { env, headers: await sessionHeadersFor(t.db, env, a) });
    const result = await likePost(
      { postId: post.id },
      { env, headers: await sessionHeadersFor(t.db, env, b) },
    );
    expect(result).toEqual({ liked: true, likeCount: 2 });
  });

  it('10 人の同時のいいねで likeCount が 10 になる', async () => {
    const { env, post } = await setup();
    const users = await Promise.all(Array.from({ length: 10 }, () => createUser(t.db)));
    const sessions = await Promise.all(users.map((u) => sessionHeadersFor(t.db, env, u)));

    const results = await Promise.all(
      sessions.map((headers) => likePost({ postId: post.id }, { env, headers })),
    );

    expect(results.every((r) => r.liked)).toBe(true);
    expect(await likeRows(post.id)).toHaveLength(10);
    expect(await countOf(post.id)).toBe(10);
  });

  it('同じ人の同時の 10 回で likeCount が 1 のまま', async () => {
    const { env, post } = await setup();
    const a = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, env, a);

    await Promise.all(
      Array.from({ length: 10 }, () => likePost({ postId: post.id }, { env, headers })),
    );

    expect(await likeRows(post.id)).toHaveLength(1);
    expect(await countOf(post.id)).toBe(1);
  });

  it('ログインしていないとき UNAUTHENTICATED を返す', async () => {
    const { env, post } = await setup();
    const err = await likePost({ postId: post.id }, { env, headers: new Headers() }).catch(
      (e) => e,
    );
    expect(err).toMatchObject({ code: 'UNAUTHENTICATED', message: 'ログインしてください' });
    expect(await likeRows(post.id)).toHaveLength(0);
  });

  it('存在しない投稿のとき NOT_FOUND を返す', async () => {
    const { env } = await setup();
    const a = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, env, a);
    for (const postId of [crypto.randomUUID(), 'abc', 7]) {
      const err = await likePost({ postId }, { env, headers }).catch((e) => e);
      expect(err, String(postId)).toMatchObject({
        code: 'NOT_FOUND',
        message: 'ページが見つかりません',
      });
    }
  });

  it('入力にほかの利用者の userId を足すと VALIDATION で、いいねは付かない', async () => {
    const { env, post } = await setup();
    const a = await createUser(t.db);
    const b = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, env, a);
    const err = await likePost({ postId: post.id, userId: b.id }, { env, headers }).catch((e) => e);
    expect(err).toMatchObject({ code: 'VALIDATION' });
    expect(await likeRows(post.id)).toHaveLength(0);
  });

  it('すでにいいねしている投稿に別の人が既存のいいねを持つとき自分の行だけ増える', async () => {
    const { env, post } = await setup();
    const a = await createUser(t.db);
    const b = await createUser(t.db);
    await createLike(t.db, a.id, post.id);
    await t.db.update(posts).set({ likeCount: 1 }).where(eq(posts.id, post.id));
    const result = await likePost(
      { postId: post.id },
      { env, headers: await sessionHeadersFor(t.db, env, b) },
    );
    expect(result).toEqual({ liked: true, likeCount: 2 });
  });
});
