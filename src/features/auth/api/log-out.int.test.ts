import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { createUser } from '../../../../tests/helpers/users';
import { AppError } from '../../../shared/errors';
import { logOut } from './log-out';
import { requireUser } from './session-user';

const t = useTestDb();

describe('logOut', () => {
  it('ログアウトしたセッションの Cookie では UNAUTHENTICATED になる', async () => {
    const env = testAuthEnv(t.d1);
    const user = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, env, user);
    expect((await requireUser(headers, { env })).id).toBe(user.id);

    const result = await logOut({ env, headers });
    expect(result.setCookie).toMatch(/^__Secure-better-auth\.session_token=; Max-Age=0; Path=\//);
    expect(result.setCookie).toContain('HttpOnly');

    const err = await requireUser(headers, { env }).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('UNAUTHENTICATED');
  });

  it('セッションが無くても logOut が成功する', async () => {
    const env = testAuthEnv(t.d1);
    const user = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, env, user);
    await logOut({ env, headers: new Headers() });
    await logOut({ env, headers });
    const again = await logOut({ env, headers });
    expect(again.cookie).toMatchObject({ value: '', maxAgeSec: 0 });
  });

  it('他の利用者の session は消さない', async () => {
    const env = testAuthEnv(t.d1);
    const a = await createUser(t.db);
    const b = await createUser(t.db);
    const ha = await sessionHeadersFor(t.db, env, a);
    const hb = await sessionHeadersFor(t.db, env, b);
    await logOut({ env, headers: ha });
    expect((await requireUser(hb, { env })).id).toBe(b.id);
  });
});
