import { eq, or } from 'drizzle-orm';
import { getDb } from '../../../shared/db/client';
import { newId } from '../../../shared/db/id';
import { accounts, users } from '../../../shared/db/schema';
import { sessions } from '../db/schema';
import { AppError } from '../../../shared/errors';
import { clientIp } from '../../../shared/security/client-ip';
import { consume } from '../../../shared/security/rate-limit';
import { hashPassword } from '../model/password';
import { parseSignUp } from '../model/schema';
import type { AuthEnv } from './auth-env';
import { newSession, sessionSetCookie } from './session';

const USERNAME_TAKEN = 'このユーザー名は使われています';
const EMAIL_TAKEN = 'このメールアドレスは登録済みです';

export type SignUpDeps = { env: AuthEnv; headers: Headers; now?: number };
export type SignUpResult = {
  username: string;
  /** The Set-Cookie header value. */
  setCookie: string;
  /** The same cookie as parts, for Next's cookies().set (which encodes the value itself). */
  cookie: { name: string; value: string; maxAgeSec: number; secure: boolean };
};

function conflict(taken: { username?: boolean; email?: boolean }): AppError {
  const fieldErrors: Record<string, string[]> = {};
  if (taken.username) fieldErrors.username = [USERNAME_TAKEN];
  if (taken.email) fieldErrors.email = [EMAIL_TAKEN];
  return new AppError('CONFLICT', {
    message: taken.username ? USERNAME_TAKEN : EMAIL_TAKEN,
    fieldErrors,
  });
}

/** The UNIQUE constraint a failed insert hit, found anywhere in the error's cause chain. */
function uniqueViolation(error: unknown): 'username' | 'email' | null {
  for (let e: unknown = error, i = 0; e && i < 5; i += 1) {
    const m = /UNIQUE constraint failed: users\.(username|email)/.exec(
      e instanceof Error ? e.message : String(e),
    );
    if (m) return m[1] as 'username' | 'email';
    e = e instanceof Error ? e.cause : undefined;
  }
  return null;
}

/**
 * Creates the user, the password account and the session in one db.batch, so a failure leaves
 * nothing behind, and returns the session cookie (HttpOnly, SameSite=Lax, 30 days; Secure on https).
 */
export async function signUp(input: unknown, deps: SignUpDeps): Promise<SignUpResult> {
  const { env, headers } = deps;
  const now = deps.now ?? Date.now();
  const db = getDb(env);

  await consume(`signup:ip:${clientIp(headers)}`, 10, 3600, 1, { db, now });

  const parsed = parseSignUp(input);
  if (!parsed.ok) throw new AppError('VALIDATION', { fieldErrors: parsed.fieldErrors });
  const { username, email, displayName, password } = parsed.data;

  // Cheap pre-check so both clashes are reported and no hashing is spent; the UNIQUE
  // constraints below remain the final judge (concurrent sign-ups).
  const existing = await db
    .select({ username: users.username, email: users.email })
    .from(users)
    .where(or(eq(users.username, username), eq(users.email, email)));
  const taken = {
    username: existing.some((r) => r.username === username),
    email: existing.some((r) => r.email === email),
  };
  if (taken.username || taken.email) throw conflict(taken);

  const userId = newId();
  const at = new Date(now);
  const session = newSession(userId, {
    now,
    ip: clientIp(headers),
    userAgent: headers.get('user-agent'),
  });
  try {
    await db.batch([
      db.insert(users).values({
        id: userId,
        username,
        displayName,
        email,
        createdAt: at,
        updatedAt: at,
      }),
      db.insert(accounts).values({
        id: newId(),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: await hashPassword(password, env.AUTH_PEPPER),
        createdAt: at,
        updatedAt: at,
      }),
      db.insert(sessions).values(session.row),
    ]);
  } catch (error) {
    const field = uniqueViolation(error);
    if (field) throw conflict({ [field]: true });
    throw error;
  }

  const { cookie, header } = await sessionSetCookie(env, session.token);
  return { username, setCookie: header, cookie };
}
