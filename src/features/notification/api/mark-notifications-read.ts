import { and, eq, isNull } from 'drizzle-orm';
import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { AppError } from '../../../shared/errors';
import type { StorageEnv } from '../../../shared/storage';
import { notifications } from '../db/schema';
import { noInput } from '../model/schema';

export type MarkReadDeps = { env?: AuthEnv & StorageEnv; headers: Headers; now?: number };

/**
 * Marks every unread notification of the signed-in user as read and returns how many it changed.
 * Calling it again changes nothing (`{ readCount: 0 }`). The input is empty.
 */
export async function markNotificationsRead(
  input: unknown,
  deps: MarkReadDeps,
): Promise<{ readCount: number }> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv & StorageEnv>());
  const user = await requireUser(deps.headers, { env });
  if (!noInput.safeParse(input ?? {}).success) throw new AppError('VALIDATION');
  const result = await getDb(env)
    .update(notifications)
    .set({ readAt: new Date(deps.now ?? Date.now()) })
    .where(and(eq(notifications.recipientId, user.id), isNull(notifications.readAt)))
    .run();
  return { readCount: result.meta.changes };
}
