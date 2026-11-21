import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createCommentAt, createPost } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { createUser } from '../../../../tests/helpers/users';
import { comments, posts } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { deleteComment } from './delete-comment';

const t = useTestDb();
const at = (n: number) => new Date(Date.UTC(2026, 10, 1, 0, 0, n));
const ids = async () => (await t.db.select({ id: comments.id }).from(comments)).map((r) => r.id);
const commentCount = async (postId: string) =>
  (await t.db.select().from(posts).where(eq(posts.id, postId)))[0]!.commentCount;

/** A post by B with A's comment P, two replies to it (by A and C), and a count that matches. */
const setup = async () => {
  const env = testAuthEnv(t.d1);
  const a = await createUser(t.db);
  const b = await createUser(t.db);
  const c = await createUser(t.db);
  const post = await createPost(t.db, b.id);
  const p = await createCommentAt(t.db, post.id, a.id, { createdAt: at(0) });
  const r1 = await createCommentAt(t.db, post.id, a.id, { parentId: p, createdAt: at(1) });
  const r2 = await createCommentAt(t.db, post.id, c.id, { parentId: p, createdAt: at(2) });
  await t.db.update(posts).set({ commentCount: 3 }).where(eq(posts.id, post.id));
  const as = async (user: { id: string }) => ({
    env,
    headers: await sessionHeadersFor(t.db, env, user),
  });
  return { env, a, b, c, post, p, r1, r2, as };
};

describe('deleteComment', () => {
  it('本人と投稿者は消せて、無関係な利用者は FORBIDDEN', async () => {
    const { a, b, c, r1, r2, as } = await setup();

    const err = await deleteComment({ commentId: r1 }, await as(c)).catch((x) => x);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ code: 'FORBIDDEN', message: 'この操作はできません' });
    expect(await ids()).toContain(r1);

    expect(await deleteComment({ commentId: r1 }, await as(a))).toEqual({ deleted: true });
    expect(await ids()).not.toContain(r1);
    // The post's author (B) may delete another user's (C's) comment.
    expect(await deleteComment({ commentId: r2 }, await as(b))).toEqual({ deleted: true });
    expect(await ids()).not.toContain(r2);
  });

  it('存在しない ID は NOT_FOUND 未ログインは UNAUTHENTICATED', async () => {
    const { a, p, as } = await setup();
    for (const commentId of [crypto.randomUUID(), 'abc', undefined]) {
      expect(await deleteComment({ commentId }, await as(a)).catch((x) => x)).toMatchObject({
        code: 'NOT_FOUND',
      });
    }
    const { env } = await setup();
    expect(
      await deleteComment({ commentId: p }, { env, headers: new Headers() }).catch((x) => x),
    ).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(await ids()).toContain(p);
  });

  it('親を消すと返信も消え commentCount が 3 減る', async () => {
    const { a, post, p, as } = await setup();
    await deleteComment({ commentId: p }, await as(a));
    expect(await ids()).toEqual([]);
    expect(await commentCount(post.id)).toBe(0);
  });

  it('返信だけを消すと commentCount が 1 減り 親と他の返信は残る', async () => {
    const { a, post, p, r1, r2, as } = await setup();
    await deleteComment({ commentId: r1 }, await as(a));
    expect((await ids()).sort()).toEqual([p, r2].sort());
    expect(await commentCount(post.id)).toBe(2);
  });

  it('commentCount は 0 を下回らない', async () => {
    const { a, post, p, as } = await setup();
    // The count was already too small (1 for a thread of 3): the delete still goes through.
    await t.db.update(posts).set({ commentCount: 1 }).where(eq(posts.id, post.id));
    await deleteComment({ commentId: p }, await as(a));
    expect(await ids()).toEqual([]);
    expect(await commentCount(post.id)).toBe(0);
  });
});
