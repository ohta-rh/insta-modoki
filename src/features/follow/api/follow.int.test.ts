import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { createUser } from '../../../../tests/helpers/users';
import { follows } from '../../../shared/db/schema';
import { follow } from './follow';
import { unfollow } from './unfollow';

const t = useTestDb();

const setup = async () => {
  const env = testAuthEnv(t.d1);
  const a = await createUser(t.db);
  const b = await createUser(t.db);
  return { env, a, b, headers: await sessionHeadersFor(t.db, env, a) };
};
const rows = (followerId: string, followeeId: string) =>
  t.db
    .select()
    .from(follows)
    .where(and(eq(follows.followerId, followerId), eq(follows.followeeId, followeeId)));

describe('follow', () => {
  it('まだフォローしていない相手のとき following が true で followerCount が 1 になる', async () => {
    const { env, a, b, headers } = await setup();
    const result = await follow({ username: b.username }, { env, headers });
    expect(result).toEqual({ following: true, followerCount: 1 });
    expect(await rows(a.id, b.id)).toHaveLength(1);
  });

  it('2 回呼んでも followerCount が 1 のまま', async () => {
    const { env, a, b, headers } = await setup();
    await follow({ username: b.username }, { env, headers });
    const again = await follow({ username: b.username }, { env, headers });
    expect(again).toEqual({ following: true, followerCount: 1 });
    expect(await rows(a.id, b.id)).toHaveLength(1);
  });

  it('大文字小文字が違う username でも同じ相手をフォローする', async () => {
    const { env, a, headers } = await setup();
    const b = await createUser(t.db, { username: 'bob_follow' });
    const result = await follow({ username: 'BOB_Follow' }, { env, headers });
    expect(result).toEqual({ following: true, followerCount: 1 });
    expect(await rows(a.id, b.id)).toHaveLength(1);
  });

  it('ほかの人のフォローがあるとき followerCount はその分に足される', async () => {
    const { env, b, headers } = await setup();
    const c = await createUser(t.db);
    await follow({ username: b.username }, { env, headers: await sessionHeadersFor(t.db, env, c) });
    const result = await follow({ username: b.username }, { env, headers });
    expect(result).toEqual({ following: true, followerCount: 2 });
  });

  it('同じ人の同時の 10 回で行が 1 つのまま', async () => {
    const { env, a, b, headers } = await setup();
    await Promise.all(
      Array.from({ length: 10 }, () => follow({ username: b.username }, { env, headers })),
    );
    expect(await rows(a.id, b.id)).toHaveLength(1);
  });

  it('自分自身を指定したとき VALIDATION を返す', async () => {
    const { env, a, headers } = await setup();
    const err = await follow({ username: a.username }, { env, headers }).catch((e) => e);
    expect(err).toMatchObject({
      code: 'VALIDATION',
      fieldErrors: { username: ['自分自身はフォローできません'] },
    });
    expect(await t.db.select().from(follows)).toHaveLength(0);
  });

  it('存在しない利用者のとき NOT_FOUND を返す', async () => {
    const { env, headers } = await setup();
    for (const username of ['nobody_here', '.abc', 'accounts', 7, undefined]) {
      const err = await follow({ username }, { env, headers }).catch((e) => e);
      expect(err, String(username)).toMatchObject({
        code: 'NOT_FOUND',
        message: 'ページが見つかりません',
      });
    }
  });

  it('ログインしていないとき UNAUTHENTICATED を返す', async () => {
    const { env, b } = await setup();
    const none = { env, headers: new Headers() };
    expect(await follow({ username: b.username }, none).catch((e) => e)).toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'ログインしてください',
    });
    expect(await unfollow({ username: b.username }, none).catch((e) => e)).toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'ログインしてください',
    });
    expect(await t.db.select().from(follows)).toHaveLength(0);
  });

  it('他人の followerId を入力に足しても A の行は変わらない', async () => {
    const { env, a, b, headers } = await setup();
    const c = await createUser(t.db);
    await follow({ username: b.username }, { env, headers });
    const err = await follow(
      { username: b.username, followerId: c.id },
      { env, headers: await sessionHeadersFor(t.db, env, c) },
    ).catch((e) => e);
    expect(err).toMatchObject({ code: 'VALIDATION' });
    expect(await rows(a.id, b.id)).toHaveLength(1);
    expect(await rows(c.id, b.id)).toHaveLength(0);
  });
});

describe('unfollow', () => {
  it('フォローしていない相手に呼んでも following が false で followerCount が 0 のまま', async () => {
    const { env, b, headers } = await setup();
    const result = await unfollow({ username: b.username }, { env, headers });
    expect(result).toEqual({ following: false, followerCount: 0 });
  });

  it('フォロー済みの相手に呼ぶと行が消え 何度呼んでも同じ結果になる', async () => {
    const { env, a, b, headers } = await setup();
    await follow({ username: b.username }, { env, headers });
    expect(await unfollow({ username: b.username }, { env, headers })).toEqual({
      following: false,
      followerCount: 0,
    });
    expect(await unfollow({ username: b.username }, { env, headers })).toEqual({
      following: false,
      followerCount: 0,
    });
    expect(await rows(a.id, b.id)).toHaveLength(0);
  });

  it('別の利用者 C が呼んでも A のフォローは残る', async () => {
    const { env, a, b, headers } = await setup();
    const c = await createUser(t.db);
    await follow({ username: b.username }, { env, headers });
    const result = await unfollow(
      { username: b.username },
      { env, headers: await sessionHeadersFor(t.db, env, c) },
    );
    expect(result).toEqual({ following: false, followerCount: 1 });
    expect(await rows(a.id, b.id)).toHaveLength(1);
  });

  it('存在しない利用者のとき NOT_FOUND を返す', async () => {
    const { env, headers } = await setup();
    const err = await unfollow({ username: 'nobody_here' }, { env, headers }).catch((e) => e);
    expect(err).toMatchObject({ code: 'NOT_FOUND' });
  });
});
