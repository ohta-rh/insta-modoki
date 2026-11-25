import { and, eq, isNull } from 'drizzle-orm';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { invites } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { requireAdmin } from '../../auth';
import { parseRevokeInvite } from '../model/schema';
import type { InviteDeps } from './create-invite';

/** Revokes a code. `revoked_at` is set only while it is NULL, so a second call changes nothing. */
export async function revokeInvite(input: unknown, deps: InviteDeps): Promise<{ revoked: true }> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv>());
  const now = deps.now ?? Date.now();
  await requireAdmin(deps.headers, { env });
  const parsed = parseRevokeInvite(input);
  if (!parsed.ok) throw new AppError('VALIDATION', { fieldErrors: parsed.fieldErrors });
  const { code } = parsed.data;

  const db = getDb(env);
  await db
    .update(invites)
    .set({ revokedAt: new Date(now) })
    .where(and(eq(invites.code, code), isNull(invites.revokedAt)));
  const [row] = await db.select({ code: invites.code }).from(invites).where(eq(invites.code, code));
  if (!row) throw new AppError('NOT_FOUND');
  return { revoked: true };
}
