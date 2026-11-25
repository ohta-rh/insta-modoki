import { newId } from '../../../shared/db/id';
import { serializeSessionCookie, signCookieValue } from '../model/session-cookie';
import type { sessions } from '../db/schema';
import type { AuthEnv } from './auth-env';

/** Sessions last 30 days from sign-in (docs/architecture/conventions.md "認証とセッション"). */
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;

export const sessionSecure = (env: AuthEnv): boolean => env.BETTER_AUTH_URL.startsWith('https://');
const isSecure = sessionSecure;

/** Better Auth prefixes the cookie with __Secure- when the app URL is https. */
export const sessionCookieName = (env: AuthEnv): string =>
  `${isSecure(env) ? '__Secure-' : ''}better-auth.session_token`;

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export type NewSession = {
  row: typeof sessions.$inferInsert;
  token: string;
};

export function newSession(
  userId: string,
  opts: { now: number; ip?: string | null; userAgent?: string | null },
): NewSession {
  const token = randomToken();
  const at = new Date(opts.now);
  return {
    token,
    row: {
      id: newId(),
      userId,
      token,
      expiresAt: new Date(opts.now + SESSION_MAX_AGE_SEC * 1000),
      ipAddress: opts.ip ?? null,
      userAgent: opts.userAgent?.slice(0, 256) ?? null,
      createdAt: at,
      updatedAt: at,
    },
  };
}

export async function sessionSetCookie(env: AuthEnv, token: string) {
  const cookie = {
    name: sessionCookieName(env),
    value: await signCookieValue(token, env.BETTER_AUTH_SECRET),
    maxAgeSec: SESSION_MAX_AGE_SEC,
    secure: isSecure(env),
  };
  return { cookie, header: serializeSessionCookie(cookie) };
}
