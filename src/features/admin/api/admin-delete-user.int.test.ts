import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createAdmin } from '../../../../tests/helpers/invites';
import {
  createComment,
  createCommentAt,
  createLike,
  createPost,
  fileKeysOf,
} from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { headObject, loadStorageEnv, putObjects } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { newId } from '../../../shared/db/id';
import {
  adminActions,
  comments,
  likes,
  posts,
  sessions,
  stories,
  storageOrphans,
  users,
} from '../../../shared/db/schema';
import type { StorageEnv } from '../../../shared/storage';
import { adminDeleteUser } from './admin-delete-user';

const t = useTestDb();

let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const realCounts = async (postId: string) => ({
  likes: (await t.db.select().from(likes).where(eq(likes.postId, postId))).length,
  comments: (await t.db.select().from(comments).where(eq(comments.postId, postId))).length,
});

describe('adminDeleteUser', () => {
  it('行・ファイル・セッションが消え、他人の投稿の件数が実際の行数に合う', async () => {
    const env = { ...testAuthEnv(t.d1), ...storage };
    const admin = await createAdmin(t.db);
    const adminHeaders = await sessionHeadersFor(t.db, env, admin);
    const u = await createUser(t.db, { username: 'ulysses' });
    const uHeaders = await sessionHeadersFor(t.db, env, u);
    const other = await createUser(t.db);

    // U's own posts (with files), avatar and a photo story.
    const own = [
      await createPost(t.db, u.id, { mediaCount: 2 }),
      await createPost(t.db, u.id, { mediaCount: 1 }),
    ];
    const avatarKey = `media/${u.id}/${newId()}`;
    await t.db.update(users).set({ avatarKey }).where(eq(users.id, u.id));
    const storyKey = `stories/${u.id}/${newId()}`;
    await t.db.insert(stories).values({
      id: newId(),
      authorId: u.id,
      type: 'image',
      storageKey: storyKey,
      width: 100,
      height: 100,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    const keys = [
      ...own.flatMap((p) => p.media.flatMap((m) => fileKeysOf(m.storageKey))),
      ...fileKeysOf(avatarKey),
      ...fileKeysOf(storyKey),
    ];
    await putObjects(storage, keys);

    // Other people's posts that U liked and commented on; the counters are what the app keeps.
    const p1 = await createPost(t.db, other.id);
    const p2 = await createPost(t.db, other.id);
    const p3 = await createPost(t.db, other.id);
    const bystander = await createUser(t.db);
    for (const p of [p1, p2, p3]) await createLike(t.db, u.id, p.id);
    await createLike(t.db, bystander.id, p1.id);
    const c1 = await createComment(t.db, p1.id, u.id);
    await createCommentAt(t.db, p1.id, bystander.id, { parentId: c1, createdAt: new Date() });
    await createComment(t.db, p2.id, u.id);
    await createComment(t.db, p2.id, bystander.id);
    await t.db.update(posts).set({ likeCount: 2, commentCount: 2 }).where(eq(posts.id, p1.id));
    await t.db.update(posts).set({ likeCount: 1, commentCount: 2 }).where(eq(posts.id, p2.id));
    await t.db.update(posts).set({ likeCount: 1, commentCount: 0 }).where(eq(posts.id, p3.id));

    expect(await adminDeleteUser({ username: 'ulysses' }, { env, headers: adminHeaders })).toEqual({
      deleted: true,
    });

    expect(await t.db.select().from(users).where(eq(users.id, u.id))).toHaveLength(0);
    expect(await t.db.select().from(posts).where(eq(posts.authorId, u.id))).toHaveLength(0);
    expect(await t.db.select().from(stories).where(eq(stories.authorId, u.id))).toHaveLength(0);
    expect(await t.db.select().from(sessions).where(eq(sessions.userId, u.id))).toHaveLength(0);
    for (const key of keys) expect(await headObject(storage, key), key).toBeNull();
    expect(await t.db.select().from(storageOrphans)).toHaveLength(0);

    for (const p of [p1, p2, p3]) {
      const [row] = await t.db.select().from(posts).where(eq(posts.id, p.id));
      const real = await realCounts(p.id);
      expect({ id: p.id, likes: row!.likeCount, comments: row!.commentCount }).toEqual({
        id: p.id,
        likes: real.likes,
        comments: real.comments,
      });
    }
    expect((await realCounts(p1.id)).comments).toBe(0);
    expect((await realCounts(p2.id)).comments).toBe(1);

    // The deleted user's session no longer works.
    const err = await adminDeleteUser({ username: 'ulysses' }, { env, headers: uHeaders }).catch(
      (e) => e,
    );
    expect(err).toMatchObject({ code: 'UNAUTHENTICATED' });

    const [action] = await t.db.select().from(adminActions);
    expect(action).toMatchObject({ adminId: admin.id, action: 'delete_user', targetId: u.id });
  });

  it('存在しない利用者のとき NOT_FOUND', async () => {
    const env = { ...testAuthEnv(t.d1), ...storage };
    const admin = await createAdmin(t.db);
    const headers = await sessionHeadersFor(t.db, env, admin);
    for (const username of ['nobody', '', 'x'.repeat(40), 7, null]) {
      const err = await adminDeleteUser({ username }, { env, headers }).catch((e) => e);
      expect(err, String(username)).toMatchObject({
        code: 'NOT_FOUND',
        message: 'ページが見つかりません',
      });
    }
    expect(await t.db.select().from(adminActions)).toHaveLength(0);
  });

  it('自分と別の管理者は消せない', async () => {
    const env = { ...testAuthEnv(t.d1), ...storage };
    const admin = await createAdmin(t.db);
    const another = await createAdmin(t.db);
    const headers = await sessionHeadersFor(t.db, env, admin);
    const post = await createPost(t.db, another.id);

    for (const target of [admin, another]) {
      const err = await adminDeleteUser({ username: target.username }, { env, headers }).catch(
        (e) => e,
      );
      expect(err, target.username).toMatchObject({
        code: 'FORBIDDEN',
        message: 'この操作はできません',
      });
    }
    expect(await t.db.select().from(users)).toHaveLength(2);
    expect(await t.db.select().from(posts).where(eq(posts.id, post.id))).toHaveLength(1);
    expect(await t.db.select().from(adminActions)).toHaveLength(0);
  });

  it('ファイルの削除が失敗しても行は戻さず storage_orphans に記録する', async () => {
    const env = { ...testAuthEnv(t.d1), ...storage };
    const admin = await createAdmin(t.db);
    const headers = await sessionHeadersFor(t.db, env, admin);
    const u = await createUser(t.db, { username: 'victim' });
    const post = await createPost(t.db, u.id, { mediaCount: 1 });
    const failing = vi.fn(async () => {
      throw new Error('boom');
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await adminDeleteUser({ username: 'victim' }, { env, headers, removeObjects: failing });
    error.mockRestore();

    expect(await t.db.select().from(users).where(eq(users.id, u.id))).toHaveLength(0);
    const orphans = await t.db.select().from(storageOrphans);
    expect(orphans.map((o) => o.storageKey).sort()).toEqual(
      fileKeysOf(post.media[0]!.storageKey).sort(),
    );
  });

  it('91 件の投稿にいいねした利用者でも 全ての投稿の件数が合う（90 個ずつの文に分ける）', async () => {
    const env = { ...testAuthEnv(t.d1), ...storage };
    const admin = await createAdmin(t.db);
    const headers = await sessionHeadersFor(t.db, env, admin);
    const fan = await createUser(t.db, { username: 'bigfan' });
    const author = await createUser(t.db);
    const ids: string[] = [];
    for (let i = 0; i < 91; i++) {
      const p = await createPost(t.db, author.id, { mediaCount: 0 });
      await createLike(t.db, fan.id, p.id);
      ids.push(p.id);
    }
    await t.db.update(posts).set({ likeCount: 1 }).where(eq(posts.authorId, author.id));

    await adminDeleteUser({ username: 'bigfan' }, { env, headers });

    const rows = await t.db.select().from(posts).where(eq(posts.authorId, author.id));
    expect(rows).toHaveLength(91);
    expect(rows.every((r) => r.likeCount === 0)).toBe(true);
  });
});
