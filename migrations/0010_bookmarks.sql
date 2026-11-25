-- Saved posts (#51): one row per (user, post). Deleting the user or the post deletes the row.
CREATE TABLE bookmarks (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, post_id)
);
CREATE INDEX bookmarks_user_created_post_idx ON bookmarks (user_id, created_at DESC, post_id DESC);
