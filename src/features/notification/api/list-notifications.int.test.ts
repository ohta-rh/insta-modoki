import { beforeAll, describe, expect, it } from 'vitest';
import { BASE_TIME, seedNotifications } from '../../../../tests/helpers/notifications';
import { useTestDb } from '../../../../tests/helpers/db';
import { createComment, createPost } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { newId } from '../../../shared/db/id';
import { notifications } from '../../../shared/db/schema';
import type { StorageEnv } from '../../../shared/storage';
import { listNotifications } from './list-notifications';

const t = useTestDb();

let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const setup = async () => {
  const env = { ...testAuthEnv(t.d1), ...storage };
  const a = await createUser(t.db);
  const b = await createUser(t.db);
  return { env, a, b, headers: await sessionHeadersFor(t.db, env, a) };
};

describe('listNotifications', () => {
  it('20 件ずつ新しい順に返し、20 件ちょうどは 1 ページで終わる', async () => {
    const { env, a, b, headers } = await setup();
    const ids = await seedNotifications(t.db, { recipientId: a.id, actorId: b.id, count: 25 });

    const first = await listNotifications({}, { env, headers });
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();
    expect(first.items.map((i) => i.id)).toEqual(ids.slice(5).reverse());
    expect(first.items[0]!.createdAt).toBe(new Date(BASE_TIME + 24_000).toISOString());

    const second = await listNotifications({ cursor: first.nextCursor! }, { env, headers });
    expect(second.items.map((i) => i.id)).toEqual(ids.slice(0, 5).reverse());
    expect(second.nextCursor).toBeNull();
  });

  it('20 件ちょうどは nextCursor が null、0 件は空', async () => {
    const { env, a, b, headers } = await setup();
    expect(await listNotifications({}, { env, headers })).toEqual({ items: [], nextCursor: null });
    await seedNotifications(t.db, { recipientId: a.id, actorId: b.id, count: 20 });
    const page = await listNotifications({}, { env, headers });
    expect(page.items).toHaveLength(20);
    expect(page.nextCursor).toBeNull();
  });

  it('同じ時刻は id の降順で、ページをまたいでも重ならない', async () => {
    const { env, a, b, headers } = await setup();
    const same = new Date(BASE_TIME);
    const ids: string[] = [];
    for (let i = 0; i < 21; i += 1) {
      const post = await createPost(t.db, a.id);
      const id = newId();
      ids.push(id);
      await t.db.insert(notifications).values({
        id,
        recipientId: a.id,
        actorId: b.id,
        type: 'like',
        postId: post.id,
        createdAt: same,
      });
    }
    const first = await listNotifications({}, { env, headers });
    const second = await listNotifications({ cursor: first.nextCursor! }, { env, headers });
    expect([...first.items, ...second.items].map((i) => i.id)).toEqual([...ids].sort().reverse());
  });

  it('壊れたカーソルは VALIDATION', async () => {
    const { env, headers } = await setup();
    for (const cursor of ['%%%', 123]) {
      const error = await listNotifications({ cursor }, { env, headers }).catch((e) => e);
      expect(error).toMatchObject({ code: 'VALIDATION' });
    }
    const extra = await listNotifications({ userId: 'x' }, { env, headers }).catch((e) => e);
    expect(extra).toMatchObject({ code: 'VALIDATION' });
  });

  it('自分宛ての通知だけを返し、未ログインは UNAUTHENTICATED', async () => {
    const { env, a, b, headers } = await setup();
    await seedNotifications(t.db, { recipientId: a.id, actorId: b.id, count: 2 });
    await seedNotifications(t.db, { recipientId: b.id, actorId: a.id, count: 3 });
    const page = await listNotifications({}, { env, headers });
    expect(page.items).toHaveLength(2);
    const noSession = await listNotifications({}, { env, headers: new Headers() }).catch((e) => e);
    expect(noSession).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('種類ごとの形を返す: 写真つきのいいね、100 字で切るコメント、投稿なしのフォロー', async () => {
    const { env, a, b, headers } = await setup();
    const post = await createPost(t.db, a.id, { altText: '海の写真' });
    const long = 'あ'.repeat(101);
    const exact = 'い'.repeat(100);
    const longId = await createComment(t.db, post.id, b.id, long);
    const exactId = await createComment(t.db, post.id, b.id, exact);
    const at = (n: number) => new Date(BASE_TIME + n * 1000);
    await t.db.insert(notifications).values([
      {
        id: newId(),
        recipientId: a.id,
        actorId: b.id,
        type: 'like',
        postId: post.id,
        createdAt: at(1),
        readAt: at(5),
      },
      {
        id: newId(),
        recipientId: a.id,
        actorId: b.id,
        type: 'comment',
        postId: post.id,
        commentId: longId,
        createdAt: at(2),
      },
      {
        id: newId(),
        recipientId: a.id,
        actorId: b.id,
        type: 'comment',
        postId: post.id,
        commentId: exactId,
        createdAt: at(3),
      },
      { id: newId(), recipientId: a.id, actorId: b.id, type: 'follow', createdAt: at(4) },
    ]);

    const { items } = await listNotifications({}, { env, headers });
    const [follow, commentExact, commentLong, like] = items;
    expect(follow).toMatchObject({ type: 'follow', post: null, comment: null, read: false });
    expect(follow!.actor).toMatchObject({ username: b.username, displayName: b.displayName });
    expect(commentExact!.comment).toMatchObject({ body: exact, truncated: false });
    expect(commentLong!.comment).toMatchObject({ body: 'あ'.repeat(100), truncated: true });
    expect(like).toMatchObject({ type: 'like', comment: null, read: true });
    expect(like!.post!.id).toBe(post.id);
    expect(like!.post!.cover).toMatchObject({ altText: '海の写真', type: 'image' });
    expect(JSON.stringify(items)).not.toMatch(/email|storage_key|storageKey/);
  });
});
