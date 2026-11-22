-- Invite codes (#38): an admin issues them, sign-up consumes them. The CHECK on used_count is
-- what stops two concurrent sign-ups from both using the last use (the db.batch is rolled back).
-- Deleting the admin who issued a code deletes the code (data-model.md: FKs from users cascade).
CREATE TABLE invites (
  code TEXT PRIMARY KEY,
  created_by TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  max_uses INTEGER NOT NULL CONSTRAINT invites_max_uses_check CHECK (max_uses BETWEEN 1 AND 100),
  used_count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  CONSTRAINT invites_used_count_check CHECK (used_count >= 0 AND used_count <= max_uses)
);
CREATE INDEX invites_created_idx ON invites (created_at DESC, code DESC);
