import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createPost } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { createUser } from '../../../../tests/helpers/users';
import { likes, posts } from '../../../shared/db/schema';
import { likePost } from './like-post';
import { unlikePost } from './unlike-post';

const t = useTestDb();

const setup = async () => {
  const env = testAuthEnv(t.d1);
  const author = await createUser(t.db);
  const post = await createPost(t.db, author.id);
  const a = await createUser(t.db);
  const b = await createUser(t.db);
  const headersA = await sessionHeadersFor(t.db, env, a);
  const headersB = await sessionHeadersFor(t.db, env, b);
  return { env, post, a, b, headersA, headersB };
};
const likeRows = (postId: string) => t.db.select().from(likes).where(eq(likes.postId, postId));
const countOf = async (postId: string) =>
  (await t.db.select({ n: posts.likeCount }).from(posts).where(eq(posts.id, postId)))[0]!.n;

describe('unlikePost', () => {
  it('いいね済みのとき liked が false で likeCount が 0 になる', async () => {
    const { env, post, headersA } = await setup();
    await likePost({ postId: post.id }, { env, headers: headersA });

    const result = await unlikePost({ postId: post.id }, { env, headers: headersA });

    expect(result).toEqual({ liked: false, likeCount: 0 });
    expect(await likeRows(post.id)).toHaveLength(0);
    expect(await countOf(post.id)).toBe(0);
  });

  it('いいねしていない投稿に呼んでも likeCount が 0 のまま', async () => {
    const { env, post, headersA } = await setup();
    const result = await unlikePost({ postId: post.id }, { env, headers: headersA });
    expect(result).toEqual({ liked: false, likeCount: 0 });
    expect(await countOf(post.id)).toBe(0);
    const again = await unlikePost({ postId: post.id }, { env, headers: headersA });
    expect(again).toEqual({ liked: false, likeCount: 0 });
  });

  it('他の利用者の取り消しで A のいいねが残る', async () => {
    const { env, post, a, headersA, headersB } = await setup();
    await likePost({ postId: post.id }, { env, headers: headersA });
    await likePost({ postId: post.id }, { env, headers: headersB });

    const result = await unlikePost({ postId: post.id }, { env, headers: headersB });

    expect(result).toEqual({ liked: false, likeCount: 1 });
    expect((await likeRows(post.id)).map((r) => r.userId)).toEqual([a.id]);
    expect(await countOf(post.id)).toBe(1);
  });

  it('同じ人の同時の取り消しで likeCount が 1 つしか減らない', async () => {
    const { env, post, headersA, headersB } = await setup();
    await likePost({ postId: post.id }, { env, headers: headersA });
    await likePost({ postId: post.id }, { env, headers: headersB });

    await Promise.all(
      Array.from({ length: 6 }, () => unlikePost({ postId: post.id }, { env, headers: headersA })),
    );

    expect(await likeRows(post.id)).toHaveLength(1);
    expect(await countOf(post.id)).toBe(1);
  });

  it('入力にほかの利用者の userId を足すと VALIDATION で、いいねは残る', async () => {
    const { env, post, a, b, headersA, headersB } = await setup();
    await likePost({ postId: post.id }, { env, headers: headersA });
    const err = await unlikePost(
      { postId: post.id, userId: a.id },
      { env, headers: headersB },
    ).catch((e) => e);
    expect(err).toMatchObject({ code: 'VALIDATION' });
    expect(b.id).not.toBe(a.id);
    expect(await likeRows(post.id)).toHaveLength(1);
  });

  it('ログインしていないとき UNAUTHENTICATED、存在しない投稿のとき NOT_FOUND を返す', async () => {
    const { env, post, headersA } = await setup();
    expect(
      await unlikePost({ postId: post.id }, { env, headers: new Headers() }).catch((e) => e),
    ).toMatchObject({ code: 'UNAUTHENTICATED', message: 'ログインしてください' });
    expect(
      await unlikePost({ postId: crypto.randomUUID() }, { env, headers: headersA }).catch((e) => e),
    ).toMatchObject({ code: 'NOT_FOUND', message: 'ページが見つかりません' });
  });
});
