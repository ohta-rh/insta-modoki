import { and, desc, eq, isNull, sql } from 'drizzle-orm';
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

/**
 * A key for the newest notification of a user (its time and id), or null when there is none: one row
 * of notifications_recipient_created_id_idx. The stream compares it between ticks to see whether
 * anything new arrived before it counts the unread ones.
 */
export async function latestNotificationKey(db: Db, recipientId: string): Promise<string | null> {
  const [row] = await db
    .select({ createdAt: notifications.createdAt, id: notifications.id })
    .from(notifications)
    .where(eq(notifications.recipientId, recipientId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(1);
  return row ? `${row.createdAt.getTime()}:${row.id}` : null;
}
