import { beforeAll, describe, expect, it } from 'vitest';
import { countQueries } from '../../../../tests/helpers/count-queries';
import { useTestDb } from '../../../../tests/helpers/db';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import type { StorageEnv } from '../../../shared/storage';
import { getFeed } from './get-feed';

const t = useTestDb();

let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const USERS = 1000;
const POSTS = 10_000;
const FOLLOWING = 50;
const CALLS = 100;
const BUDGET_MS = 300; // docs: feed API p95 (企画書 10 ページ「07 非機能要件」)

/** 1,000 users, 10,000 posts (one photo each), each user following the next 50 (ring). */
async function seedScale() {
  const run = (sql: string) => t.d1.prepare(sql.replace(/\s+/g, ' ')).run();
  const rows = (n: number) =>
    `WITH RECURSIVE n(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM n WHERE i < ${n - 1})`;
  await run(`INSERT INTO users (id, username, display_name, email, created_at, updated_at)
    ${rows(USERS)} SELECT 'perf-u' || i, 'perf_' || i, 'Perf ' || i, 'perf_' || i || '@example.com', 0, 0 FROM n`);
  await run(`INSERT INTO posts (id, author_id, caption, created_at)
    ${rows(POSTS)} SELECT printf('perf-p%05d', i), 'perf-u' || (i % ${USERS}), '', 1760000000000 + i * 1000 FROM n`);
  await run(`INSERT INTO media (id, post_id, position, type, storage_key, width, height, alt_text, thumbhash)
    ${rows(POSTS)} SELECT 'perf-m' || i, printf('perf-p%05d', i), 0, 'image', 'media/perf/' || i, 1200, 800, '', 'x' FROM n`);
  await run(`INSERT INTO follows (follower_id, followee_id, created_at)
    ${rows(USERS * FOLLOWING)} SELECT 'perf-u' || (i / ${FOLLOWING}), 'perf-u' || (((i / ${FOLLOWING}) + (i % ${FOLLOWING}) + 1) % ${USERS}), 0 FROM n`);
}

describe('getFeed', () => {
  it('1,000 人・10,000 件で p95 が 300ms 以内', { timeout: 120_000 }, async () => {
    await seedScale();
    const env = { ...testAuthEnv(t.d1), ...storage };
    const headers = await Promise.all(
      Array.from({ length: CALLS }, (_, i) =>
        sessionHeadersFor(t.db, env, { id: `perf-u${i * 7}` }),
      ),
    );
    const ms: number[] = [];
    for (const h of headers) {
      const start = performance.now();
      const page = await getFeed({}, { env, headers: h });
      ms.push(performance.now() - start);
      expect(page.items).toHaveLength(12);
    }
    ms.sort((a, b) => a - b);
    const p95 = ms[Math.ceil(CALLS * 0.95) - 1]!;
    expect(p95, `p95 ${p95.toFixed(1)}ms`).toBeLessThanOrEqual(BUDGET_MS);
  });

  it('大きなデータでも 12 件のページと 1 件のページで問い合わせの回数が同じ', async () => {
    await seedScale();
    const env = { ...testAuthEnv(t.d1), ...storage };
    const full = countQueries(t.d1);
    const fullPage = await getFeed(
      {},
      {
        env: { ...env, DB: full.d1 as never },
        headers: await sessionHeadersFor(t.db, env, { id: 'perf-u3' }),
      },
    );
    expect(fullPage.items).toHaveLength(12);
    // The last page of a ring user holds fewer posts: ask with the cursor of the 12th item's page end.
    let cursor = fullPage.nextCursor;
    let lastCount = full.count();
    let last = fullPage;
    while (cursor) {
      const c = countQueries(t.d1);
      last = await getFeed(
        { cursor },
        {
          env: { ...env, DB: c.d1 as never },
          headers: await sessionHeadersFor(t.db, env, { id: 'perf-u3' }),
        },
      );
      lastCount = c.count();
      cursor = last.nextCursor;
    }
    expect(last.items.length).toBeLessThan(12);
    expect(last.items.length).toBeGreaterThan(0);
    expect(lastCount).toBe(full.count());
  });
});
