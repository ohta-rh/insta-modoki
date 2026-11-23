import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { fillSignUp, newUser, signUpViaUi } from './support/auth';
import { clearRateLimits, seedUser, userRow } from './support/db';
import { rect, styles, VIEWPORTS } from './support/measure';

const submit = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'サインアップ' });

test('新しい利用者がサインアップすると ログイン済みでホームに移る', async ({ page }) => {
  const user = await signUpViaUi(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page
      .getByRole('navigation', { name: 'メイン' })
      .getByRole('link', { name: 'プロフィール' })
      .first(),
  ).toHaveAttribute('href', `/${user.username}`);
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name.endsWith('better-auth.session_token'));
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe('Lax');
  expect(userRow(user.username)).toBeDefined();

  await page.goto('/accounts/signup');
  await expect(page).toHaveURL(/\/$/);
});

test('使われているユーザー名を入力して離れると 送信前に重複が表示される', async ({ page }) => {
  const taken = newUser();
  seedUser(taken.username, taken.email);
  await page.goto('/accounts/signup');
  await page.waitForLoadState('networkidle');
  const username = page.getByLabel('ユーザー名');

  await username.fill(taken.username.toUpperCase());
  await username.blur();
  await expect(page.getByText('このユーザー名は使われています')).toBeVisible();
  await expect(submit(page)).toBeDisabled();

  await username.fill(`free_${taken.username}`.slice(0, 30));
  await username.blur();
  await expect(page.getByText('このユーザー名は使われています')).toHaveCount(0);
  await expect(submit(page)).toBeEnabled();
});

test('ログインしていない利用者が保護された画面を開くと ログイン画面に移る', async ({ page }) => {
  for (const path of ['/', '/create', '/accounts/edit']) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/accounts\/login$/);
  }
  for (const path of ['/p/abc', '/haru']) {
    await page.goto(path);
    await expect(page, path).toHaveURL(new RegExp(`${path}$`));
  }
});

test('入力が不正なとき 項目ごとの理由が表示され 入力が残る', async ({ page }) => {
  clearRateLimits();
  await page.goto('/accounts/signup');
  const bad = { email: 'not-an-email', username: '.abc', displayName: '', password: 'short' };
  await page.getByLabel('メールアドレス').fill(bad.email);
  await page.getByLabel('ユーザー名').fill(bad.username);
  await page.getByLabel('表示名').fill(bad.displayName);
  await page.getByLabel('パスワード').fill(bad.password);
  await submit(page).click();

  await expect(page.getByRole('alert').filter({ hasText: '入力を確認してください' })).toBeVisible();
  const expected: Record<string, string> = {
    メールアドレス: 'メールアドレスの形式を確認してください',
    ユーザー名: 'ユーザー名は英小文字・数字・.・_ だけ使えます（先頭と末尾は . 以外、.. は不可）',
    表示名: '表示名は 1〜30 字で入力してください',
    パスワード: 'パスワードは 8〜72 字で入力してください',
  };
  for (const [label, message] of Object.entries(expected)) {
    const field = page.getByLabel(label);
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    const describedBy = await field.getAttribute('aria-describedby');
    expect(describedBy, label).toBeTruthy();
    await expect(page.locator(`#${describedBy}`)).toHaveText(message);
    expect((await styles(page.locator(`#${describedBy}`), ['color']))['color'], label).toBe(
      'rgb(214, 45, 60)',
    );
  }
  await expect(page.getByLabel('メールアドレス')).toHaveValue(bad.email);
  await expect(page.getByLabel('ユーザー名')).toHaveValue(bad.username);
  await expect(page.getByLabel('パスワード')).toHaveValue('');

  // A CONFLICT is shown in the same place.
  const taken = newUser();
  seedUser(taken.username, taken.email);
  await fillSignUp(page, { ...newUser(), email: taken.email });
  await submit(page).click();
  const email = page.getByLabel('メールアドレス');
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator(`#${await email.getAttribute('aria-describedby')}`)).toHaveText(
    'このメールアドレスは登録済みです',
  );
});

test('キーボードだけでサインアップでき axe の重大な違反が無い', async ({ page }) => {
  clearRateLimits();
  for (const viewport of Object.values(VIEWPORTS)) {
    await page.setViewportSize(viewport);
    await page.goto('/accounts/signup');
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious'),
      `${viewport.width}px`,
    ).toEqual([]);
    for (const target of await page
      .locator('main a, main button, main input:not([type=hidden])')
      .all()) {
      const box = await rect(target);
      expect(
        box.width >= 44 && box.height >= 44,
        `${viewport.width}px 操作できる要素の大きさ: ${await target.evaluate((el) => el.outerHTML.slice(0, 120))} ${box.width}x${box.height}`,
      ).toBe(true);
    }
  }

  await page.setViewportSize(VIEWPORTS.wide);
  await page.goto('/accounts/signup');
  await page.waitForLoadState('networkidle');
  const user = newUser();
  await page.getByRole('link', { name: '本文へ移動' }).focus();
  // Back first, then the fields, the submit, and the button to the other screen.
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'ログイン画面に戻る' })).toBeFocused();
  await page.keyboard.press('Tab');
  const order = ['メールアドレス', 'ユーザー名', '表示名', 'パスワード'];
  const values = [user.email, user.username, user.displayName, user.password];
  for (const [i, label] of order.entries()) {
    await expect(page.getByLabel(label)).toBeFocused();
    await page.keyboard.type(values[i]!);
    await page.keyboard.press('Tab');
  }
  await expect(submit(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'アカウントをお持ちの場合' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/$/);
});
