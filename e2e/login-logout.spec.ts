import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { signUpViaUi } from './support/auth';
import { clearRateLimits } from './support/db';

const submit = (page: Page) => page.getByRole('button', { name: 'ログイン' });

/** Signs a user up, then drops the session so the user is registered but signed out. */
async function registeredUser(page: Page) {
  const user = await signUpViaUi(page);
  await page.context().clearCookies();
  clearRateLimits();
  return user;
}

test('ログインしてからログアウトすると 保護された画面に入れない', async ({ page }) => {
  const user = await registeredUser(page);
  await page.goto('/accounts/login');
  await page.waitForLoadState('networkidle');
  await page.getByLabel('メールアドレス').fill(user.email);
  await page.getByLabel('パスワード').fill(user.password);
  await submit(page).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/accounts/logout');
  await expect(page.getByRole('heading', { name: 'ログアウトしますか？' })).toBeVisible();
  await page.getByRole('button', { name: 'ログアウト' }).click();
  await expect(page).toHaveURL(/\/accounts\/login$/);

  for (const path of ['/', '/create']) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/accounts\/login$/);
  }
  await page.goBack();
  await page.goBack();
  await page.goto('/create');
  await expect(page).toHaveURL(/\/accounts\/login$/);
});

test('1 分に 6 回続けて間違えると 操作が多すぎますと表示される', async ({ page }) => {
  const user = await registeredUser(page);
  // A private IP for this test, so other specs sharing "local" do not count against it.
  const ip = `198.51.100.${1 + Math.floor(Math.random() * 200)}`;
  await page.context().setExtraHTTPHeaders({ 'cf-connecting-ip': ip });
  await page.goto('/accounts/login');
  await page.waitForLoadState('networkidle');
  const wrong = 'メールアドレスまたはパスワードが違います';
  for (let i = 1; i <= 5; i += 1) {
    await page.getByLabel('メールアドレス').fill(user.email);
    await page.getByLabel('パスワード').fill(`wrong-${i}`);
    await submit(page).click();
    await expect(page.getByRole('alert').filter({ hasText: wrong })).toBeVisible();
    await expect(page.getByLabel('メールアドレス')).toHaveValue(user.email);
    await expect(page.getByLabel('パスワード')).toHaveValue('');
    await expect(submit(page)).toBeEnabled();
  }
  await page.getByLabel('メールアドレス').fill(user.email);
  await page.getByLabel('パスワード').fill('wrong-6');
  await submit(page).click();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: '操作が多すぎます。しばらくしてからもう一度お試しください' }),
  ).toBeVisible();
});

test('ログイン済みでログイン画面を開くとホームに移る', async ({ page }) => {
  await signUpViaUi(page);
  await page.goto('/accounts/login');
  await expect(page).toHaveURL(/\/$/);
});

test('キーボードだけでログインでき axe の重大な違反が無い', async ({ page }) => {
  const user = await registeredUser(page);
  await page.goto('/accounts/login');
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious'),
  ).toEqual([]);

  await page.getByRole('link', { name: '本文へ移動' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('メールアドレス')).toBeFocused();
  await page.keyboard.type(user.email);
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('パスワード')).toBeFocused();
  await page.keyboard.type(user.password);
  await page.keyboard.press('Tab');
  await expect(submit(page)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/$/);

  await page.goto('/accounts/logout');
  await page.waitForLoadState('networkidle');
  const logoutAxe = await new AxeBuilder({ page }).analyze();
  expect(
    logoutAxe.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious'),
  ).toEqual([]);
  await page.getByRole('button', { name: 'ログアウト' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/accounts\/login$/);
});
