import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createAdmin } from '../../../../tests/helpers/invites';
import { createPost } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { createUser } from '../../../../tests/helpers/users';
import { listAdminUsers } from './list-admin-users';

const t = useTestDb();

describe('listAdminUsers', () => {
  it('ユーザー名の前方一致で絞る', async () => {
    const env = testAuthEnv(t.d1);
    const admin = await createAdmin(t.db, { username: 'boss' });
    const headers = await sessionHeadersFor(t.db, env, admin);
    const alice = await createUser(t.db, { username: 'alice' });
    await createUser(t.db, { username: 'alicia' });
    await createUser(t.db, { username: 'bob_alice' });
    await createPost(t.db, alice.id, { mediaCount: 0 });
    await createPost(t.db, alice.id, { mediaCount: 0 });

    const hit = await listAdminUsers({ query: 'ALI' }, { env, headers });
    expect(hit.items.map((u) => u.username).sort()).toEqual(['alice', 'alicia']);
    expect(hit.items.find((u) => u.username === 'alice')).toEqual({
      username: 'alice',
      displayName: expect.any(String),
      role: 'user',
      postCount: 2,
      createdAt: expect.any(Date),
    });
    // `%` and `_` in the query are plain characters, not wildcards.
    expect((await listAdminUsers({ query: 'a_i' }, { env, headers })).items).toHaveLength(0);
    expect((await listAdminUsers({ query: '%' }, { env, headers })).items).toHaveLength(0);

    const all = await listAdminUsers({}, { env, headers });
    expect(all.items.find((u) => u.username === 'boss')).toMatchObject({ role: 'admin' });
    expect(all.items).toHaveLength(4);
  });

  it('20 件ずつで、21 人目は次のページに出る', async () => {
    const env = testAuthEnv(t.d1);
    const admin = await createAdmin(t.db, { username: 'boss' });
    const headers = await sessionHeadersFor(t.db, env, admin);
    for (let i = 0; i < 20; i++)
      await createUser(t.db, { username: `member_${String(i).padStart(2, '0')}` });
    const first = await listAdminUsers({}, { env, headers });
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();
    const second = await listAdminUsers({ cursor: first.nextCursor }, { env, headers });
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    const names = [...first.items, ...second.items].map((u) => u.username);
    expect(new Set(names).size).toBe(21);
  });
});
