import { eq } from 'drizzle-orm';
import { getDb, type DbEnv } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { users } from '../../../shared/db/schema/users';
import { AppError } from '../../../shared/errors';
import { clientIp } from '../../../shared/security/client-ip';
import { consume } from '../../../shared/security/rate-limit';
import { parseUsername } from '../model/schema';

/** Whether a username is free. Lower-cases first; no login needed (the sign-up form calls it on blur). */
export async function checkUsername(
  input: unknown,
  deps: { env?: DbEnv; headers?: Headers; now?: number } = {},
): Promise<{ available: boolean }> {
  const db = getDb(deps.env ?? (await getRequestEnv()));
  // 30 checks per minute per IP: the endpoint needs no login, so it must not be a free probe.
  await consume(`checkname:ip:${clientIp(deps.headers ?? new Headers())}`, 30, 60, 1, {
    db,
    now: deps.now,
  });
  const parsed = parseUsername(input);
  if (!parsed.ok) throw new AppError('VALIDATION', { fieldErrors: parsed.fieldErrors });
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, parsed.data.username))
    .limit(1);
  return { available: rows.length === 0 };
}
