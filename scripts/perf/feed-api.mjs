// Feed API p95: time to the first byte of an authenticated `GET /` (the first page of getFeed is read
// while rendering it). The demo user follows 100 bench users (seed:bench). 20 warm-up requests, then 200 (ADR-0046).
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import {
  baseUrl,
  DEMO_EMAIL,
  demoPassword,
  ensureServer,
  runMain,
  writeResult,
} from './common.mjs';
import { p95 } from './stats.mjs';

export const WARMUP = 20;
export const REQUESTS = 200;

/** Logs in through the real screen and returns the Cookie header for the session. */
async function sessionCookie() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(`${baseUrl()}/accounts/login`);
    await page.waitForLoadState('networkidle');
    await page.getByLabel('メールアドレス').fill(DEMO_EMAIL);
    await page.getByLabel('パスワード').fill(demoPassword());
    await page.getByRole('button', { name: 'ログイン' }).click();
    await page.waitForURL((u) => u.pathname === '/');
    const cookies = await page.context().cookies(baseUrl());
    return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  } finally {
    await browser.close();
  }
}

/** Milliseconds from sending the request to the first byte of the body. */
export async function timeToFirstByte(cookie) {
  const start = performance.now();
  const response = await fetch(`${baseUrl()}/`, { headers: { cookie }, redirect: 'manual' });
  if (response.status !== 200)
    throw new Error(`GET / が ${response.status} を返しました（ログインが切れた可能性）`);
  const reader = response.body.getReader();
  await reader.read();
  const ms = performance.now() - start;
  await reader.cancel();
  return ms;
}

export async function measureFeedApi() {
  const cookie = await sessionCookie();
  for (let i = 0; i < WARMUP; i += 1) await timeToFirstByte(cookie);
  const samples = [];
  for (let i = 0; i < REQUESTS; i += 1) samples.push(await timeToFirstByte(cookie));
  const value = Math.round(p95(samples));
  return {
    measurements: [{ indicator: 'feedApiP95Ms', screen: 'GET /', value }],
    samples: samples.map((s) => Math.round(s * 10) / 10),
  };
}

export async function main() {
  const stop = await ensureServer();
  try {
    const result = await measureFeedApi();
    writeResult('feed-api', result);
    console.log(
      `feed-api: p95=${result.measurements[0].value}ms (n=${REQUESTS}, warm-up ${WARMUP})`,
    );
    return 0;
  } finally {
    await stop();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await runMain(main);
