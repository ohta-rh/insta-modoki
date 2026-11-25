import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text, unique, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { posts } from './posts';

export const media = sqliteTable(
  'media',
  {
    id: text('id').primaryKey(),
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    type: text('type', { enum: ['image'] }).notNull(),
    // media/<userId>/<UUIDv7>; its shape is checked by the input validation (#27), not here.
    storageKey: text('storage_key').notNull(),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    altText: text('alt_text').notNull().default(''),
    thumbhash: text('thumbhash').notNull(),
  },
  (t) => [
    uniqueIndex('media_storage_key_unique').on(t.storageKey),
    unique('media_post_id_position_unique').on(t.postId, t.position),
    check('media_position_check', sql`${t.position} BETWEEN 0 AND 9`),
    check('media_type_check', sql`${t.type} IN ('image')`),
    check('media_width_check', sql`${t.width} >= 1`),
    check('media_height_check', sql`${t.height} >= 1`),
    check('media_alt_text_check', sql`length(${t.altText}) <= 500`),
  ],
);
