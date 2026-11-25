import { eq } from 'drizzle-orm';
import { getDb } from '../../../shared/db/client';
import { readSessionToken, serializeSessionCookie } from '../model/session-cookie';
import { sessions } from '../db/schema';
import type { AuthEnv } from './auth-env';
import { sessionCookieName, sessionSecure } from './session';

export type LogOutDeps = { env: AuthEnv; headers: Headers };
export type LogOutResult = {
  /** The Set-Cookie header value that clears the cookie. */
  setCookie: string;
  cookie: { name: string; value: string; maxAgeSec: number; secure: boolean };
};

/**
 * Deletes the session row behind the request's cookie and returns the cookie that clears it.
 * Idempotent and deliberately not behind requireUser: with no (or an already ended) session it
 * still succeeds, and the signature check keeps a forged cookie from deleting anything.
 */
export async function logOut(deps: LogOutDeps): Promise<LogOutResult> {
  const { env, headers } = deps;
  const name = sessionCookieName(env);
  const token = await readSessionToken(headers.get('cookie'), name, env.BETTER_AUTH_SECRET);
  if (token) await getDb(env).delete(sessions).where(eq(sessions.token, token));
  const cookie = { name, value: '', maxAgeSec: 0, secure: sessionSecure(env) };
  return { cookie, setCookie: serializeSessionCookie(cookie) };
}
