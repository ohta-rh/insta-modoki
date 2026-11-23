import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createAdmin } from '../../../../tests/helpers/invites';
import { createComment, createLike, createPost, fileKeysOf } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { headObject, loadStorageEnv, putObjects } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import {
  adminActions,
  comments,
  likes,
  media,
  posts,
  storageOrphans,
} from '../../../shared/db/schema';
import type { StorageEnv } from '../../../shared/storage';
import { adminDeletePost } from './admin-delete-post';

const t = useTestDb();

let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const setup = async () => {
  const env = { ...testAuthEnv(t.d1), ...storage };
  const admin = await createAdmin(t.db);
  const headers = await sessionHeadersFor(t.db, env, admin);
  const author = await createUser(t.db);
  const post = await createPost(t.db, author.id, { mediaCount: 3 });
  const keys = post.media.flatMap((m) => fileKeysOf(m.storageKey));
  await putObjects(storage, keys);
  return { env, admin, headers, author, post, keys };
};

const count = async (table: typeof posts | typeof media | typeof likes | typeof comments) =>
  (await t.db.select().from(table)).length;

describe('adminDeletePost', () => {
  it('行とストレージのファイルが全て消える', async () => {
    const { env, headers, author, post, keys } = await setup();
    const fan = await createUser(t.db);
    await createLike(t.db, fan.id, post.id);
    await createComment(t.db, post.id, fan.id);
    expect(keys).toHaveLength(12);
    for (const key of keys) expect(await headObject(storage, key), key).not.toBeNull();

    expect(await adminDeletePost({ postId: post.id }, { env, headers })).toEqual({ deleted: true });

    expect(await count(posts)).toBe(0);
    expect(await count(media)).toBe(0);
    expect(await count(likes)).toBe(0);
    expect(await count(comments)).toBe(0);
    for (const key of keys) expect(await headObject(storage, key), key).toBeNull();
    expect(await t.db.select().from(storageOrphans)).toHaveLength(0);
    expect(author.id).toBeTruthy();
  });

  it('存在しない投稿のとき NOT_FOUND', async () => {
    const { env, headers } = await setup();
    for (const postId of [crypto.randomUUID(), 'abc', '', 42, null]) {
      const err = await adminDeletePost({ postId }, { env, headers }).catch((e) => e);
      expect(err, String(postId)).toMatchObject({
        code: 'NOT_FOUND',
        message: 'ページが見つかりません',
      });
    }
    expect(await count(posts)).toBe(1);
    expect(await t.db.select().from(adminActions)).toHaveLength(0);
  });

  it('ストレージが失敗しても行は戻さず storage_orphans に記録する', async () => {
    const { env, headers, post, keys } = await setup();
    const failing = vi.fn(async () => {
      throw new Error('boom');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await adminDeletePost(
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
    for (const key of keys) expect(await headObject(storage, key), key).not.toBeNull();
  });

  it('成功したときだけ admin_actions に 1 行残る', async () => {
    const { env, admin, headers, post } = await setup();
    const other = await createUser(t.db);
    const memberHeaders = await sessionHeadersFor(t.db, env, other);

    // A failed delete (FORBIDDEN, NOT_FOUND) records nothing.
    await adminDeletePost({ postId: post.id }, { env, headers: memberHeaders }).catch(() => {});
    await adminDeletePost({ postId: crypto.randomUUID() }, { env, headers }).catch(() => {});
    expect(await t.db.select().from(adminActions)).toHaveLength(0);

    await adminDeletePost({ postId: post.id }, { env, headers, now: 1_700_000_000_000 });

    const rows = await t.db.select().from(adminActions);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      adminId: admin.id,
      action: 'delete_post',
      targetId: post.id,
    });
    expect(rows[0]!.createdAt.getTime()).toBe(1_700_000_000_000);
    // The record stays after the post is gone.
    expect(await count(posts)).toBe(0);
  });
});
