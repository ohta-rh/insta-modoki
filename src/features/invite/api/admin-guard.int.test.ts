import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createAdmin, insertInvite } from '../../../../tests/helpers/invites';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { createUser } from '../../../../tests/helpers/users';
import { invites } from '../../../shared/db/schema';
import { createInvite } from './create-invite';
import { listInvites } from './list-invites';
import { revokeInvite } from './revoke-invite';

const t = useTestDb();

const outcome = (run: () => Promise<unknown>) =>
  run().then(
    () => 'ok',
    (e: { code?: string; message?: string }) => `${e.code}:${e.message}`,
  );

describe('招待の 3 つの処理', () => {
  it('招待の 3 つの処理は未ログインで UNAUTHENTICATED、一般の利用者で FORBIDDEN を返す', async () => {
    const env = testAuthEnv(t.d1);
    const admin = await createAdmin(t.db);
    const invite = await insertInvite(t.db, admin.id);
    const member = await createUser(t.db);
    const memberHeaders = await sessionHeadersFor(t.db, env, member);
    const anonymous = new Headers();
    const before = await t.db.select().from(invites);

    const calls = (headers: Headers) => [
      () => createInvite({ maxUses: 1 }, { env, headers }),
      () => listInvites({}, { env, headers }),
      () => revokeInvite({ code: invite.code }, { env, headers }),
    ];
    for (const call of calls(anonymous)) {
      expect(await outcome(call)).toBe('UNAUTHENTICATED:ログインしてください');
    }
    for (const call of calls(memberHeaders)) {
      expect(await outcome(call)).toBe('FORBIDDEN:この操作はできません');
    }
    expect(await t.db.select().from(invites)).toEqual(before);
  });

  it('権限は DB の role で決まり、入力に role を足しても通らない', async () => {
    const env = testAuthEnv(t.d1);
    const member = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, env, member);
    expect(await outcome(() => createInvite({ maxUses: 1, role: 'admin' }, { env, headers }))).toBe(
      'FORBIDDEN:この操作はできません',
    );
  });
});
