-- M3 hashtags (#49). Docs: docs/architecture/data-model.md "M3 › hashtags / post_hashtags".
-- `name` is NFKC-normalized and lower case (the application does it); created_at copies the post's.

CREATE TABLE hashtags (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  CONSTRAINT hashtags_name_unique UNIQUE (name),
  CONSTRAINT hashtags_name_check CHECK (length(name) BETWEEN 1 AND 100)
);

CREATE TABLE post_hashtags (
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  hashtag_id TEXT NOT NULL REFERENCES hashtags (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (post_id, hashtag_id)
);

CREATE INDEX post_hashtags_hashtag_created_post_idx ON post_hashtags (hashtag_id, created_at DESC, post_id DESC);
