import { DatabaseSync } from 'node:sqlite';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The app under test (opennextjs-cloudflare preview) keeps D1 as a sqlite file in .wrangler/state;
// these helpers open that same file (git-ignored, one per worktree) to seed rows and reset counters.
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

function withDb<T>(run: (db: DatabaseSync) => T): T {
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
  withDb((db) => db.exec("DELETE FROM rate_limits WHERE key NOT LIKE 'login:ip:198.51.100.%'"));
}

/** Inserts a user row directly (no password), so a test can collide with it. */
export function seedUser(username: string, email: string): void {
  const now = Date.now();
  withDb((db) =>
    db
      .prepare(
        'INSERT INTO users (id, username, display_name, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(crypto.randomUUID(), username, username, email, now, now),
  );
}

export function userRow(username: string): Record<string, unknown> | undefined {
  return withDb((db) => db.prepare('SELECT * FROM users WHERE username = ?').get(username));
}
