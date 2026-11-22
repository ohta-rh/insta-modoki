-- Stories (#47): a photo or a video of at most 15 s that is hidden 24 h after it was made, and
-- who has seen it. docs/architecture/data-model.md "M3". Rows past `expires_at` are left out when
-- read; the sweep job (#56) removes them.

CREATE TABLE stories (
  id TEXT PRIMARY KEY NOT NULL,
  author_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  duration_ms INTEGER,
  alt_text TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CONSTRAINT stories_storage_key_unique UNIQUE (storage_key),
  CONSTRAINT stories_type_check CHECK (type IN ('image', 'video')),
  CONSTRAINT stories_width_check CHECK (width BETWEEN 1 AND 10000),
  CONSTRAINT stories_height_check CHECK (height BETWEEN 1 AND 10000),
  CONSTRAINT stories_duration_ms_check CHECK ((type = 'image' AND duration_ms IS NULL) OR (type = 'video' AND duration_ms IS NOT NULL AND duration_ms BETWEEN 1 AND 15000)),
  CONSTRAINT stories_alt_text_check CHECK (length(alt_text) <= 500),
  CONSTRAINT stories_expires_at_check CHECK (expires_at = created_at + 86400000)
);

CREATE INDEX stories_author_id_expires_at_idx ON stories (author_id, expires_at);

CREATE INDEX stories_expires_at_idx ON stories (expires_at);

CREATE TABLE story_views (
  story_id TEXT NOT NULL REFERENCES stories (id) ON DELETE CASCADE,
  viewer_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (story_id, viewer_id)
);

CREATE INDEX story_views_story_id_created_at_idx ON story_views (story_id, created_at DESC, viewer_id DESC);

CREATE INDEX story_views_viewer_id_idx ON story_views (viewer_id);
