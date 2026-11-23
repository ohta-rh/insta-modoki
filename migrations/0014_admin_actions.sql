-- The administrator's deletions (#39). target_id has no FK on purpose: the record outlives the
-- post or user it names. 'resolve_report' is allowed by the CHECK now so M4 needs no table rebuild.
CREATE TABLE admin_actions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  action TEXT NOT NULL CONSTRAINT admin_actions_action_check CHECK (action IN ('delete_post', 'delete_user', 'resolve_report')),
  target_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX admin_actions_created_idx ON admin_actions (created_at DESC);
