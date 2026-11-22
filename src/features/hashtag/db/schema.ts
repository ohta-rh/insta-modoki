import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from 'drizzle-orm/sqlite-core';
import { posts } from '../../../shared/db/schema/posts';

export const hashtags = sqliteTable(
  'hashtags',
  {
    id: text('id').primaryKey().notNull(),
    name: text('name').notNull(),
  },
  (t) => [
    unique('hashtags_name_unique').on(t.name),
    check('hashtags_name_check', sql`length(${t.name}) BETWEEN 1 AND 100`),
  ],
);

export const postHashtags = sqliteTable(
  'post_hashtags',
  {
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    hashtagId: text('hashtag_id')
      .notNull()
      .references(() => hashtags.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.postId, t.hashtagId] }),
    index('post_hashtags_hashtag_created_post_idx').on(
      t.hashtagId,
      sql`${t.createdAt} DESC`,
      sql`${t.postId} DESC`,
    ),
  ],
);
