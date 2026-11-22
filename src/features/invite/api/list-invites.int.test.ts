import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createAdmin, insertInvite } from '../../../../tests/helpers/invites';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { listInvites } from './list-invites';

const t = useTestDb();
const BASE = Date.UTC(2026, 10, 1);

async function setup(n: number) {
  const env = testAuthEnv(t.d1);
  const admin = await createAdmin(t.db);
  const headers = await sessionHeadersFor(t.db, env, admin);
  const made = [];
  for (let i = 0; i < n; i++) {
    made.push(
      await insertInvite(t.db, admin.id, {
        createdAt: new Date(BASE + i * 1000),
        expiresAt: new Date(BASE + 30 * 86_400_000),
      }),
    );
  }
  return { env, headers, newestFirst: made.reverse() };
}

describe('listInvites', () => {
  it('20 件ちょうどのとき nextCursor が null で、21 件のとき 20 件と 1 件', async () => {
    const exact = await setup(20);
    const page = await listInvites({}, { env: exact.env, headers: exact.headers, now: BASE });
    expect(page.items).toHaveLength(20);
    expect(page.nextCursor).toBeNull();

    const more = await insertInvite(t.db, (await t.db.query.users.findFirst())!.id, {
      createdAt: new Date(BASE - 1000),
      expiresAt: new Date(BASE + 30 * 86_400_000),
    });
    const first = await listInvites({}, { env: exact.env, headers: exact.headers, now: BASE });
    expect(first.items.map((i) => i.code)).toEqual(exact.newestFirst.map((i) => i.code));
    expect(first.nextCursor).not.toBeNull();
    const second = await listInvites(
      { cursor: first.nextCursor! },
      { env: exact.env, headers: exact.headers, now: BASE },
    );
    expect(second.items.map((i) => i.code)).toEqual([more.code]);
    expect(second.nextCursor).toBeNull();
  });

  it('各行に code・maxUses・usedCount・expiresAt・revokedAt・status を持たせる', async () => {
    const { env, headers } = await setup(0);
    const admin = (await t.db.query.users.findFirst())!;
    const active = await insertInvite(t.db, admin.id, { createdAt: new Date(BASE + 4000) });
    await insertInvite(t.db, admin.id, {
      createdAt: new Date(BASE + 3000),
      revokedAt: new Date(BASE),
    });
    await insertInvite(t.db, admin.id, {
      createdAt: new Date(BASE + 2000),
      expiresAt: new Date(BASE),
    });
    await insertInvite(t.db, admin.id, {
      createdAt: new Date(BASE + 1000),
      maxUses: 2,
      usedCount: 2,
    });
    const page = await listInvites({}, { env, headers, now: BASE });
    expect(page.items.map((i) => i.status)).toEqual(['active', 'revoked', 'expired', 'used_up']);
    expect(page.items[0]).toEqual({
      code: active.code,
      maxUses: 5,
      usedCount: 0,
      expiresAt: active.expiresAt,
      revokedAt: null,
      createdAt: active.createdAt,
      status: 'active',
    });
  });

  it('壊れた cursor は VALIDATION', async () => {
    const { env, headers } = await setup(0);
    await expect(listInvites({ cursor: '***' }, { env, headers })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });
});
