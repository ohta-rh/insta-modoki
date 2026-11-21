import { cache } from 'react';
import { AppError } from '../../../shared/errors';
import { getRequestEnv } from '../../../shared/db/request';
import type { AuthEnv } from './auth-env';
import { createAuth } from './create-auth';

export type SessionUser = { id: string; username: string };

// React's `cache` memoizes per server render (one request): the layout, the page and the slices
// ask for the same user with the same `headers()` object and request env, so the lookup runs once.
// Outside a render (Server Action, route handler, tests) it calls straight through. It never
// outlives the request, so a sign-out or an expired session is seen by the next one.
const lookupSessionUser = cache(
  async (headers: Headers, env: AuthEnv): Promise<SessionUser | null> => {
    // No refresh: a Server Component cannot set the refreshed cookie, so sessions end 30 days after sign-in.
    const session = await createAuth(env).api.getSession({
      headers,
      query: { disableRefresh: true },
    });
    if (!session) return null;
    const { id, username } = session.user as { id: string; username: string };
    return { id, username };
  },
);

/** The signed-in user, or null. Never throws for a missing, expired or forged cookie. */
export async function getSessionUser(
  headers: Headers,
  deps: { env?: AuthEnv } = {},
): Promise<SessionUser | null> {
  return lookupSessionUser(headers, deps.env ?? (await getRequestEnv<AuthEnv>()));
}

export async function requireUser(
  headers: Headers,
  deps: { env?: AuthEnv } = {},
): Promise<SessionUser> {
  const user = await getSessionUser(headers, deps);
  if (!user) throw new AppError('UNAUTHENTICATED');
  return user;
}
