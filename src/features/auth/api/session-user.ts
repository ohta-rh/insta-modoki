import { AppError } from '../../../shared/errors';
import { getRequestEnv } from '../../../shared/db/request';
import type { AuthEnv } from './auth-env';
import { createAuth } from './create-auth';

export type SessionUser = { id: string; username: string };

/** The signed-in user, or null. Never throws for a missing, expired or forged cookie. */
export async function getSessionUser(
  headers: Headers,
  deps: { env?: AuthEnv } = {},
): Promise<SessionUser | null> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv>());
  // No refresh: a Server Component cannot set the refreshed cookie, so sessions end 30 days after sign-in.
  const session = await createAuth(env).api.getSession({
    headers,
    query: { disableRefresh: true },
  });
  if (!session) return null;
  const { id, username } = session.user as { id: string; username: string };
  return { id, username };
}

export async function requireUser(
  headers: Headers,
  deps: { env?: AuthEnv } = {},
): Promise<SessionUser> {
  const user = await getSessionUser(headers, deps);
  if (!user) throw new AppError('UNAUTHENTICATED');
  return user;
}
