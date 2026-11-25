import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from '../../../shared/db/schema/users';

export const invites = sqliteTable(
  'invites',
  {
    code: text('code').primaryKey(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    maxUses: integer('max_uses').notNull(),
    usedCount: integer('used_count').notNull().default(0),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    check('invites_max_uses_check', sql`${t.maxUses} BETWEEN 1 AND 100`),
    check('invites_used_count_check', sql`${t.usedCount} >= 0 AND ${t.usedCount} <= ${t.maxUses}`),
    index('invites_created_idx').on(sql`${t.createdAt} DESC`, sql`${t.code} DESC`),
  ],
);
