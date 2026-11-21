import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { useTestDb } from '../../../../tests/helpers/db';
import { createComment, createPost } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { comments, posts, rateLimits } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import type { StorageEnv } from '../../../shared/storage';
import { addComment } from './add-comment';

const t = useTestDb();

let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const NOW = Date.UTC(2026, 10, 21, 3, 30);
const env = () => ({ ...testAuthEnv(t.d1), ...storage });
const rid = () => crypto.randomUUID();

const setup = async () => {
  const e = env();
  const author = await createUser(t.db);
  const user = await createUser(t.db);
  const post = await createPost(t.db, author.id);
  const headers = await sessionHeadersFor(t.db, e, user);
  return { e, author, user, post, headers };
};
const commentCount = async (postId: string) =>
  (await t.db.select().from(posts).where(eq(posts.id, postId)))[0]!.commentCount;
const rows = async () => t.db.select().from(comments);

describe('addComment', () => {
  it('コメントを追加すると commentCount が 1 増える', async () => {
    const { e, user, post, headers } = await setup();
    const view = await addComment(
      { postId: post.id, body: '  こんにちは  ', clientRequestId: rid() },
      { env: e, headers, now: NOW },
    );
    expect(view).toMatchObject({
      parentId: null,
      canDelete: true,
      body: 'こんにちは',
      createdAt: new Date(NOW).toISOString(),
      author: { username: user.username, displayName: user.displayName, avatarUrl: null },
      replyCount: 0,
    });
    expect(Object.keys(view).sort()).toEqual(
      [
        'author',
        'body',
        'canDelete',
        'createdAt',
        'id',
        'parentId',
        'replies',
        'replyCount',
      ].sort(),
    );
    expect(await commentCount(post.id)).toBe(1);
    const [row] = await rows();
    expect(row).toMatchObject({ id: view.id, authorId: user.id, body: 'こんにちは' });
  });

  it('同じ clientRequestId の 2 回目は同じ結果を返し行を増やさない', async () => {
    const { e, user, post, headers } = await setup();
    const input = { postId: post.id, body: 'もう一度', clientRequestId: rid() };
    const first = await addComment(input, { env: e, headers, now: NOW });
    const second = await addComment(input, { env: e, headers, now: NOW + 1000 });
    expect(second).toEqual(first);
    expect(await rows()).toHaveLength(1);
    expect(await commentCount(post.id)).toBe(1);
    const [limit] = await t.db.select().from(rateLimits);
    expect(limit).toMatchObject({ key: `comment:user:${user.id}`, count: 1 });
  });

  it('同じ clientRequestId の同時の 2 回でも行は 1 つで commentCount は 1 だけ増える', async () => {
    const { e, post, headers } = await setup();
    const input = { postId: post.id, body: '連打', clientRequestId: rid() };
    const [a, b] = await Promise.all([
      addComment(input, { env: e, headers, now: NOW }),
      addComment(input, { env: e, headers, now: NOW }),
    ]);
    expect(a.id).toBe(b.id);
    expect(await rows()).toHaveLength(1);
    expect(await commentCount(post.id)).toBe(1);
  });

  it('返信への返信は親の parentId に付け替えて保存する', async () => {
    const { e, user, post, headers } = await setup();
    const other = await createUser(t.db);
    const parent = await createComment(t.db, post.id, other.id, '親');
    const reply = await addComment(
      { postId: post.id, body: '返信', parentId: parent, clientRequestId: rid() },
      { env: e, headers, now: NOW },
    );
    expect(reply.parentId).toBe(parent);
    expect(reply.replies).toBeUndefined();
    const nested = await addComment(
      { postId: post.id, body: '返信への返信', parentId: reply.id, clientRequestId: rid() },
      { env: e, headers, now: NOW + 1 },
    );
    expect(nested.parentId).toBe(parent);
    const [saved] = await t.db.select().from(comments).where(eq(comments.id, nested.id));
    expect(saved).toMatchObject({ parentId: parent, authorId: user.id });
    expect(await commentCount(post.id)).toBe(2);
  });

  it('別の投稿のコメントを親にすると NOT_FOUND', async () => {
    const { e, author, post, headers } = await setup();
    const elsewhere = await createPost(t.db, author.id);
    const foreign = await createComment(t.db, elsewhere.id, author.id);
    for (const parentId of [foreign, rid()]) {
      const err = await addComment(
        { postId: post.id, body: 'x', parentId, clientRequestId: rid() },
        { env: e, headers, now: NOW },
      ).catch((x) => x);
      expect(err, parentId).toMatchObject({ code: 'NOT_FOUND' });
    }
    expect(await commentCount(post.id)).toBe(0);
    expect(await rows()).toHaveLength(1);
  });

  it('1 時間に 120 件目は成功し 121 件目は RATE_LIMITED', async () => {
    const { e, user, post, headers } = await setup();
    const windowStart = Math.floor(NOW / 3_600_000) * 3_600_000;
    await t.db
      .insert(rateLimits)
      .values({ key: `comment:user:${user.id}`, windowStart, count: 119 });
    await addComment(
      { postId: post.id, body: '120 件目', clientRequestId: rid() },
      { env: e, headers, now: NOW },
    );
    const err = await addComment(
      { postId: post.id, body: '121 件目', clientRequestId: rid() },
      { env: e, headers, now: NOW },
    ).catch((x) => x);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({
      code: 'RATE_LIMITED',
      message: '操作が多すぎます。しばらくしてからもう一度お試しください',
    });
    expect(err.retryAfterSec).toBe(Math.ceil((windowStart + 3_600_000 - NOW) / 1000));
    expect(await rows()).toHaveLength(1);
    expect(await commentCount(post.id)).toBe(1);

    // Another user has their own count.
    const other = await createUser(t.db);
    const otherHeaders = await sessionHeadersFor(t.db, e, other);
    await addComment(
      { postId: post.id, body: '別の人', clientRequestId: rid() },
      { env: e, headers: otherHeaders, now: NOW },
    );
    expect(await rows()).toHaveLength(2);
  });

  it('ログインしていないとき UNAUTHENTICATED を返す', async () => {
    const { e, post } = await setup();
    const err = await addComment(
      { postId: post.id, body: 'x', clientRequestId: rid() },
      { env: e, headers: new Headers(), now: NOW },
    ).catch((x) => x);
    expect(err).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(await rows()).toHaveLength(0);
  });

  it('存在しない投稿のとき NOT_FOUND を返す', async () => {
    const { e, headers } = await setup();
    const err = await addComment(
      { postId: rid(), body: 'x', clientRequestId: rid() },
      { env: e, headers, now: NOW },
    ).catch((x) => x);
    expect(err).toMatchObject({ code: 'NOT_FOUND' });
    expect(await rows()).toHaveLength(0);
  });

  it('本文が不正なとき VALIDATION を返し fieldErrors.body に文言を入れる', async () => {
    const { e, post, headers } = await setup();
    const err = await addComment(
      { postId: post.id, body: '   ', clientRequestId: rid() },
      { env: e, headers, now: NOW },
    ).catch((x) => x);
    expect(err).toMatchObject({
      code: 'VALIDATION',
      message: 'コメントを入力してください',
      fieldErrors: { body: ['コメントを入力してください'] },
    });
    const long = await addComment(
      { postId: post.id, body: 'あ'.repeat(2201), clientRequestId: rid() },
      { env: e, headers, now: NOW },
    ).catch((x) => x);
    expect(long.fieldErrors).toEqual({ body: ['コメントは 2,200 字までです'] });
    expect(await rows()).toHaveLength(0);
  });
});
