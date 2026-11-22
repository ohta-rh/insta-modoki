import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { comments } from '../../../shared/db/schema/comments';
import { posts } from '../../../shared/db/schema/posts';
import { users } from '../../../shared/db/schema/users';

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    recipientId: text('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actorId: text('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['like', 'comment', 'follow'] }).notNull(),
    postId: text('post_id').references(() => posts.id, { onDelete: 'cascade' }),
    commentId: text('comment_id').references(() => comments.id, { onDelete: 'cascade' }),
    readAt: integer('read_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    index('notifications_recipient_created_id_idx').on(
      t.recipientId,
      sql`${t.createdAt} DESC`,
      sql`${t.id} DESC`,
    ),
    index('notifications_recipient_unread_idx')
      .on(t.recipientId)
      .where(sql`${t.readAt} IS NULL`),
    index('notifications_created_at_idx').on(t.createdAt),
    uniqueIndex('notifications_like_unique')
      .on(t.recipientId, t.actorId, t.postId)
      .where(sql`${t.type} = 'like'`),
    uniqueIndex('notifications_follow_unique')
      .on(t.recipientId, t.actorId)
      .where(sql`${t.type} = 'follow'`),
  ],
);
