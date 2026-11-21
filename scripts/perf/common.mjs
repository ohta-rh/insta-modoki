// Shared by the perf scripts: the app under test, a signed-in browser, and the result files (ADR-0046).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../..', import.meta.url));
export const RESULTS_DIR = join(root, 'perf-results');
export const DEMO_EMAIL = 'demo@seed.invalid';

export const baseUrl = () => `http://localhost:${process.env.PORT ?? 3100}`;

export function writeResult(name, data) {
  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(join(RESULTS_DIR, `${name}.json`), `${JSON.stringify(data, null, 2)}\n`);
}

async function reachable(url) {
  try {
    return (await fetch(url, { redirect: 'manual' })).status < 500;
  } catch {
    return false;
  }
}

/**
 * Uses the app already running on PORT; otherwise starts `pnpm start` (the production build) and
 * returns a function that stops it. The build must exist (`pnpm build`).
 */
export async function ensureServer() {
  const url = `${baseUrl()}/accounts/signup`;
  if (await reachable(url)) return async () => {};
  const child = spawn('pnpm', ['start', '--var', 'APP_ENV:local'], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, PORT: String(process.env.PORT ?? 3100) },
  });
  const stop = async () => {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  };
  for (let i = 0; i < 240; i += 1) {
    if (await reachable(url)) return stop;
    await new Promise((r) => setTimeout(r, 500));
  }
  await stop();
  throw new Error(`perf: アプリが ${baseUrl()} で起動しませんでした（pnpm build は済んでいますか）`);
}

/** The demo user's password: SEED_DEMO_PASSWORD, set when `seed:bench` was run (never kept in the repository). */
export function demoPassword() {
  const p = process.env.SEED_DEMO_PASSWORD;
  if (!p) throw new Error('perf: SEED_DEMO_PASSWORD が未設定です（seed:bench に渡したものと同じ値）');
  return p;
}

/** Logs in as the demo user through the real screen on `page`. */
export async function loginAsDemo(page) {
  await page.goto(`${baseUrl()}/accounts/login`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('メールアドレス').fill(DEMO_EMAIL);
  await page.getByLabel('パスワード').fill(demoPassword());
  await page.getByRole('button', { name: 'ログイン' }).click();
  await page.waitForURL((u) => u.pathname === '/');
}

/** Signs a fresh user up through the real screen (a private-range IP keeps the sign-up counter apart). */
export async function signUpFresh(page) {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const password = crypto.randomUUID();
  await page.context().setExtraHTTPHeaders({
    'cf-connecting-ip': `10.${randomInt(256)}.${randomInt(256)}.${1 + randomInt(254)}`,
  });
  await page.goto(`${baseUrl()}/accounts/signup`);
  await page.waitForLoadState('networkidle');
  await page.getByLabel('メールアドレス').fill(`perf_${id}@example.com`);
  await page.getByLabel('ユーザー名').fill(`perf_${id}`);
  await page.getByLabel('表示名').fill('性能の計測');
  await page.getByLabel('パスワード').fill(password);
  await page.getByRole('button', { name: 'サインアップ' }).click();
  await page.waitForURL((u) => u.pathname === '/');
  await page.context().setExtraHTTPHeaders({});
}

/** Runs `main` and sets the exit code; prints an unexpected error as a failure. */
export async function runMain(main) {
  try {
    process.exitCode = await main();
  } catch (error) {
    console.error(`perf: 失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
