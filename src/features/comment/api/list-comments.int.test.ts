import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createCommentAt, createPost } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import type { StorageEnv } from '../../../shared/storage';
import { listComments } from './list-comments';

const t = useTestDb();

let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const env = () => ({ ...testAuthEnv(t.d1), ...storage });
const at = (n: number) => new Date(Date.UTC(2026, 10, 1, 0, 0, n));

describe('listComments', () => {
  it('親 21 件のとき 20 件と 1 件に分かれ、返信は最初の 3 件と replyCount を持つ', async () => {
    const e = env();
    const author = await createUser(t.db);
    const post = await createPost(t.db, author.id);
    const parents: string[] = [];
    for (let i = 0; i < 21; i += 1) {
      parents.push(
        await createCommentAt(t.db, post.id, author.id, { body: `親 ${i}`, createdAt: at(i) }),
      );
    }
    // The first parent has 5 replies, made after every parent (a reply's time is not a parent's).
    const replies: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      replies.push(
        await createCommentAt(t.db, post.id, author.id, {
          parentId: parents[0],
          body: `返信 ${i}`,
          createdAt: at(100 + i),
        }),
      );
    }

    const first = await listComments({ postId: post.id }, { env: e, headers: new Headers() });
    expect(first.items.map((c) => c.body)).toEqual(Array.from({ length: 20 }, (_, i) => `親 ${i}`));
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(first.items[0]).toMatchObject({ parentId: null, replyCount: 5, canDelete: false });
    expect(first.items[0]!.replies!.map((r) => r.id)).toEqual(replies.slice(0, 3));
    expect(first.items[0]!.replies![0]).toMatchObject({ parentId: parents[0], body: '返信 0' });
    expect(first.items[1]).toMatchObject({ replies: [], replyCount: 0 });

    const second = await listComments(
      { postId: post.id, cursor: first.nextCursor },
      { env: e, headers: new Headers() },
    );
    expect(second.items.map((c) => c.body)).toEqual(['親 20']);
    expect(second.nextCursor).toBeNull();
  });

  it('親が 20 件ちょうどのとき nextCursor が null', async () => {
    const author = await createUser(t.db);
    const post = await createPost(t.db, author.id);
    for (let i = 0; i < 20; i += 1) {
      await createCommentAt(t.db, post.id, author.id, { createdAt: at(i) });
    }
    const page = await listComments({ postId: post.id }, { env: env(), headers: new Headers() });
    expect(page.items).toHaveLength(20);
    expect(page.nextCursor).toBeNull();
  });

  it('同じ時刻の親でも id の順に欠けも重複もなく続きを読める', async () => {
    const author = await createUser(t.db);
    const post = await createPost(t.db, author.id);
    for (let i = 0; i < 25; i += 1) {
      await createCommentAt(t.db, post.id, author.id, { body: `${i}`, createdAt: at(0) });
    }
    const a = await listComments({ postId: post.id }, { env: env(), headers: new Headers() });
    const b = await listComments(
      { postId: post.id, cursor: a.nextCursor },
      { env: env(), headers: new Headers() },
    );
    const bodies = [...a.items, ...b.items].map((c) => c.body);
    expect(bodies).toEqual(Array.from({ length: 25 }, (_, i) => `${i}`));
  });

  it('canDelete は本人と投稿者にだけ true で 未ログインは全て false', async () => {
    const e = env();
    const author = await createUser(t.db);
    const writer = await createUser(t.db);
    const stranger = await createUser(t.db);
    const post = await createPost(t.db, author.id);
    const mine = await createCommentAt(t.db, post.id, writer.id, { createdAt: at(0) });
    await createCommentAt(t.db, post.id, stranger.id, {
      parentId: mine,
      createdAt: at(1),
    });
    const flags = async (user: { id: string } | null) => {
      const headers = user ? await sessionHeadersFor(t.db, e, user) : new Headers();
      const page = await listComments({ postId: post.id }, { env: e, headers });
      return [page.items[0]!.canDelete, page.items[0]!.replies![0]!.canDelete];
    };
    expect(await flags(writer)).toEqual([true, false]);
    expect(await flags(author)).toEqual([true, true]);
    expect(await flags(stranger)).toEqual([false, true]);
    expect(await flags(null)).toEqual([false, false]);
  });

  it('存在しない投稿は NOT_FOUND 壊れたカーソルは VALIDATION', async () => {
    const e = env();
    const author = await createUser(t.db);
    const post = await createPost(t.db, author.id);
    const deps = { env: e, headers: new Headers() };
    for (const postId of [crypto.randomUUID(), 'abc', undefined]) {
      expect(await listComments({ postId }, deps).catch((x) => x), String(postId)).toMatchObject({
        code: 'NOT_FOUND',
      });
    }
    for (const cursor of ['!!', 'YWJj', 5]) {
      expect(
        await listComments({ postId: post.id, cursor }, deps).catch((x) => x),
        String(cursor),
      ).toMatchObject({ code: 'VALIDATION' });
    }
  });
});
