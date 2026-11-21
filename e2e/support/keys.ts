import { expect, type Locator, type Page } from '@playwright/test';
import { newUser } from './auth';

/** Presses Tab until `target` has the focus (at most 120 presses); fails if the keyboard never gets there. */
export async function tabTo(page: Page, target: Locator): Promise<void> {
  for (let i = 0; i < 120; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

/** Types a new user into the sign-up form field by field, moving with Tab. */
export async function fillSignUpKeys(page: Page): Promise<void> {
  const user = newUser();
  for (const [label, value] of [
    ['メールアドレス', user.email],
    ['ユーザー名', user.username],
    ['表示名', user.displayName],
    ['パスワード', user.password],
  ] as const) {
    await tabTo(page, page.getByLabel(label));
    await page.keyboard.type(value);
  }
}
