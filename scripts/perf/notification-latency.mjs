// How long a like takes to reach the other person's badge (ADR-0050). Two browser contexts: A is
// signed in on `/`; B likes a post of A's on the screen; the time runs from B's click until A's
// navigation says "（未読 N 件）". 30 runs, one new post each. Prints `p95=<N>ms`; exit 1 over 5,000.
//
// Run it by hand against the slot's app started with the harness on:
//   PORT=310<N> pnpm start --var E2E_HARNESS:1 --var APP_ENV:local
//   PORT=310<N> node scripts/perf/notification-latency.mjs
import { randomInt } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { baseUrl, root, runMain, writeResult } from './common.mjs';
import { median, p95 } from './stats.mjs';

export const RUNS = 30;
export const LIMIT_MS = 5000;

async function signUp(browser) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const username = `lat_${id}`;
  const context = await browser.newContext({ baseURL: baseUrl() });
  const page = await context.newPage();
  // A private-range IP of its own keeps the sign-up counter apart.
  await context.setExtraHTTPHeaders({
    'cf-connecting-ip': `10.${randomInt(256)}.${randomInt(256)}.${1 + randomInt(254)}`,
  });
  await page.goto('/accounts/signup');
  await page.locator('html[data-hydrated="1"]').waitFor({ state: 'attached' });
  await page.getByLabel('メールアドレス').fill(`${username}@example.com`);
  await page.getByLabel('ユーザー名').fill(username);
  await page.getByLabel('表示名').fill('遅延の計測');
  await page.getByLabel('パスワード').fill(crypto.randomUUID());
  await page.getByRole('button', { name: 'サインアップ' }).click();
  await page.waitForURL((u) => u.pathname === '/');
  await context.setExtraHTTPHeaders({});
  return { context, page, username };
}

/** The user's id, read from the slot's D1 file (a read only; every write goes through the app). */
function userId(username) {
  const dir = join(root, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  const files = existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite')
    : [];
  if (files.length === 0) throw new Error('D1 のファイルがありません（slot.mjs prepare）');
  const file = files.sort(
    (a, b) => statSync(join(dir, b)).mtimeMs - statSync(join(dir, a)).mtimeMs,
  )[0];
  const db = new DatabaseSync(join(dir, file));
  try {
    db.exec('PRAGMA busy_timeout = 10000');
    return db.prepare('SELECT id FROM users WHERE username = ?').get(username)?.id;
  } finally {
    db.close();
  }
}

async function insertPostWithId(authorId, id) {
  const response = await fetch(`${baseUrl()}/e2e-harness/db`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      op: 'insertPost',
      id,
      authorId,
      caption: '遅延の計測',
      createdAt: Date.now() - 60_000,
      media: [
        {
          id: crypto.randomUUID(),
          position: 0,
          storageKey: `media/${authorId}/${crypto.randomUUID()}`,
          width: 1200,
          height: 800,
          altText: '',
          thumbhash: 'YJqGPQw7sFlslqhFafSE+Q6oJ1h2iHB2Rw==',
        },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(
      `ハーネスが ${response.status} を返しました（--var E2E_HARNESS:1 --var APP_ENV:local で起こしましたか）`,
    );
  }
}

export async function main() {
  const browser = await chromium.launch();
  try {
    const a = await signUp(browser);
    const b = await signUp(browser);
    await a.page.goto('/');
    await a.page.locator('html[data-hydrated="1"]').waitFor({ state: 'attached' });
    const authorId = userId(a.username);
    const samples = [];
    for (let n = 1; n <= RUNS; n += 1) {
      const postId = crypto.randomUUID();
      await insertPostWithId(authorId, postId);
      await b.page.goto(`/p/${postId}`);
      await b.page.locator('html[data-hydrated="1"]').waitFor({ state: 'attached' });
      const like = b.page.getByRole('button', { name: 'いいね', exact: true });
      const seen = a.page.waitForFunction(
        (label) => document.querySelector('nav[aria-label="メイン"]')?.textContent?.includes(label),
        `（未読 ${n} 件）`,
        { polling: 25, timeout: 20_000 },
      );
      const started = Date.now();
      await like.click();
      await seen;
      samples.push(Date.now() - started);
    }
    const result = {
      runs: RUNS,
      p95: p95(samples),
      median: median(samples),
      max: Math.max(...samples),
      samples,
    };
    console.log(`p95=${result.p95}ms median=${result.median}ms max=${result.max}ms runs=${RUNS}`);
    writeResult('notification-latency', result);
    return result.p95 > LIMIT_MS ? 1 : 0;
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await runMain(main);
