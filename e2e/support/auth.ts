import { randomInt } from 'node:crypto';
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import { rateRows } from './db';

/** The origin the app under test listens on (`PORT`, 3100 by default). */
export const baseURL = () => `http://localhost:${process.env.PORT ?? 3100}`;

export type NewUser = { username: string; email: string; displayName: string; password: string };

/** A user no earlier run has used; the password is generated at runtime. */
export function newUser(): NewUser {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return {
    username: `e2e_${id}`,
    email: `e2e_${id}@example.com`,
    displayName: 'E2E 利用者',
    password: crypto.randomUUID(),
  };
}

export async function fillSignUp(page: Page, user: NewUser): Promise<void> {
  await page.getByLabel('メールアドレス').fill(user.email);
  await page.getByLabel('ユーザー名').fill(user.username);
  await page.getByLabel('表示名').fill(user.displayName);
  await page.getByLabel('パスワード').fill(user.password);
}

/** Signs a new user up through the real screen; the page ends on `/` signed in. */
export async function signUpViaUi(page: Page, user: NewUser = newUser()): Promise<NewUser> {
  // Locally every request has the IP "local", so parallel workers would share one `signup:ip:local`
  // counter (10 an hour) and a sign-up could be refused with "操作が多すぎます". A private-range IP of
  // its own per sign-up keeps each worker's counter separate (the production limit is unchanged), so
  // no rows are deleted here: a DELETE from this process while the app upserts `rate_limits` made the
  // app fail with SQLITE_BUSY_SNAPSHOT ("database is locked") and the sign-up with a 500.
  await page.context().setExtraHTTPHeaders({
    'cf-connecting-ip': `10.${randomInt(256)}.${randomInt(256)}.${1 + randomInt(254)}`,
  });
  await page.goto('/accounts/signup');
  await fillSignUp(page, user);
  await page.getByRole('button', { name: 'サインアップ' }).click();
  try {
    await expect(page).toHaveURL(/\/$/);
  } catch (error) {
    // Say what the screen showed and the counter state, so a flake leaves its own evidence.
    const shown = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400);
    throw new Error(
      `sign-up stayed on ${page.url()}: ${shown} | signup:ip:local=${JSON.stringify(rateRows('signup:ip:local'))}`,
      { cause: error },
    );
  } finally {
    // Only the sign-up carries the header: later requests to other origins (the storage PUTs) must
    // not, or the browser would need a CORS preflight for it.
    await page.context().setExtraHTTPHeaders({});
  }
  return user;
}

/** `test` whose `page` is already signed in, for specs of screens that need a session. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await signUpViaUi(page);
    await use(page);
  },
});
/**
 * `page` signed in. One user signs up per worker and every test of the worker reuses that session
 * (each sign-up is a burst of writes to the shared D1 file). `account.me` is that user.
 */
export const signedIn = base.extend<
  object,
  {
    account: { state: Awaited<ReturnType<BrowserContext['storageState']>>; me: NewUser };
  }
>({
  account: [
    async ({ browser }, use) => {
      const context = await browser.newContext({ baseURL: baseURL() });
      const me = await signUpViaUi(await context.newPage());
      const state = await context.storageState();
      await context.close();
      await use({ state, me });
    },
    { scope: 'worker' },
  ],
  storageState: async ({ account }, use) => {
    await use(account.state);
  },
});
export { expect };
