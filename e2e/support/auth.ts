import { test as base, expect, type Page } from '@playwright/test';
import { clearRateLimits } from './db';

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
  clearRateLimits();
  await page.goto('/accounts/signup');
  await fillSignUp(page, user);
  await page.getByRole('button', { name: 'サインアップ' }).click();
  await expect(page).toHaveURL(/\/$/);
  return user;
}

/** `test` whose `page` is already signed in, for specs of screens that need a session. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await signUpViaUi(page);
    await use(page);
  },
});
export { expect };
