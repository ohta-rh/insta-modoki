import { eq } from 'drizzle-orm';
import { requireUser, type SessionUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';

/**
 * The signed-in administrator. Not signed in is UNAUTHENTICATED; a user whose `users.role` row is
 * not 'admin' is FORBIDDEN. The role is read from the database on every call: nothing the client
 * sends (input, cookie value) says who is an administrator.
 */
export async function requireAdmin(headers: Headers, deps: { env: AuthEnv }): Promise<SessionUser> {
  const user = await requireUser(headers, { env: deps.env });
  const [row] = await getDb(deps.env)
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, user.id));
  if (row?.role !== 'admin') throw new AppError('FORBIDDEN');
  return user;
}
