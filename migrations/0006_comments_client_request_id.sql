-- comments.client_request_id (#35): the id the browser makes once per comment, so a second
-- addComment call with the same value (double click, retry) returns the first result.
-- SQLite cannot add a NOT NULL column without a default to an existing table, so the column is
-- nullable; the application always sets it. NULLs never collide in a UNIQUE index.

ALTER TABLE comments ADD COLUMN client_request_id TEXT;

CREATE UNIQUE INDEX comments_author_id_client_request_id_unique ON comments (author_id, client_request_id);
