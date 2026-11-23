import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { signUpViaUi } from './support/auth';
import { rect, VIEWPORTS } from './support/measure';
import { clearRateLimits } from './support/db';
import { ownIpLastOctet, startInFreshWindow, waitUntilSecondOfMinute } from './support/rate-window';

const submit = (page: Page) => page.getByRole('button', { name: 'ログイン', exact: true });

/**
 * A private IP for one test, so other specs sharing "local" do not count against it. Distinct per
 * test and per --repeat-each run (a random pick collided and shared one counter), and per minute;
 * the two tests draw from disjoint halves of the range.
 */
const ownIp = (testNo: 0 | 1) =>
  `198.51.100.${ownIpLastOctet(testNo, test.info().repeatEachIndex, Math.floor(Date.now() / 60_000))}`;

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
  test.setTimeout(60_000); // may wait up to 20 s for a fresh window
  const user = await registeredUser(page);
  const ip = ownIp(0);
  await page.context().setExtraHTTPHeaders({ 'cf-connecting-ip': ip });
  await page.goto('/accounts/login');
  await page.waitForLoadState('networkidle');
  await startInFreshWindow(60, 20);
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

test('窓の終わりの直前に始めても 6 回目で操作が多すぎますと表示される', async ({ page }) => {
  test.setTimeout(120_000); // waits up to a minute for the second of the minute
  const user = await registeredUser(page);
  const ip = ownIp(1);
  await page.context().setExtraHTTPHeaders({ 'cf-connecting-ip': ip });
  await page.goto('/accounts/login');
  await page.waitForLoadState('networkidle');
  await waitUntilSecondOfMinute(57);
  // A slow network: each submission takes about 0.7 s more, so six of them last about 5 s and
  // always run over the window's end at second 60 (as in the failing CI run, 6.5 s).
  await page.route('**/accounts/login', async (route) => {
    if (route.request().method() === 'POST') await new Promise((r) => setTimeout(r, 700));
    await route.continue();
  });
  await startInFreshWindow(60, 20);
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
  for (const viewport of Object.values(VIEWPORTS)) {
    await page.setViewportSize(viewport);
    await page.goto('/accounts/login');
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
  await page.goto('/accounts/login');
  await page.waitForLoadState('networkidle');
  // The drawing on the left is hidden from the screen reader.
  await expect(page.locator('[data-auth="hero"]')).toHaveAttribute('aria-hidden', 'true');

  await page.getByRole('link', { name: '本文へ移動' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('メールアドレス')).toBeFocused();
  await page.keyboard.type(user.email);
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('パスワード')).toBeFocused();
  await page.keyboard.type(user.password);
  await page.keyboard.press('Tab');
  await expect(submit(page)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '新しいアカウントを作成' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
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
