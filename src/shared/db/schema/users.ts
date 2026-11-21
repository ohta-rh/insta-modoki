import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

// Mirrors migrations/0001_mvp_schema.sql (hand-written; schema.int.test.ts checks they agree).
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull(),
    displayName: text('display_name').notNull(),
    bio: text('bio').notNull().default(''),
    avatarKey: text('avatar_key'),
    email: text('email').notNull(),
    role: text('role', { enum: ['user', 'admin'] })
      .notNull()
      .default('user'),
    emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
    isPrivate: integer('is_private', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [
    unique('users_username_unique').on(t.username),
    unique('users_email_unique').on(t.email),
    check(
      'users_username_check',
      sql`${t.username} = lower(${t.username}) AND length(${t.username}) BETWEEN 3 AND 30`,
    ),
    check('users_email_check', sql`${t.email} = lower(${t.email})`),
    check(
      'users_display_name_check',
      sql`length(trim(${t.displayName}, char(32, 9, 10, 11, 12, 13, 160, 12288))) BETWEEN 1 AND 30`,
    ),
    check('users_bio_check', sql`length(${t.bio}) <= 150`),
    check('users_role_check', sql`${t.role} IN ('user', 'admin')`),
    check('users_email_verified_check', sql`${t.emailVerified} IN (0, 1)`),
    check('users_is_private_check', sql`${t.isPrivate} IN (0, 1)`),
  ],
);
