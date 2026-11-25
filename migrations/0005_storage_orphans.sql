-- Storage keys whose rows were deleted but whose files could not be removed (#28).
-- M3's cleanup job retries them; attempts counts the retries.

CREATE TABLE storage_orphans (
  storage_key TEXT PRIMARY KEY NOT NULL,
  created_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
