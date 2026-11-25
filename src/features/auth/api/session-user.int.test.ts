import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { createUser } from '../../../../tests/helpers/users';
import { AppError } from '../../../shared/errors';
import { getSessionUser, requireUser } from './session-user';

const t = useTestDb();

describe('getSessionUser / requireUser', () => {
  it('Cookie が無いとき null を返し requireUser は UNAUTHENTICATED を投げる', async () => {
    const env = testAuthEnv(t.d1);
    expect(await getSessionUser(new Headers(), { env })).toBeNull();
    const err = await requireUser(new Headers(), { env }).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('UNAUTHENTICATED');
  });

  it('期限切れの session のとき null を返す', async () => {
    const env = testAuthEnv(t.d1);
    const u = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, env, u, { expiredAgoMs: 1000 });
    expect(await getSessionUser(headers, { env })).toBeNull();
  });

  it('署名が違う Cookie のとき null を返す', async () => {
    const env = testAuthEnv(t.d1);
    const u = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, env, u);
    expect(
      await getSessionUser(headers, { env: { ...env, BETTER_AUTH_SECRET: 'x'.repeat(40) } }),
    ).toBeNull();
  });

  it('有効な Cookie のとき id と username だけを返し requireUser も同じ', async () => {
    const env = testAuthEnv(t.d1);
    const u = await createUser(t.db);
    const headers = await sessionHeadersFor(t.db, env, u);
    expect(await requireUser(headers, { env })).toEqual({ id: u.id, username: u.username });
  });
});
