import { and, eq } from 'drizzle-orm';
import { getDb } from '../../../shared/db/client';
import { accounts, users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { clientIp } from '../../../shared/security/client-ip';
import { consume } from '../../../shared/security/rate-limit';
import { verifyPassword } from '../model/password';
import { parseLogIn } from '../model/schema';
import { readSessionToken } from '../model/session-cookie';
import { sessions } from '../db/schema';
import type { AuthEnv } from './auth-env';
import { newSession, sessionCookieName, sessionSetCookie } from './session';

const MISMATCH = 'メールアドレスまたはパスワードが違います';

// A well-formed hash nobody can match. An unknown email is checked against it so the response
// takes as long as a wrong password and does not reveal whether the account exists.
const DUMMY_HASH = `pbkdf2-sha256-hmac$100000$${btoa('0123456789abcdef')}$${btoa('0123456789abcdef0123456789abcdef')}`;

export type LogInDeps = { env: AuthEnv; headers: Headers; now?: number };
export type LogInResult = {
  setCookie: string;
  cookie: { name: string; value: string; maxAgeSec: number; secure: boolean };
};

/**
 * Checks the password and starts a new session. Order: validate (not counted) → 5 per minute
 * per IP and 10 per hour per email (successes count too) → check. A session cookie the request
 * already carries is deleted in the same batch, so a planted session id never survives a login.
 */
export async function logIn(input: unknown, deps: LogInDeps): Promise<LogInResult> {
  const { env, headers } = deps;
  const now = deps.now ?? Date.now();
  const db = getDb(env);

  const parsed = parseLogIn(input);
  if (!parsed.ok) throw new AppError('VALIDATION', { fieldErrors: parsed.fieldErrors });
  const { email, password } = parsed.data;

  const ip = clientIp(headers);
  await consume(`login:ip:${ip}`, 5, 60, 1, { db, now });
  await consume(`login:email:${email}`, 10, 3600, 1, { db, now });

  const [row] = await db
    .select({ userId: users.id, hash: accounts.password })
    .from(users)
    .innerJoin(accounts, and(eq(accounts.userId, users.id), eq(accounts.providerId, 'credential')))
    .where(eq(users.email, email))
    .limit(1);
  const ok = await verifyPassword(password, row?.hash ?? DUMMY_HASH, env.AUTH_PEPPER);
  if (!row || !row.hash || !ok) throw new AppError('UNAUTHENTICATED', { message: MISMATCH });

  const session = newSession(row.userId, { now, ip, userAgent: headers.get('user-agent') });
  const old = await readSessionToken(
    headers.get('cookie'),
    sessionCookieName(env),
    env.BETTER_AUTH_SECRET,
  );
  // No cookie: deleting token '' matches nothing, which keeps the batch one fixed shape.
  await db.batch([
    db.delete(sessions).where(eq(sessions.token, old ?? '')),
    db.insert(sessions).values(session.row),
  ]);

  const { cookie, header } = await sessionSetCookie(env, session.token);
  return { cookie, setCookie: header };
}
