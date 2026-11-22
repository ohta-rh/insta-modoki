import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPlatformProxy } from 'wrangler';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { getDb, type Db } from '../../src/shared/db';

const root = fileURLToPath(new URL('../..', import.meta.url));
const TABLES = [
  'rate_limits',
  'storage_orphans',
  'sessions',
  'accounts',
  'verifications',
  'story_views',
  'stories',
  'bookmarks',
  'likes',
  'follows',
  'comments',
  'media',
  'post_hashtags',
  'hashtags',
  'posts',
  'users',
] as const;

/** A DB name is for tests only when it ends with `_test` or contains `_test_<digits>`. */
export function assertTestDatabaseName(url: string): void {
  const name = new URL(url).pathname.replace(/^\//, '');
  if (!/_test(_\d+)?$/.test(name)) {
    throw new Error(`テスト用ではない DB には接続しません: ${name}`);
  }
}

type D1 = {
  prepare(sql: string): { run(): Promise<unknown>; all<T>(): Promise<{ results: T[] }> };
  batch(s: unknown[]): Promise<unknown[]>;
};

/** Applies migrations/*.sql in order, once each (tracked in d1_migrations like wrangler does). */
export async function applyMigrations(d1: D1, dir = join(root, 'migrations')): Promise<void> {
  await d1
    .prepare(
      'CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)',
    )
    .run();
  if (!existsSync(dir)) return;
  const done = new Set(
    (await d1.prepare('SELECT name FROM d1_migrations').all<{ name: string }>()).results.map(
      (r) => r.name,
    ),
  );
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    if (done.has(file)) continue;
    const statements = readFileSync(join(dir, file), 'utf8')
      .split('\n')
      .filter((l) => !l.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s !== '');
    for (const s of statements) await d1.prepare(s.replace(/\s+/g, ' ')).run();
    await d1.prepare(`INSERT INTO d1_migrations (name) VALUES ('${file}')`).run();
  }
}

/**
 * In-memory D1 (wrangler getPlatformProxy, persist: false) with the migrations applied once per
 * file; every table is emptied before each test. Read `.db` / `.d1` inside tests.
 */
export function useTestDb() {
  const url = process.env.TEST_DATABASE_URL;
  if (url) assertTestDatabaseName(url);

  let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: unknown }>>> | undefined;
  let d1: D1 | undefined;
  let db: Db | undefined;

  beforeAll(async () => {
    proxy = await getPlatformProxy<{ DB: unknown }>({ persist: false });
    d1 = proxy.env.DB as unknown as D1;
    await applyMigrations(d1);
    db = getDb({ DB: proxy.env.DB as never });
  });
  beforeEach(async () => {
    const present = new Set(
      (
        await d1!
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
          .all<{ name: string }>()
      ).results.map((r) => r.name),
    );
    const stmts = TABLES.filter((t) => present.has(t)).map((t) => d1!.prepare(`DELETE FROM ${t}`));
    if (stmts.length > 0) await d1!.batch(stmts);
  });
  afterAll(async () => {
    await proxy?.dispose();
  });

  return {
    get db(): Db {
      return db!;
    },
    get d1(): D1 {
      return d1!;
    },
  };
}
