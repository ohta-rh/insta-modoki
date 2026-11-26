import { DatabaseSync } from 'node:sqlite';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { harness } from './harness';

// The app under test (opennextjs-cloudflare preview) keeps D1 as a sqlite file in .wrangler/state;
// these helpers open that same file (git-ignored, one per worktree) to READ rows. Every write goes
// through the app (support/harness.ts, ADR-0041): a second writer made the app fail with SQLITE_BUSY.
const DIR = join(process.cwd(), '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');

function dbFile(): string {
  const files = existsSync(DIR)
    ? readdirSync(DIR).filter((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite')
    : [];
  if (files.length === 0) {
    throw new Error(
      'D1 のファイルがありません。node scripts/slot.mjs prepare <N> を実行してください',
    );
  }
  return join(
    DIR,
    files.sort((a, b) => statSync(join(DIR, b)).mtimeMs - statSync(join(DIR, a)).mtimeMs)[0]!,
  );
}

export function withDb<T>(run: (db: DatabaseSync) => T): T {
  const db = new DatabaseSync(dbFile());
  try {
    db.exec('PRAGMA busy_timeout = 10000');
    return run(db);
  } finally {
    db.close();
  }
}

/**
 * Sign-up is limited to 10 per hour per IP and every local request shares the IP "local".
 * Counters of the documentation range 198.51.100.x are kept: a spec that counts attempts from
 * its own IP (login-logout) must not be reset by another spec running in parallel.
 */
export function clearRateLimits(): void {
  harness({ op: 'clearRateLimits' });
}

/** Makes the user's next post over the hourly limit, or (count 0) clears the counter. */
export function setPostCount(userId: string, count: number): void {
  harness({ op: 'setPostCount', userId, count });
}

/** Inserts a user row directly (no password), so a test can collide with it. */
export function seedUser(
  username: string,
  email: string,
  profile: { displayName?: string; bio?: string } = {},
): void {
  harness({ op: 'seedUser', username, email, ...profile });
}

/** Adds a follow row (`followerId` follows `followeeId`). */
export function seedFollow(followerId: string, followeeId: string): void {
  harness({ op: 'follow', followerId, followeeId });
}

export function userRow(username: string): Record<string, unknown> | undefined {
  return withDb((db) => db.prepare('SELECT * FROM users WHERE username = ?').get(username));
}

export function postRows(authorId: string): Record<string, unknown>[] {
  return withDb((db) =>
    db.prepare('SELECT * FROM posts WHERE author_id = ? ORDER BY created_at, id').all(authorId),
  );
}

/** The media rows of a post, in photo order. */
export function mediaRows(postId: string): Record<string, unknown>[] {
  return withDb((db) =>
    db.prepare('SELECT * FROM media WHERE post_id = ? ORDER BY position').all(postId),
  );
}

/** The rate-limit rows of a key (for a failure message that says why a sign-up was refused). */
export function rateRows(key: string): Record<string, unknown>[] {
  return withDb((db) => db.prepare('SELECT * FROM rate_limits WHERE key = ?').all(key));
}

/** Sets the user's upload counter (300 an hour is the limit), or (count 0) clears it. */
export function setUploadCount(userId: string, count: number): void {
  harness({ op: 'setUploadCount', userId, count });
}

/**
 * Makes `n` new users follow `followeeId`, the i-th at a later time than the one before (so the
 * last name is the newest follower). Written by the app; returns the usernames in that order.
 */
export function seedFollowers(followeeId: string, n: number): string[] {
  const start = Date.now() - 3_600_000;
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const followers = Array.from({ length: n }, (_, i) => ({
    username: `e2e_g${stamp}${i}`,
    email: `e2e_g${stamp}${i}@example.com`,
    followedAt: start + i * 1000,
  }));
  harness({ op: 'seedFollowers', followeeId, followers });
  return followers.map((f) => f.username);
}

/** How many unread notifications the user has (read directly; every write goes through the app). */
export function unreadNotificationCount(username: string): number {
  return withDb(
    (db) =>
      (
        db
          .prepare(
            'SELECT count(*) AS n FROM notifications WHERE read_at IS NULL AND recipient_id = (SELECT id FROM users WHERE username = ?)',
          )
          .get(username) as { n: number }
      ).n,
  );
}

/** The most likes any post of the last 7 days has (0 when there is none): what a test must beat to lead the discover tab. */
export function maxExploreLikeCount(): number {
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const row = withDb((db) =>
    db.prepare('SELECT MAX(like_count) AS max FROM posts WHERE created_at >= ?').get(since),
  ) as { max: number | null };
  return row.max ?? 0;
}
