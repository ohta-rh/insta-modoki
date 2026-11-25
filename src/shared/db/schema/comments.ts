import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import { posts } from './posts';
import { users } from './users';

export const comments = sqliteTable(
  'comments',
  {
    id: text('id').primaryKey(),
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').references((): AnySQLiteColumn => comments.id, {
      onDelete: 'cascade',
    }),
    body: text('body').notNull(),
    // Nullable because SQLite cannot add a NOT NULL column to a table that has rows (0006); the app always sets it.
    clientRequestId: text('client_request_id'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    index('comments_post_parent_created_idx').on(t.postId, t.parentId, t.createdAt, t.id),
    uniqueIndex('comments_author_id_client_request_id_unique').on(t.authorId, t.clientRequestId),
    check(
      'comments_body_check',
      sql`length(trim(${t.body}, char(32, 9, 10, 11, 12, 13, 160, 12288))) BETWEEN 1 AND 2200`,
    ),
  ],
);
