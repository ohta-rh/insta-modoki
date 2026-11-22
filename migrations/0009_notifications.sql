-- notifications (#50): one row per like, comment or follow, addressed to the person it is for.
-- A like and a follow are unique per (recipient, actor, target) so a resend adds no second row;
-- a comment has its own row per comment. Deleting the post, the comment or a user cascades.

CREATE TABLE notifications (
  id TEXT PRIMARY KEY NOT NULL,
  recipient_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  post_id TEXT REFERENCES posts (id) ON DELETE CASCADE,
  comment_id TEXT REFERENCES comments (id) ON DELETE CASCADE,
  read_at INTEGER,
  created_at INTEGER NOT NULL,
  CONSTRAINT notifications_type_check CHECK (type IN ('like', 'comment', 'follow')),
  CONSTRAINT notifications_actor_id_check CHECK (actor_id <> recipient_id),
  CONSTRAINT notifications_target_check CHECK (
    (type = 'like' AND post_id IS NOT NULL AND comment_id IS NULL) OR
    (type = 'comment' AND post_id IS NOT NULL AND comment_id IS NOT NULL) OR
    (type = 'follow' AND post_id IS NULL AND comment_id IS NULL))
);

CREATE INDEX notifications_recipient_created_id_idx ON notifications (recipient_id, created_at DESC, id DESC);

CREATE INDEX notifications_recipient_unread_idx ON notifications (recipient_id) WHERE read_at IS NULL;

CREATE INDEX notifications_created_at_idx ON notifications (created_at);

CREATE UNIQUE INDEX notifications_like_unique ON notifications (recipient_id, actor_id, post_id) WHERE type = 'like';

CREATE UNIQUE INDEX notifications_follow_unique ON notifications (recipient_id, actor_id) WHERE type = 'follow';
