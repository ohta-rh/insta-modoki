import { sessions } from '../../src/shared/db/schema';
import type { Db } from '../../src/shared/db/client';
import type { AuthEnv } from '../../src/features/auth/api/auth-env';
import {
  newSession,
  sessionCookieName,
  sessionSetCookie,
} from '../../src/features/auth/api/session';
import type { TestUser } from './users';

/** An env for auth tests: random secrets built at runtime, an https app URL (so cookies are Secure). */
export function testAuthEnv(d1: unknown): AuthEnv {
  return {
    DB: d1 as AuthEnv['DB'],
    BETTER_AUTH_URL: 'https://app.test',
    BETTER_AUTH_SECRET: crypto.randomUUID() + crypto.randomUUID(),
    AUTH_PEPPER: crypto.randomUUID() + crypto.randomUUID(),
  };
}

/** Headers carrying a valid session cookie for `user` (a sessions row is inserted). */
export async function sessionHeadersFor(
  db: Db,
  env: AuthEnv,
  user: Pick<TestUser, 'id'>,
  opts: { now?: number; expiredAgoMs?: number } = {},
): Promise<Headers> {
  const now = opts.now ?? Date.now();
  const s = newSession(user.id, { now });
  if (opts.expiredAgoMs !== undefined) s.row.expiresAt = new Date(now - opts.expiredAgoMs);
  await db.insert(sessions).values(s.row);
  const { cookie } = await sessionSetCookie(env, s.token);
  return new Headers({ cookie: `${sessionCookieName(env)}=${cookie.value}` });
}
