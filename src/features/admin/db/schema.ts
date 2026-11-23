import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from '../../../shared/db/schema/users';

// Mirrors migrations/0014_admin_actions.sql (docs/architecture/data-model.md "M2").
export const adminActions = sqliteTable(
  'admin_actions',
  {
    id: text('id').primaryKey(),
    adminId: text('admin_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    action: text('action', { enum: ['delete_post', 'delete_user', 'resolve_report'] }).notNull(),
    /** A post id or a user id; no FK, the record stays after the target is deleted. */
    targetId: text('target_id').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    check(
      'admin_actions_action_check',
      sql`${t.action} IN ('delete_post', 'delete_user', 'resolve_report')`,
    ),
    index('admin_actions_created_idx').on(sql`${t.createdAt} DESC`),
  ],
);
