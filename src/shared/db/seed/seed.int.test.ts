import { getPlatformProxy } from 'wrangler';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyMigrations } from '../../../../tests/helpers/db';
import { headObject, loadStorageEnv } from '../../../../tests/helpers/storage';
import { verifyPassword } from '../../../features/auth/model/password';
import { type StorageEnv } from '../../storage/client';
import { runSeed, type SeedD1, type SeedEnv } from './seed';

const SUFFIX = '@seed.invalid';
const SEED_USERS = `SELECT id FROM users WHERE email LIKE '%${SUFFIX}'`;
const SEED_POSTS = `SELECT id FROM posts WHERE author_id IN (${SEED_USERS})`;

let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ DB: SeedD1 }>>>;
let storage: StorageEnv;
let env: SeedEnv;
const demoPassword = `p${crypto.randomUUID()}`;

type Counter = { n: number };
const one = async (sql: string): Promise<number> => (await env.DB.prepare(sql).first<Counter>())!.n;
const rows = async <T>(sql: string): Promise<T[]> => (await env.DB.prepare(sql).all<T>()).results;

async function seed(profile: 'demo' | 'bench', extra: Partial<Parameters<typeof runSeed>[1]> = {}) {
  const lines: string[] = [];
  const code = await runSeed(['--profile', profile], {
    env,
    vars: { SEED_DEMO_PASSWORD: demoPassword },
    log: (l) => lines.push(l),
    ...extra,
  });
  return { code, lines };
}

beforeAll(async () => {
  proxy = await getPlatformProxy<{ DB: SeedD1 }>({ persist: false });
  await applyMigrations(proxy.env.DB as never);
  storage = await loadStorageEnv();
  env = {
    ...storage,
    DB: proxy.env.DB,
    AUTH_PEPPER: 'test-pepper-value',
    SLOT: (proxy.env as { SLOT?: string }).SLOT,
  };
}, 60_000);
afterAll(async () => {
  await proxy?.dispose();
});

describe('seed:demo', () => {
  let first: { code: number; lines: string[] };
  beforeAll(async () => {
    first = await seed('demo');
  }, 300_000);

  it('demo は 30 人と 300 件の投稿を作る', async () => {
    expect(first.code).toBe(0);
    expect(await one(`SELECT count(*) AS n FROM users WHERE email LIKE '%${SUFFIX}'`)).toBe(30);
    expect(await one("SELECT count(*) AS n FROM users WHERE username = 'demo'")).toBe(1);
    expect(await one(`SELECT count(*) AS n FROM posts WHERE author_id IN (${SEED_USERS})`)).toBe(
      300,
    );
    const media = await one(`SELECT count(*) AS n FROM media WHERE post_id IN (${SEED_POSTS})`);
    expect(first.lines.at(-1)).toBe(`seed: demo OK users=30 posts=300 media=${media}`);
    expect(
      await one(`SELECT count(*) AS n FROM posts WHERE id NOT IN (SELECT post_id FROM media)`),
    ).toBe(0);
    expect(
      await one(`SELECT max(c) AS n FROM (SELECT count(*) AS c FROM media GROUP BY post_id)`),
    ).toBe(10);
  });

  it('10 枚の投稿がちょうど 3 件ある', async () => {
    expect(
      await one(
        'SELECT count(*) AS n FROM (SELECT post_id FROM media GROUP BY post_id HAVING count(*) = 10)',
      ),
    ).toBe(3);
  });

  it('全ての投稿で like_count と comment_count が行数と一致する', async () => {
    expect(
      await one(
        'SELECT count(*) AS n FROM posts p WHERE p.like_count <> (SELECT count(*) FROM likes l WHERE l.post_id = p.id) OR p.comment_count <> (SELECT count(*) FROM comments c WHERE c.post_id = p.id)',
      ),
    ).toBe(0);
    expect(await one('SELECT sum(like_count) AS n FROM posts')).toBeGreaterThan(0);
    expect(await one('SELECT sum(comment_count) AS n FROM posts')).toBeGreaterThan(0);
  });

  it('返信は 1 階層だけ', async () => {
    expect(
      await one('SELECT count(*) AS n FROM comments WHERE parent_id IS NOT NULL'),
    ).toBeGreaterThan(0);
    expect(
      await one(
        'SELECT count(*) AS n FROM comments c JOIN comments p ON p.id = c.parent_id WHERE p.parent_id IS NOT NULL',
      ),
    ).toBe(0);
  });

  it('demo のフィードの元の投稿が 100 件以上ある', async () => {
    expect(
      await one(
        "SELECT count(*) AS n FROM follows WHERE follower_id = (SELECT id FROM users WHERE username = 'demo')",
      ),
    ).toBe(20);
    expect(
      await one(
        "SELECT count(*) AS n FROM posts WHERE author_id IN (SELECT followee_id FROM follows WHERE follower_id = (SELECT id FROM users WHERE username = 'demo'))",
      ),
    ).toBeGreaterThanOrEqual(100);
  });

  it('全ての media の 4 つのファイルがバケットにある', async () => {
    const keys = await rows<{ k: string }>('SELECT DISTINCT storage_key AS k FROM media');
    expect(keys.length).toBeGreaterThan(300);
    for (const { k } of keys.slice(0, 40)) {
      expect(k).toMatch(/^media\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/);
      for (const name of ['orig', 'w320', 'w640', 'w1080']) {
        expect(await headObject(storage, `${k}/${name}.webp`), `${k}/${name}`).not.toBeNull();
      }
    }
    const last = keys.at(-1)!.k;
    for (const name of ['orig', 'w320', 'w640', 'w1080']) {
      expect(await headObject(storage, `${last}/${name}.webp`)).toMatchObject({
        contentType: 'image/webp',
      });
    }
    const owner = await one(
      "SELECT count(*) AS n FROM media m JOIN posts p ON p.id = m.post_id WHERE m.storage_key NOT LIKE 'media/' || p.author_id || '/%'",
    );
    expect(owner).toBe(0);
  });

  it('alt_text と thumbhash が空でない', async () => {
    expect(
      await one(
        "SELECT count(*) AS n FROM media WHERE alt_text = '' OR thumbhash = '' OR width < 1 OR height < 1",
      ),
    ).toBe(0);
  });

  it('demo は渡したパスワードでログインできる形で入る', async () => {
    const [account] = await rows<{ password: string }>(
      "SELECT a.password FROM accounts a JOIN users u ON u.id = a.user_id WHERE u.username = 'demo' AND a.provider_id = 'credential'",
    );
    expect(await verifyPassword(demoPassword, account!.password, env.AUTH_PEPPER)).toBe(true);
    expect(await one('SELECT count(*) AS n FROM accounts')).toBe(1);
  });

  it('DATABASE_URL と S3_BUCKET のスロットにだけ書く', async () => {
    expect(storage.S3_BUCKET).toMatch(/^insta-s\d+$/);
    const [{ k }] = (await rows<{ k: string }>('SELECT storage_key AS k FROM media LIMIT 1')) as [
      { k: string },
    ];
    expect(await headObject(storage, `${k}/orig.webp`)).not.toBeNull();
    const lines: string[] = [];
    const code = await runSeed(['--profile', 'demo'], {
      env: { ...env, S3_BUCKET: 'insta-prod' },
      vars: {},
      log: (l) => lines.push(l),
    });
    expect(code).toBe(1);
    expect(await one(`SELECT count(*) AS n FROM posts WHERE author_id IN (${SEED_USERS})`)).toBe(
      300,
    );
  });
});

describe('seed:demo をもう 1 回流す', () => {
  let second: { code: number; lines: string[] };
  beforeAll(async () => {
    const at = Date.now();
    await env.DB.prepare(
      `INSERT INTO users (id, username, display_name, email, created_at, updated_at) VALUES ('real-1', 'real_user', '実在', 'real@example.com', ${at}, ${at})`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO posts (id, author_id, caption, created_at) VALUES ('real-post', 'real-1', 'x', ${at})`,
    ).run();
    second = await seed('demo');
  }, 300_000);

  it('2 回流しても投稿は 300 件のまま', async () => {
    expect(second.code).toBe(0);
    expect(second.lines.at(-1)).toMatch(/^seed: demo OK users=30 posts=300 media=\d+$/);
    expect(await one(`SELECT count(*) AS n FROM posts WHERE author_id IN (${SEED_USERS})`)).toBe(
      300,
    );
    expect(await one(`SELECT count(*) AS n FROM users WHERE email LIKE '%${SUFFIX}'`)).toBe(30);
  });

  it('実在の利用者の行は消さない', async () => {
    expect(await one("SELECT count(*) AS n FROM users WHERE id = 'real-1'")).toBe(1);
    expect(await one("SELECT count(*) AS n FROM posts WHERE id = 'real-post'")).toBe(1);
    expect(await one('SELECT count(*) AS n FROM posts')).toBe(301);
    await env.DB.prepare("DELETE FROM users WHERE id = 'real-1'").run();
  });
});

describe('seed の数の確認', () => {
  it('数が合わないとき FAIL を出して 1 を返す', async () => {
    await env.DB.prepare(
      "CREATE TRIGGER seed_test_drop_post AFTER INSERT ON follows WHEN new.follower_id = (SELECT id FROM users WHERE username = 'demo') BEGIN DELETE FROM posts WHERE id = (SELECT id FROM posts ORDER BY created_at LIMIT 1); END",
    ).run();
    try {
      const { code, lines } = await seed('demo', {
        profiles: { demo: { users: 6, posts: 20, demoFollows: 3 } },
      });
      expect(code).toBe(1);
      expect(lines.at(-1)).toBe('seed: FAIL users=6 posts=17');
    } finally {
      await env.DB.prepare('DROP TRIGGER seed_test_drop_post').run();
    }
  }, 300_000);
});

describe('seed:bench', () => {
  it('bench は 1,000 人と 10,000 件を作る', async () => {
    const { code, lines } = await seed('bench');
    expect(code).toBe(0);
    expect(lines.at(-1)).toBe('seed: bench OK users=1000 posts=10000');
    expect(await one(`SELECT count(*) AS n FROM users WHERE email LIKE '%${SUFFIX}'`)).toBe(1000);
    // media.storage_key is UNIQUE: a pooled image is copied under each row's own key.
    expect(await one('SELECT count(DISTINCT storage_key) AS n FROM media')).toBe(
      await one('SELECT count(*) AS n FROM media'),
    );
    const [{ k }] = (await rows<{ k: string }>(
      'SELECT storage_key AS k FROM media ORDER BY storage_key DESC LIMIT 1',
    )) as [{ k: string }];
    for (const name of ['orig', 'w320', 'w640', 'w1080']) {
      expect(await headObject(storage, `${k}/${name}.webp`)).not.toBeNull();
    }
    expect(
      await one(
        "SELECT count(*) AS n FROM follows WHERE follower_id = (SELECT id FROM users WHERE username = 'demo')",
      ),
    ).toBe(100);
  }, 180_000);
});
