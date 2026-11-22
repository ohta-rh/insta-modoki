import { requireUser } from '../../auth';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { AppError } from '../../../shared/errors';
import { countUnread } from '../db/unread';
import { noInput } from '../model/schema';

export type UnreadCountDeps = { env?: AuthEnv; headers: Headers; now?: number };

/** The signed-in user's unread notifications, at most UNREAD_COUNT_CAP (100). The input is empty. */
export async function getUnreadNotificationCount(
  input: unknown,
  deps: UnreadCountDeps,
): Promise<{ count: number }> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv>());
  const user = await requireUser(deps.headers, { env });
  if (!noInput.safeParse(input ?? {}).success) throw new AppError('VALIDATION');
  return { count: await countUnread(getDb(env), user.id) };
}
