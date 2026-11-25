import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, type Page } from '@playwright/test';
import { clearRateLimits } from './db';

export const DEMO_EMAIL = 'demo@seed.invalid';

let seeded: Promise<void> | undefined;

/** The demo password: `SEED_DEMO_PASSWORD` when set, else one made at runtime and kept in this process. */
export function demoPassword(): string {
  process.env.SEED_DEMO_PASSWORD ??= crypto.randomUUID().replaceAll('-', '').slice(0, 16);
  return process.env.SEED_DEMO_PASSWORD;
}

/** Runs `seed:demo` against the slot once per process, with the demo password set. */
export function ensureDemoSeed(): Promise<void> {
  seeded ??= promisify(execFile)('node', ['scripts/seed/index.ts', '--profile', 'demo'], {
    cwd: process.cwd(),
    env: { ...process.env, SEED_DEMO_PASSWORD: demoPassword() },
  }).then(({ stdout }) => {
    if (!/^seed: demo OK /m.test(stdout))
      throw new Error(`seed:demo が完了しませんでした: ${stdout}`);
  });
  return seeded;
}

/** Fills and submits the login screen as the demo account; `/` follows when the password is right. */
export async function loginAsDemo(page: Page, password: string = demoPassword()): Promise<void> {
  clearRateLimits();
  await page.goto('/accounts/login');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('メールアドレス').fill(DEMO_EMAIL);
  await page.getByLabel('パスワード').fill(password);
  await page.getByRole('button', { name: 'ログイン' }).click();
  await expect(page.getByRole('main')).toBeVisible();
}
