import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { getRequestEnv } from '../../../shared/db/request';
import { invites } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { generateCode } from '../model/code';
import { requireAdmin } from '../../auth';
import { parseCreateInvite } from '../model/schema';
import { toInviteView, type InviteView } from '../model/view';

export type InviteDeps = { env?: AuthEnv; headers: Headers; now?: number };

const DAY_MS = 86_400_000;

/** Issues one invite code for the signed-in administrator: `maxUses` uses, `expiresInDays` (default 7) days. */
export async function createInvite(input: unknown, deps: InviteDeps): Promise<InviteView> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv>());
  const now = deps.now ?? Date.now();
  const admin = await requireAdmin(deps.headers, { env });
  const parsed = parseCreateInvite(input);
  if (!parsed.ok) throw new AppError('VALIDATION', { fieldErrors: parsed.fieldErrors });

  const row = {
    code: generateCode(),
    createdBy: admin.id,
    maxUses: parsed.data.maxUses,
    usedCount: 0,
    expiresAt: new Date(now + parsed.data.expiresInDays * DAY_MS),
    revokedAt: null,
    createdAt: new Date(now),
  };
  await getDb(env).insert(invites).values(row);
  return toInviteView(row, now);
}
