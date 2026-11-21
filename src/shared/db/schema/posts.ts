import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { users } from './users';

export const posts = sqliteTable(
  'posts',
  {
    id: text('id').primaryKey(),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    caption: text('caption').notNull().default(''),
    likeCount: integer('like_count').notNull().default(0),
    commentCount: integer('comment_count').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    index('posts_author_id_created_at_id_idx').on(
      t.authorId,
      sql`${t.createdAt} DESC`,
      sql`${t.id} DESC`,
    ),
    index('posts_created_at_id_idx').on(sql`${t.createdAt} DESC`, sql`${t.id} DESC`),
    check('posts_caption_check', sql`length(${t.caption}) <= 2200`),
    check('posts_like_count_check', sql`${t.likeCount} >= 0`),
    check('posts_comment_count_check', sql`${t.commentCount} >= 0`),
  ],
);
