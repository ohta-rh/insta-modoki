import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createAdmin } from '../../../../tests/helpers/invites';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { invites } from '../../../shared/db/schema';
import { createInvite } from './create-invite';

const t = useTestDb();

describe('createInvite', () => {
  it('10 字の英大文字と数字のコードを作り行を 1 つ足す', async () => {
    const env = testAuthEnv(t.d1);
    const admin = await createAdmin(t.db);
    const headers = await sessionHeadersFor(t.db, env, admin);
    const now = Date.UTC(2026, 10, 23, 12);

    const view = await createInvite({ maxUses: 5, expiresInDays: 7 }, { env, headers, now });

    expect(view.code).toMatch(/^[A-Z0-9]{10}$/);
    expect(view).toMatchObject({
      maxUses: 5,
      usedCount: 0,
      revokedAt: null,
      status: 'active',
    });
    expect(view.expiresAt.getTime()).toBe(now + 7 * 86_400_000);
    const rows = await t.db.select().from(invites);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      code: view.code,
      createdBy: admin.id,
      maxUses: 5,
      usedCount: 0,
      revokedAt: null,
    });
    expect(rows[0]!.createdAt.getTime()).toBe(now);
  });

  it('expiresInDays を省くと 7 日後で、範囲外は VALIDATION で行を足さない', async () => {
    const env = testAuthEnv(t.d1);
    const admin = await createAdmin(t.db);
    const headers = await sessionHeadersFor(t.db, env, admin);
    const now = Date.UTC(2026, 10, 23);

    const view = await createInvite({ maxUses: 1 }, { env, headers, now });
    expect(view.expiresAt.getTime()).toBe(now + 7 * 86_400_000);

    for (const input of [{ maxUses: 0 }, { maxUses: 101 }, { maxUses: 1, expiresInDays: 91 }]) {
      await expect(createInvite(input, { env, headers, now })).rejects.toMatchObject({
        code: 'VALIDATION',
      });
    }
    expect(await t.db.select().from(invites)).toHaveLength(1);
  });
});
