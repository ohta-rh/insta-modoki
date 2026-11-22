import { eq, sql } from 'drizzle-orm';
import type { Db } from '../../../shared/db/client';
import { invites } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { INVITE_MESSAGES } from '../model/messages';
import { getInviteStatus } from '../model/status';

export async function findInvite(db: Db, code: string) {
  const [row] = await db.select().from(invites).where(eq(invites.code, code));
  return row ?? null;
}

const invalid = (message: string) =>
  new AppError('VALIDATION', { fieldErrors: { inviteCode: [message] } });

/**
 * Checks a normalized code before the sign-up batch: unknown, revoked, expired and used-up codes
 * are VALIDATION with the reason under `inviteCode`. A valid code passes; the use itself is taken
 * by `inviteBatchStatement` inside the batch.
 */
export async function assertInviteUsable(db: Db, code: string, now: number): Promise<void> {
  const row = await findInvite(db, code);
  if (!row) throw invalid(INVITE_MESSAGES.unknown);
  const status = getInviteStatus(row, now);
  if (status !== 'active') throw invalid(INVITE_MESSAGES[status]);
}

/**
 * The statement that takes one use. It goes first in the sign-up `db.batch`: when two sign-ups race
 * for the last use, the CHECK `invites_used_count_check` fails the second batch and D1 rolls the
 * whole batch back. A later failure (the username is taken) rolls the use back too.
 */
export function inviteBatchStatement(db: Db, code: string) {
  return db
    .update(invites)
    .set({ usedCount: sql`${invites.usedCount} + 1` })
    .where(eq(invites.code, code));
}

/** The error a failed sign-up batch means for the invite, or null when it is not the invite's CHECK. */
export function inviteFailure(error: unknown): AppError | null {
  for (let e: unknown = error, i = 0; e && i < 5; i += 1) {
    if (
      /CHECK constraint failed: invites_used_count_check/.test(
        e instanceof Error ? e.message : String(e),
      )
    ) {
      return invalid(INVITE_MESSAGES.used_up);
    }
    e = e instanceof Error ? e.cause : undefined;
  }
  return null;
}
