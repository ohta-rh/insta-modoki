import { eq } from 'drizzle-orm';
import { getDb, type DbEnv } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { users } from '../../../shared/db/schema/users';
import { AppError } from '../../../shared/errors';
import { parseUsername } from '../model/schema';

/** Whether a username is free. Lower-cases first; no login needed (the sign-up form calls it on blur). */
export async function checkUsername(
  input: unknown,
  deps: { env?: DbEnv } = {},
): Promise<{ available: boolean }> {
  const parsed = parseUsername(input);
  if (!parsed.ok) throw new AppError('VALIDATION', { fieldErrors: parsed.fieldErrors });
  const db = getDb(deps.env ?? (await getRequestEnv()));
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, parsed.data.username))
    .limit(1);
  return { available: rows.length === 0 };
}
