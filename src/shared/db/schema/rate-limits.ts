import { sql } from 'drizzle-orm';
import { check, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Mirrors migrations/0003_rate_limits.sql.
export const rateLimits = sqliteTable(
  'rate_limits',
  {
    key: text('key').notNull(),
    windowStart: integer('window_start').notNull(),
    count: integer('count').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.key, t.windowStart] }),
    check('rate_limits_count_check', sql`${t.count} >= 1`),
  ],
);
