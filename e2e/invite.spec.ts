import { expect, test, type Page } from '@playwright/test';
import { inviteOnlyHeaders, makeAdmin, seedInvite } from './support/admin';
import { fillSignUp, newUser, signUpViaUi, type NewUser } from './support/auth';
import { expectNoSeriousViolations } from './support/axe';
import { clearRateLimits } from './support/db';
import { waitForHydration } from './support/hydration';

const INVITE_LABEL = '招待コード';
const USED_UP = 'この招待コードは使用回数の上限に達しました';

/** Opens the sign-up screen as an invite-only environment and signs `user` up with `code`. */
async function signUpWithCode(page: Page, user: NewUser, code: string): Promise<void> {
  await page.context().setExtraHTTPHeaders(inviteOnlyHeaders());
  await page.goto('/accounts/signup');
  await fillSignUp(page, user);
  await page.getByLabel(INVITE_LABEL).fill(code);
  await page.getByRole('button', { name: 'サインアップ' }).click();
}

async function adminPage(page: Page): Promise<NewUser> {
  const admin = await signUpViaUi(page);
  makeAdmin(admin.username);
  return admin;
}

test.beforeEach(() => clearRateLimits());

test('管理者がコードを発行・コピー・失効でき、一般の利用者は開けない', async ({
  page,
  context,
  browser,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await adminPage(page);
  await page.goto('/admin/invites');
  await waitForHydration(page);
  await expect(page.getByRole('heading', { name: '招待コードの管理', level: 1 })).toBeVisible();

  const rows = page.getByRole('listitem');
  const before = await rows.count();
  await page.getByLabel('使用回数').fill('3');
  await page.getByLabel('有効日数').fill('2');
  await page.getByRole('button', { name: '発行' }).click();
  await expect(rows).toHaveCount(before + 1);
  const first = rows.first();
  const code = (await first.locator('code').innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{10}$/);
  await expect(first).toContainText('有効');
  await expect(first).toContainText('使用 0 / 3 回');

  await first.getByRole('button', { name: 'コードをコピー' }).click();
  await expect(page.getByRole('status')).toContainText(`コード ${code} をコピーしました`);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);

  await first.getByRole('button', { name: '失効' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '失効する' }).click();
  await expect(dialog).toBeHidden();
  await expect(first).toContainText('無効');
  await expect(first.getByRole('button', { name: '失効' })).toHaveCount(0);

  // The state is the database's: a reload shows the same.
  await page.reload();
  // Other specs seed codes in parallel, so the row is found by its code, not by its place.
  await expect(page.getByRole('listitem').filter({ hasText: code })).toContainText('無効');

  // A signed-in user who is not an administrator gets the 404 page.
  const member = await browser.newContext();
  const memberPage = await member.newPage();
  await signUpViaUi(memberPage);
  const response = await memberPage.goto('/admin/invites');
  expect(response?.status()).toBe(404);
  await expect(memberPage.getByRole('heading', { name: 'ページが見つかりません' })).toBeVisible();
  await member.close();
});

test('有効なコードで登録でき、使い切ったコードは欄の下に理由が出る', async ({ page, browser }) => {
  const code = seedInvite({ maxUses: 1 });

  // The first sign-up types the code in lower case with spaces around it: the same code.
  await signUpWithCode(page, newUser(), ` ${code.toLowerCase()} `);
  await expect(page).toHaveURL(/\/$/);

  const second = await browser.newContext({ baseURL: page.url().replace(/\/$/, '') });
  const other = await second.newPage();
  await signUpWithCode(other, newUser(), code);
  const field = other.getByLabel(INVITE_LABEL);
  await expect(other.getByText(USED_UP)).toBeVisible();
  await expect(other).toHaveURL(/\/accounts\/signup$/);
  await expect(field).toBeFocused();
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  const describedBy = await field.getAttribute('aria-describedby');
  expect(describedBy).toBeTruthy();
  const message = other.locator(`#${describedBy}`);
  await expect(message).toHaveText(USED_UP);
  await expect(message).toHaveAttribute('role', 'alert');
  // The message sits below the field.
  const fieldBox = (await field.boundingBox())!;
  const messageBox = (await message.boundingBox())!;
  expect(messageBox.y).toBeGreaterThan(fieldBox.y + fieldBox.height - 1);
  await second.close();
});

test('不明・失効・期限切れのコードと未入力は、それぞれの理由が欄の下に出る', async ({ page }) => {
  const revoked = seedInvite({ revokedAt: Date.now() - 1000 });
  const expired = seedInvite({ expiresAt: Date.now() - 1000 });
  await page.context().setExtraHTTPHeaders(inviteOnlyHeaders());
  await page.goto('/accounts/signup');
  const field = page.getByLabel(INVITE_LABEL);
  const cases: [string, string][] = [
    ['', '招待コードを入力してください'],
    ['ZZZZZZZZZZ', '招待コードが正しくありません'],
    [revoked, 'この招待コードは無効になりました'],
    [expired, 'この招待コードは期限が切れています'],
  ];
  for (const [value, message] of cases) {
    await fillSignUp(page, newUser());
    await field.fill(value);
    await page.getByRole('button', { name: 'サインアップ' }).click();
    await expect(page.getByRole('alert').filter({ hasText: message })).toBeVisible();
    await expect(field).toBeFocused();
  }
  await expect(page).toHaveURL(/\/accounts\/signup$/);
});

test('招待コードが必須でない環境では、サインアップに招待コードの欄が出ない', async ({ page }) => {
  await page.goto('/accounts/signup');
  await expect(page.getByLabel('メールアドレス')).toBeVisible();
  await expect(page.getByLabel(INVITE_LABEL)).toHaveCount(0);
});

test('招待コードの欄と管理画面で axe の重大な違反が 0 件', async ({ page, browser }) => {
  // The sign-up screen with the field, then with its error shown.
  const spent = seedInvite({ maxUses: 1, usedCount: 1 });
  await page.context().setExtraHTTPHeaders(inviteOnlyHeaders());
  await page.goto('/accounts/signup');
  await waitForHydration(page);
  const field = page.getByLabel(INVITE_LABEL);
  await expect(field).toBeVisible();
  await expectNoSeriousViolations(page, '招待コードの欄');
  await fillSignUp(page, newUser());
  await field.fill(spent);
  await page.getByRole('button', { name: 'サインアップ' }).click();
  await expect(page.getByRole('alert').filter({ hasText: USED_UP })).toBeVisible();
  await expectNoSeriousViolations(page, '招待コードの欄（エラー）');

  // The admin screen, then with the revoke dialog open; every button has a name.
  const admin = await browser.newContext();
  const adminTab = await admin.newPage();
  await adminPage(adminTab);
  await adminTab.goto('/admin/invites');
  await waitForHydration(adminTab);
  await adminTab.getByRole('button', { name: '発行' }).click();
  await expect(adminTab.getByRole('listitem').first()).toBeVisible();
  for (const button of await adminTab.getByRole('button').all()) {
    expect(
      ((await button.getAttribute('aria-label')) ?? (await button.innerText())).trim(),
    ).not.toBe('');
  }
  await expectNoSeriousViolations(adminTab, '招待コードの管理');
  await adminTab.getByRole('listitem').first().getByRole('button', { name: '失効' }).click();
  await expect(adminTab.getByRole('alertdialog')).toBeVisible();
  await expectNoSeriousViolations(adminTab, '招待コードの管理（確認の dialog）');
  await admin.close();
});
