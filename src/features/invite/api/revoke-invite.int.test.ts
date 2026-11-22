import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createAdmin, insertInvite } from '../../../../tests/helpers/invites';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { invites } from '../../../shared/db/schema';
import { revokeInvite } from './revoke-invite';

const t = useTestDb();

async function setup() {
  const env = testAuthEnv(t.d1);
  const admin = await createAdmin(t.db);
  const headers = await sessionHeadersFor(t.db, env, admin);
  return { env, headers, admin };
}

describe('revokeInvite', () => {
  it('2 回呼んでも revoked_at が変わらない', async () => {
    const { env, headers, admin } = await setup();
    const invite = await insertInvite(t.db, admin.id);
    const first = Date.UTC(2026, 10, 23, 1);

    expect(await revokeInvite({ code: invite.code }, { env, headers, now: first })).toEqual({
      revoked: true,
    });
    expect(await revokeInvite({ code: invite.code }, { env, headers, now: first + 9999 })).toEqual({
      revoked: true,
    });
    const [row] = await t.db.select().from(invites).where(eq(invites.code, invite.code));
    expect(row!.revokedAt!.getTime()).toBe(first);
  });

  it('存在しないコードのとき NOT_FOUND', async () => {
    const { env, headers } = await setup();
    await expect(revokeInvite({ code: 'ZZZZZZZZZZ' }, { env, headers })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('小文字・空白つきの code でも同じコードとして失効し、形式の違うものは VALIDATION', async () => {
    const { env, headers, admin } = await setup();
    const invite = await insertInvite(t.db, admin.id);
    await revokeInvite({ code: ` ${invite.code.toLowerCase()} ` }, { env, headers });
    const [row] = await t.db.select().from(invites).where(eq(invites.code, invite.code));
    expect(row!.revokedAt).not.toBeNull();
    await expect(revokeInvite({ code: 'abc' }, { env, headers })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });
});
