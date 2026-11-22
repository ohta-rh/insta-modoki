import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { users } from '../../../shared/db/schema/users';

// Mirrors migrations/0007_stories.sql (docs/architecture/data-model.md "M3").
const ts = (name: string) => integer(name, { mode: 'timestamp_ms' });

export const stories = sqliteTable(
  'stories',
  {
    id: text('id').primaryKey(),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['image', 'video'] }).notNull(),
    storageKey: text('storage_key').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    durationMs: integer('duration_ms'),
    altText: text('alt_text').notNull().default(''),
    createdAt: ts('created_at').notNull(),
    expiresAt: ts('expires_at').notNull(),
  },
  (t) => [
    unique('stories_storage_key_unique').on(t.storageKey),
    index('stories_author_id_expires_at_idx').on(t.authorId, t.expiresAt),
    index('stories_expires_at_idx').on(t.expiresAt),
  ],
);

export const storyViews = sqliteTable(
  'story_views',
  {
    storyId: text('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    viewerId: text('viewer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: ts('created_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.storyId, t.viewerId] }),
    index('story_views_story_id_created_at_idx').on(
      t.storyId,
      sql`${t.createdAt} DESC`,
      sql`${t.viewerId} DESC`,
    ),
    index('story_views_viewer_id_idx').on(t.viewerId),
  ],
);
