import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { useTestDb } from '../../../../tests/helpers/db';
import { testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser, type TestUser } from '../../../../tests/helpers/users';
import { encodeCursor } from '../../../shared/db/cursor';
import { follows, users } from '../../../shared/db/schema';
import type { StorageEnv } from '../../../shared/storage';
import { listFollowers } from './list-followers';
import { listFollowing } from './list-following';

const t = useTestDb();

let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});
const env = () => ({ ...testAuthEnv(t.d1), ...storage });

const BASE = Date.parse('2026-01-01T00:00:00.000Z');

/** `n` users who follow `target`, the i-th at base + i seconds (so a later index is newer). */
const seedFollowers = async (target: TestUser, n: number, same = false) => {
  const made: TestUser[] = [];
  for (let i = 0; i < n; i += 1) {
    const u = await createUser(t.db);
    made.push(u);
    await t.db.insert(follows).values({
      followerId: u.id,
      followeeId: target.id,
      createdAt: new Date(same ? BASE : BASE + i * 1000),
    });
  }
  return made;
};
/** `n` users `source` follows, the i-th at base + i seconds. */
const seedFollowing = async (source: TestUser, n: number, same = false) => {
  const made: TestUser[] = [];
  for (let i = 0; i < n; i += 1) {
    const u = await createUser(t.db);
    made.push(u);
    await t.db.insert(follows).values({
      followerId: source.id,
      followeeId: u.id,
      createdAt: new Date(same ? BASE : BASE + i * 1000),
    });
  }
  return made;
};

describe('listFollowers', () => {
  it('20 人ちょうどのとき nextCursor が null', async () => {
    const bob = await createUser(t.db);
    await seedFollowers(bob, 20);
    const page = await listFollowers({ username: bob.username }, { env: env() });
    expect(page.items).toHaveLength(20);
    expect(page.nextCursor).toBeNull();
  });

  it('21 人のとき 2 ページ目に 1 件だけ返る', async () => {
    const bob = await createUser(t.db);
    const made = await seedFollowers(bob, 21);
    const first = await listFollowers({ username: bob.username }, { env: env() });
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();
    const second = await listFollowers(
      { username: bob.username, cursor: first.nextCursor! },
      { env: env() },
    );
    expect(second.items.map((i) => i.username)).toEqual([made[0]!.username]);
    expect(second.nextCursor).toBeNull();
  });

  it('新しくフォローした順に並ぶ', async () => {
    const bob = await createUser(t.db);
    const made = await seedFollowers(bob, 3);
    const page = await listFollowers({ username: bob.username }, { env: env() });
    expect(page.items.map((i) => i.username)).toEqual(
      [made[2]!, made[1]!, made[0]!].map((u) => u.username),
    );
  });

  it('同じ時刻のフォローは相手の id の大きい順に並び 取りこぼしも重複も無い', async () => {
    const bob = await createUser(t.db);
    const made = await seedFollowers(bob, 25, true);
    const first = await listFollowers({ username: bob.username }, { env: env() });
    const second = await listFollowers(
      { username: bob.username, cursor: first.nextCursor! },
      { env: env() },
    );
    const names = [...first.items, ...second.items].map((i) => i.username);
    expect(new Set(names).size).toBe(25);
    const expected = [...made].sort((x, y) => (x.id < y.id ? 1 : -1)).map((u) => u.username);
    expect(names).toEqual(expected);
  });

  it('壊れたカーソルのとき VALIDATION を返す', async () => {
    const bob = await createUser(t.db);
    for (const cursor of ['!!!', 'abc', encodeCursor({ createdAt: new Date(), id: '' })]) {
      const err = await listFollowers({ username: bob.username, cursor }, { env: env() }).catch(
        (e) => e,
      );
      expect(err, cursor).toMatchObject({ code: 'VALIDATION' });
    }
  });

  it('UserSummary だけを返す（email などを含まない）', async () => {
    const bob = await createUser(t.db);
    const [fan] = await seedFollowers(bob, 1);
    await t.db
      .update(users)
      .set({ avatarKey: `media/${fan!.id}/av` })
      .where(eq(users.id, fan!.id));
    const page = await listFollowers({ username: bob.username }, { env: env() });
    const item = page.items[0]!;
    expect(Object.keys(item).sort()).toEqual(['avatarUrl', 'displayName', 'username']);
    expect(item.avatarUrl).toContain(`media/${fan!.id}/av/w320.webp`);
  });

  it('フォロワーがいなければ空で、存在しない利用者のとき NOT_FOUND を返す', async () => {
    const bob = await createUser(t.db);
    expect(await listFollowers({ username: bob.username }, { env: env() })).toEqual({
      items: [],
      nextCursor: null,
    });
    for (const username of ['nobody_here', '.abc', 7]) {
      const err = await listFollowers({ username }, { env: env() }).catch((e) => e);
      expect(err, String(username)).toMatchObject({ code: 'NOT_FOUND' });
    }
  });

  it('未知のキーを足すと VALIDATION を返す', async () => {
    const bob = await createUser(t.db);
    const err = await listFollowers({ username: bob.username, limit: 100 }, { env: env() }).catch(
      (e) => e,
    );
    expect(err).toMatchObject({ code: 'VALIDATION' });
  });
});

describe('listFollowing', () => {
  it('新しくフォローした順に並び 21 人のとき 2 ページ目に 1 件だけ返る', async () => {
    const bob = await createUser(t.db);
    const made = await seedFollowing(bob, 21);
    // Someone who follows bob is not in bob's following list.
    await seedFollowers(bob, 2);
    const first = await listFollowing({ username: bob.username }, { env: env() });
    expect(first.items).toHaveLength(20);
    expect(first.items[0]!.username).toBe(made[20]!.username);
    const second = await listFollowing(
      { username: bob.username, cursor: first.nextCursor! },
      { env: env() },
    );
    expect(second.items.map((i) => i.username)).toEqual([made[0]!.username]);
    expect(second.nextCursor).toBeNull();
  });

  it('20 人ちょうどのとき nextCursor が null で 同じ時刻でも欠けない', async () => {
    const bob = await createUser(t.db);
    await seedFollowing(bob, 20, true);
    const page = await listFollowing({ username: bob.username }, { env: env() });
    expect(page.items).toHaveLength(20);
    expect(page.nextCursor).toBeNull();
  });

  it('壊れたカーソルは VALIDATION、存在しない利用者は NOT_FOUND', async () => {
    const bob = await createUser(t.db);
    expect(
      await listFollowing({ username: bob.username, cursor: '!!!' }, { env: env() }).catch(
        (e) => e,
      ),
    ).toMatchObject({ code: 'VALIDATION' });
    expect(
      await listFollowing({ username: 'nobody_here' }, { env: env() }).catch((e) => e),
    ).toMatchObject({ code: 'NOT_FOUND' });
  });
});
