import { desc } from 'drizzle-orm';
import type { AuthEnv } from '../../auth/api/auth-env';
import { getDb } from '../../../shared/db/client';
import { keysetBefore, readCursor, toPage } from '../../../shared/db/cursor';
import { getRequestEnv } from '../../../shared/db/request';
import { invites } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { requireAdmin } from '../model/require-admin';
import { INVITE_PAGE_SIZE, parseListInvites } from '../model/schema';
import { toInviteView, type InviteView } from '../model/view';
import type { InviteDeps } from './create-invite';

export type InvitePage = { items: InviteView[]; nextCursor: string | null };

/** One page (20) of invites, the newest first (ties: larger code first). Administrators only. */
export async function listInvites(input: unknown, deps: InviteDeps): Promise<InvitePage> {
  const env = deps.env ?? (await getRequestEnv<AuthEnv>());
  const now = deps.now ?? Date.now();
  await requireAdmin(deps.headers, { env });
  const parsed = parseListInvites(input);
  if (!parsed.ok) throw new AppError('VALIDATION', { fieldErrors: parsed.fieldErrors });
  const cursor = readCursor(parsed.data.cursor);

  const rows = await getDb(env)
    .select()
    .from(invites)
    .where(keysetBefore(invites.createdAt, invites.code, cursor))
    .orderBy(desc(invites.createdAt), desc(invites.code))
    .limit(INVITE_PAGE_SIZE + 1);
  const page = toPage(rows, INVITE_PAGE_SIZE, (r) => ({ createdAt: r.createdAt, id: r.code }));
  return { items: page.items.map((r) => toInviteView(r, now)), nextCursor: page.nextCursor };
}
