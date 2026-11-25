import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createAdmin } from '../../../../tests/helpers/invites';
import { createPost } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { adminActions, posts, users } from '../../../shared/db/schema';
import type { StorageEnv } from '../../../shared/storage';
import { adminDeletePost } from './admin-delete-post';
import { adminDeleteUser } from './admin-delete-user';
import { listAdminPosts } from './list-admin-posts';
import { listAdminUsers } from './list-admin-users';

const t = useTestDb();

let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const outcome = (run: () => Promise<unknown>) =>
  run().then(
    () => 'ok',
    (e: { code?: string; message?: string }) => `${e.code}:${e.message}`,
  );

describe('管理の処理', () => {
  it('管理の 4 つの処理は未ログインで UNAUTHENTICATED、一般の利用者で FORBIDDEN を返し、何も消えない', async () => {
    const env = { ...testAuthEnv(t.d1), ...storage };
    const admin = await createAdmin(t.db);
    const author = await createUser(t.db);
    const post = await createPost(t.db, author.id);
    const member = await createUser(t.db);
    const memberHeaders = await sessionHeadersFor(t.db, env, member);
    const anonymous = new Headers();
    const calls = (headers: Headers) => [
      () => adminDeletePost({ postId: post.id }, { env, headers }),
      () => adminDeleteUser({ username: author.username }, { env, headers }),
      () => listAdminPosts({}, { env, headers }),
      () => listAdminUsers({}, { env, headers }),
    ];

    for (const call of calls(anonymous)) {
      expect(await outcome(call)).toBe('UNAUTHENTICATED:ログインしてください');
    }
    for (const call of calls(memberHeaders)) {
      expect(await outcome(call)).toBe('FORBIDDEN:この操作はできません');
    }

    expect(await t.db.select().from(posts)).toHaveLength(1);
    expect((await t.db.select().from(users)).map((u) => u.id).sort()).toEqual(
      [admin.id, author.id, member.id].sort(),
    );
    expect(await t.db.select().from(adminActions)).toHaveLength(0);
  });
});
