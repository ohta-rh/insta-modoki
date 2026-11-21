import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createCommentAt, createPost } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import type { StorageEnv } from '../../../shared/storage';
import { listReplies } from './list-replies';

const t = useTestDb();

let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const env = () => ({ ...testAuthEnv(t.d1), ...storage });
const at = (n: number) => new Date(Date.UTC(2026, 10, 1, 0, 0, n));

const setup = async (replyCount: number) => {
  const author = await createUser(t.db);
  const writer = await createUser(t.db);
  const post = await createPost(t.db, author.id);
  const parent = await createCommentAt(t.db, post.id, writer.id, { createdAt: at(0) });
  const other = await createCommentAt(t.db, post.id, writer.id, { createdAt: at(1) });
  await createCommentAt(t.db, post.id, writer.id, {
    parentId: other,
    body: '別の親の返信',
    createdAt: at(2),
  });
  const ids: string[] = [];
  for (let i = 0; i < replyCount; i += 1) {
    ids.push(
      await createCommentAt(t.db, post.id, writer.id, {
        parentId: parent,
        body: `返信 ${i}`,
        createdAt: at(10 + i),
      }),
    );
  }
  return { author, writer, post, parent, ids };
};

describe('listReplies', () => {
  it('25 件のとき 20 件と 5 件に分かれる', async () => {
    const { parent, ids } = await setup(25);
    const deps = { env: env(), headers: new Headers() };
    const first = await listReplies({ commentId: parent }, deps);
    expect(first.items.map((r) => r.id)).toEqual(ids.slice(0, 20));
    expect(first.items[0]).toMatchObject({ parentId: parent, body: '返信 0', canDelete: false });
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await listReplies({ commentId: parent, cursor: first.nextCursor }, deps);
    expect(second.items.map((r) => r.id)).toEqual(ids.slice(20));
    expect(second.nextCursor).toBeNull();
  });

  it('返信のコメント ID のとき NOT_FOUND', async () => {
    const { ids } = await setup(2);
    const deps = { env: env(), headers: new Headers() };
    for (const commentId of [ids[0], crypto.randomUUID(), 'abc', undefined]) {
      expect(
        await listReplies({ commentId }, deps).catch((x) => x),
        String(commentId),
      ).toMatchObject({ code: 'NOT_FOUND' });
    }
  });

  it('壊れたカーソルのとき VALIDATION', async () => {
    const { parent } = await setup(1);
    const deps = { env: env(), headers: new Headers() };
    for (const cursor of ['!!', 'YWJj', 5]) {
      expect(await listReplies({ commentId: parent, cursor }, deps).catch((x) => x)).toMatchObject({
        code: 'VALIDATION',
      });
    }
  });

  it('canDelete は本人と投稿者にだけ true', async () => {
    const e = env();
    const { author, writer, parent } = await setup(1);
    const stranger = await createUser(t.db);
    const flag = async (user: { id: string }) =>
      (
        await listReplies(
          { commentId: parent },
          { env: e, headers: await sessionHeadersFor(t.db, e, user) },
        )
      ).items[0]!.canDelete;
    expect([await flag(writer), await flag(author), await flag(stranger)]).toEqual([
      true,
      true,
      false,
    ]);
  });
});
