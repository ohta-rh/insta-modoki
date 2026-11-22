import { and, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '../../../shared/db/client';
import { UNREAD_COUNT_CAP } from '../model/schema';
import { notifications } from './schema';

/**
 * How many unread notifications a user has, stopping at UNREAD_COUNT_CAP: the inner query reads at
 * most that many rows of notifications_recipient_unread_idx, however many are unread.
 */
export async function countUnread(db: Db, recipientId: string): Promise<number> {
  const capped = db
    .select({ one: sql<number>`1`.as('one') })
    .from(notifications)
    .where(and(eq(notifications.recipientId, recipientId), isNull(notifications.readAt)))
    .limit(UNREAD_COUNT_CAP)
    .as('capped');
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(capped);
  return row?.n ?? 0;
}
