import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { posts } from '../../../shared/db/schema/posts';
import { users } from '../../../shared/db/schema/users';

export const bookmarks = sqliteTable(
  'bookmarks',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.postId] }),
    index('bookmarks_user_created_post_idx').on(
      t.userId,
      sql`${t.createdAt} DESC`,
      sql`${t.postId} DESC`,
    ),
  ],
);
