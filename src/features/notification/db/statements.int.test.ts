import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createPost } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { createUser } from '../../../../tests/helpers/users';
import { notifications, posts } from '../../../shared/db/schema';
import { addComment, deleteComment } from '../../comment';
import { follow, unfollow } from '../../follow';
import { likePost, unlikePost } from '../../like';

const t = useTestDb();

const setup = async () => {
  const env = testAuthEnv(t.d1);
  const a = await createUser(t.db);
  const b = await createUser(t.db);
  const post = await createPost(t.db, a.id);
  const as = async (user: { id: string }) => ({
    env,
    headers: await sessionHeadersFor(t.db, env, user),
  });
  return { env, a, b, post, as };
};
const rowsOf = (type: 'like' | 'comment' | 'follow') =>
  t.db.select().from(notifications).where(eq(notifications.type, type));

describe('通知の作成と削除の文', () => {
  it('いいねで 1 行でき、再送で増えず、解除で消え、再いいねで未読の 1 行に戻る', async () => {
    const { a, b, post, as } = await setup();
    const deps = await as(b);

    await likePost({ postId: post.id }, deps);
    const rows = await rowsOf('like');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      recipientId: a.id,
      actorId: b.id,
      type: 'like',
      postId: post.id,
      commentId: null,
      readAt: null,
    });

    await likePost({ postId: post.id }, deps);
    expect(await rowsOf('like')).toHaveLength(1);

    // Read, then unlike: the read row goes too; liking again makes a new unread row.
    await t.db.update(notifications).set({ readAt: new Date() });
    const unliked = await unlikePost({ postId: post.id }, deps);
    expect(unliked).toEqual({ liked: false, likeCount: 0 });
    expect(await rowsOf('like')).toHaveLength(0);

    const again = await likePost({ postId: post.id }, deps);
    expect(again).toEqual({ liked: true, likeCount: 1 });
    const back = await rowsOf('like');
    expect(back).toHaveLength(1);
    expect(back[0]!.readAt).toBeNull();
    const [p] = await t.db.select().from(posts).where(eq(posts.id, post.id));
    expect(p!.likeCount).toBe(1);
  });

  it('コメントで 1 行でき、再送で増えず、返信も投稿の持ち主宛てで、削除で消える', async () => {
    const { a, b, post, as } = await setup();
    const c = await createUser(t.db);
    const input = { postId: post.id, body: 'こんにちは', clientRequestId: crypto.randomUUID() };

    const first = await addComment(input, await as(b));
    const rows = await rowsOf('comment');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      recipientId: a.id,
      actorId: b.id,
      postId: post.id,
      commentId: first.id,
      readAt: null,
    });

    await addComment(input, await as(b));
    expect(await rowsOf('comment')).toHaveLength(1);

    // A reply to B's comment by C notifies the post's owner A only, not B.
    const reply = await addComment(
      { postId: post.id, body: '返信', parentId: first.id, clientRequestId: crypto.randomUUID() },
      await as(c),
    );
    const all = await rowsOf('comment');
    expect(all).toHaveLength(2);
    expect(all.find((r) => r.commentId === reply.id)).toMatchObject({
      recipientId: a.id,
      actorId: c.id,
    });

    await deleteComment({ commentId: first.id }, await as(b));
    // The comment's row and its reply's row (a cascade of the reply) are gone.
    expect(await rowsOf('comment')).toHaveLength(0);
  });

  it('フォローで 1 行でき、再送で増えず、解除で消える', async () => {
    const { a, b, as } = await setup();
    const deps = await as(b);

    await follow({ username: a.username }, deps);
    const rows = await rowsOf('follow');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      recipientId: a.id,
      actorId: b.id,
      postId: null,
      commentId: null,
      readAt: null,
    });

    await follow({ username: a.username }, deps);
    expect(await rowsOf('follow')).toHaveLength(1);

    await unfollow({ username: a.username }, deps);
    expect(await rowsOf('follow')).toHaveLength(0);

    await follow({ username: a.username }, deps);
    expect(await rowsOf('follow')).toHaveLength(1);
    expect(
      await t.db
        .select()
        .from(notifications)
        .where(and(eq(notifications.recipientId, a.id), eq(notifications.actorId, b.id))),
    ).toHaveLength(1);
  });

  it('自分の投稿へのいいねとコメントでは通知を作らない', async () => {
    const { a, post, as } = await setup();
    const deps = await as(a);

    const liked = await likePost({ postId: post.id }, deps);
    expect(liked.liked).toBe(true);
    const mine = await addComment(
      { postId: post.id, body: '自分', clientRequestId: crypto.randomUUID() },
      deps,
    );
    await addComment(
      {
        postId: post.id,
        body: '自分の返信',
        parentId: mine.id,
        clientRequestId: crypto.randomUUID(),
      },
      deps,
    );

    expect(await t.db.select().from(notifications)).toHaveLength(0);
  });
});
