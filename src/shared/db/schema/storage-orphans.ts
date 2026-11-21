import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Mirrors migrations/0005_storage_orphans.sql.
export const storageOrphans = sqliteTable('storage_orphans', {
  storageKey: text('storage_key').primaryKey(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  attempts: integer('attempts').notNull().default(0),
});
