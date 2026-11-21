import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createComment, createLike, createPost, fileKeysOf } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { headObject, loadStorageEnv, putObjects } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { AppError } from '../../../shared/errors';
import { comments, likes, media, posts, storageOrphans } from '../../../shared/db/schema';
import type { StorageEnv } from '../../../shared/storage';
import { deletePost } from './delete-post';

const t = useTestDb();

let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const setup = async () => {
  const env = { ...testAuthEnv(t.d1), ...storage };
  const owner = await createUser(t.db);
  const post = await createPost(t.db, owner.id, { mediaCount: 3 });
  const keys = post.media.flatMap((m) => fileKeysOf(m.storageKey));
  await putObjects(storage, keys);
  return { env, owner, post, keys };
};

const count = async (table: typeof posts | typeof media | typeof likes | typeof comments) =>
  (await t.db.select().from(table)).length;

describe('deletePost', () => {
  it('自分の投稿を消すと 行とストレージのファイルが全て消え 2 回目も成功する', async () => {
    const { env, owner, post, keys } = await setup();
    const fan = await createUser(t.db);
    await createLike(t.db, fan.id, post.id);
    await createLike(t.db, owner.id, post.id);
    await createComment(t.db, post.id, fan.id);
    await createComment(t.db, post.id, owner.id);
    expect(keys).toHaveLength(12);
    const headers = await sessionHeadersFor(t.db, env, owner);

    expect(await deletePost({ postId: post.id }, { env, headers })).toEqual({ deleted: true });

    expect(await count(posts)).toBe(0);
    expect(await count(media)).toBe(0);
    expect(await count(likes)).toBe(0);
    expect(await count(comments)).toBe(0);
    for (const key of keys) expect(await headObject(storage, key), key).toBeNull();
    expect(await count(storageOrphans as never)).toBe(0);

    expect(await deletePost({ postId: post.id }, { env, headers })).toEqual({ deleted: true });
  });

  it('他人の投稿は FORBIDDEN で 行もファイルも残る', async () => {
    const { env, post, keys } = await setup();
    const other = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, env, other);

    const err = await deletePost({ postId: post.id }, { env, headers }).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({ code: 'FORBIDDEN', message: 'この操作はできません' });

    expect(await count(posts)).toBe(1);
    expect(await count(media)).toBe(3);
    for (const key of keys) expect(await headObject(storage, key), key).not.toBeNull();
  });

  it('未ログインのとき UNAUTHENTICATED を返す', async () => {
    const { env, post, keys } = await setup();
    const err = await deletePost({ postId: post.id }, { env, headers: new Headers() }).catch(
      (e) => e,
    );
    expect(err).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(await count(posts)).toBe(1);
    expect(await headObject(storage, keys[0]!)).not.toBeNull();
  });

  it('UUID でない postId のとき NOT_FOUND を返す', async () => {
    const { env, owner } = await setup();
    const headers = await sessionHeadersFor(t.db, env, owner);
    for (const postId of ['abc', '', '../x', 42, null]) {
      const err = await deletePost({ postId }, { env, headers }).catch((e) => e);
      expect(err, String(postId)).toMatchObject({ code: 'NOT_FOUND' });
    }
    expect(await count(posts)).toBe(1);
  });

  it('無い投稿のとき ログインしていれば誰でも deleted を返す', async () => {
    const { env, owner } = await setup();
    const headers = await sessionHeadersFor(t.db, env, owner);
    expect(await deletePost({ postId: crypto.randomUUID() }, { env, headers })).toEqual({
      deleted: true,
    });
    expect(await count(posts)).toBe(1);
  });

  it('ファイルの削除に失敗しても 行は戻さず storage_orphans に記録する', async () => {
    const { env, owner, post, keys } = await setup();
    const headers = await sessionHeadersFor(t.db, env, owner);
    const failing = vi.fn(async () => {
      throw new Error('boom');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await deletePost(
      { postId: post.id },
      { env, headers, removeObjects: failing, now: 1_700_000_000_000 },
    );
    error.mockRestore();

    expect(result).toEqual({ deleted: true });
    expect(await count(posts)).toBe(0);
    expect(await count(media)).toBe(0);
    const orphans = await t.db.select().from(storageOrphans);
    expect(orphans.map((o) => o.storageKey).sort()).toEqual([...keys].sort());
    expect(orphans.every((o) => o.attempts === 0)).toBe(true);
    expect(orphans[0]!.createdAt.getTime()).toBe(1_700_000_000_000);
    // The files are still there: only the rows went away.
    for (const key of keys) expect(await headObject(storage, key), key).not.toBeNull();
  });
});
