-- posts.client_request_id (#33): the id the browser makes once per create screen, so a second
-- createPost call with the same value (double click, retry) returns the first result.
-- SQLite cannot add a NOT NULL column without a default to an existing table, so the column is
-- nullable; the application always sets it. NULLs never collide in a UNIQUE index.

ALTER TABLE posts ADD COLUMN client_request_id TEXT;

CREATE UNIQUE INDEX posts_author_id_client_request_id_unique ON posts (author_id, client_request_id);

-- A photo's storage key belongs to one media row: two posts racing for the same key cannot both win.
CREATE UNIQUE INDEX media_storage_key_unique ON media (storage_key);
