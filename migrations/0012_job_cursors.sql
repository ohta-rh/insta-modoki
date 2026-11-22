-- Where a scheduled job resumes a long listing: upload-orphan-sweep keeps the last storage key
-- it listed under each prefix ('' = start from the beginning next time).
CREATE TABLE job_cursors (
  name TEXT PRIMARY KEY NOT NULL,
  last_key TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
