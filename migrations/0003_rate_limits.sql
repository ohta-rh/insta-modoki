-- Fixed-window rate limit counters (#26). One row per (key, window); consume() upserts it.
-- window_start is the window's first instant as epoch milliseconds (UTC).

CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (key, window_start),
  CONSTRAINT rate_limits_count_check CHECK (count >= 1)
);
