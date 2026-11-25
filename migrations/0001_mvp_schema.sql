-- M1 (MVP) core tables (#23). Types: docs/architecture/data-model.md "DB の型の対応".
-- Timestamps are INTEGER epoch milliseconds (UTC); booleans are INTEGER 0/1.
-- Constraints are named <table>_<column>_check. Trim uses an explicit whitespace set because
-- SQLite's trim() only removes spaces by default.

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar_key TEXT,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_private INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CONSTRAINT users_username_unique UNIQUE (username),
  CONSTRAINT users_email_unique UNIQUE (email),
  CONSTRAINT users_username_check CHECK (username = lower(username) AND length(username) BETWEEN 3 AND 30),
  CONSTRAINT users_email_check CHECK (email = lower(email)),
  CONSTRAINT users_display_name_check CHECK (length(trim(display_name, char(32, 9, 10, 11, 12, 13, 160, 12288))) BETWEEN 1 AND 30),
  CONSTRAINT users_bio_check CHECK (length(bio) <= 150),
  CONSTRAINT users_role_check CHECK (role IN ('user', 'admin')),
  CONSTRAINT users_is_private_check CHECK (is_private IN (0, 1))
);

CREATE TABLE posts (
  id TEXT PRIMARY KEY NOT NULL,
  author_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  caption TEXT NOT NULL DEFAULT '',
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  CONSTRAINT posts_caption_check CHECK (length(caption) <= 2200),
  CONSTRAINT posts_like_count_check CHECK (like_count >= 0),
  CONSTRAINT posts_comment_count_check CHECK (comment_count >= 0)
);

CREATE INDEX posts_author_id_created_at_id_idx ON posts (author_id, created_at DESC, id DESC);

CREATE INDEX posts_created_at_id_idx ON posts (created_at DESC, id DESC);

CREATE TABLE media (
  id TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  thumbhash TEXT NOT NULL,
  CONSTRAINT media_post_id_position_unique UNIQUE (post_id, position),
  CONSTRAINT media_position_check CHECK (position BETWEEN 0 AND 9),
  CONSTRAINT media_type_check CHECK (type IN ('image')),
  CONSTRAINT media_width_check CHECK (width >= 1),
  CONSTRAINT media_height_check CHECK (height >= 1),
  CONSTRAINT media_alt_text_check CHECK (length(alt_text) <= 500)
);

CREATE TABLE likes (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX likes_post_id_created_at_idx ON likes (post_id, created_at DESC);

CREATE TABLE comments (
  id TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES comments (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  CONSTRAINT comments_body_check CHECK (length(trim(body, char(32, 9, 10, 11, 12, 13, 160, 12288))) BETWEEN 1 AND 2200)
);

CREATE INDEX comments_post_parent_created_idx ON comments (post_id, parent_id, created_at, id);

CREATE TABLE follows (
  follower_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  followee_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (follower_id, followee_id),
  CONSTRAINT follows_follower_id_check CHECK (follower_id <> followee_id)
);

CREATE INDEX follows_followee_created_idx ON follows (followee_id, created_at DESC);
