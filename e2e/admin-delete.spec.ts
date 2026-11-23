import { expect, test, type Page } from '@playwright/test';
import { makeAdmin } from './support/admin';
import { signUpViaUi, type NewUser } from './support/auth';
import { expectNoSeriousViolations } from './support/axe';
import { clearRateLimits, postRows, seedUser, userRow } from './support/db';
import { waitForHydration } from './support/hydration';
import { insertPost } from './support/posts';

const NOT_FOUND = 'ページが見つかりません';

/** A user the specs delete: seeded directly, with one post that is the newest on the list. */
function seedVictim(): { username: string; postId: string } {
  const username = `del_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  seedUser(username, `${username}@example.com`);
  // An hour ahead: other specs insert posts at the same time, and the list shows 20 newest.
  const post = insertPost({
    authorUsername: username,
    caption: `削除される投稿 ${username}`,
    createdAt: Date.now() + 3_600_000,
  });
  return { username, postId: post.id };
}

async function signUpAdmin(page: Page): Promise<NewUser> {
  const admin = await signUpViaUi(page);
  makeAdmin(admin.username);
  return admin;
}

async function openAdmin(page: Page): Promise<void> {
  await page.goto('/admin');
  await waitForHydration(page);
  await expect(page.getByRole('heading', { name: '管理', level: 1 })).toBeVisible();
}

test.beforeEach(() => clearRateLimits());

test('管理者が投稿と利用者を確認つきで削除でき、取り消せる', async ({ page }) => {
  await signUpAdmin(page);
  const victim = seedVictim();
  await openAdmin(page);

  // A post: cancelling leaves it, confirming removes the row and the post page is gone.
  const postDelete = page.getByRole('button', { name: `@${victim.username} の投稿 を削除` });
  const dialog = page.getByRole('alertdialog');
  await expect(postDelete).toBeVisible();
  await postDelete.click();
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('この投稿を削除します。元に戻せません');
  await dialog.getByRole('button', { name: 'キャンセル' }).click();
  await expect(dialog).toBeHidden();
  await expect(postDelete).toBeVisible();
  expect(postRows(userRow(victim.username)!.id as string)).toHaveLength(1);

  await postDelete.click();
  await dialog.getByRole('button', { name: '削除する' }).click();
  await expect(postDelete).toHaveCount(0);
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status').first()).toContainText('を削除しました');
  expect(postRows(userRow(victim.username)!.id as string)).toHaveLength(0);
  const gone = await page.goto(`/p/${victim.postId}`);
  expect(gone!.status()).toBe(404);
  await expect(page.getByText(NOT_FOUND).first()).toBeVisible();

  // A user: found by its name, cancelled once, then deleted; the profile is gone.
  await openAdmin(page);
  await page.getByRole('tab', { name: '利用者' }).click();
  await page.getByLabel('ユーザー名で絞る').fill(victim.username);
  await page.getByRole('button', { name: '絞り込む' }).click();
  const userDelete = page.getByRole('button', { name: `@${victim.username} を削除` });
  await expect(userDelete).toBeVisible();
  await userDelete.click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'キャンセル' }).click();
  await expect(dialog).toBeHidden();
  await expect(userDelete).toBeVisible();
  expect(userRow(victim.username)).toBeDefined();

  await userDelete.click();
  await dialog.getByRole('button', { name: '削除する' }).click();
  await expect(userDelete).toHaveCount(0);
  expect(userRow(victim.username)).toBeUndefined();
  const profile = await page.goto(`/${victim.username}`);
  expect(profile!.status()).toBe(404);
  await expect(page.getByText(NOT_FOUND).first()).toBeVisible();
});

test('一般の利用者は /admin で「ページが見つかりません」、未ログインはログインへ移る', async ({
  page,
  browser,
}) => {
  await signUpViaUi(page);
  const response = await page.goto('/admin');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: NOT_FOUND })).toBeVisible();
  await expect(page.getByRole('tablist')).toHaveCount(0);

  const visitor = await browser.newContext();
  const visitorPage = await visitor.newPage();
  await visitorPage.goto('/admin');
  await expect(visitorPage).toHaveURL(/\/accounts\/login/);
  await visitor.close();
});

test('管理画面をキーボードで操作でき、axe の重大な違反が 0 件', async ({ page }) => {
  await signUpAdmin(page);
  const victim = seedVictim();
  await openAdmin(page);

  // Tabs: the tablist switches with the arrow keys; only the selected panel is shown.
  const postsTab = page.getByRole('tab', { name: '投稿' });
  const usersTab = page.getByRole('tab', { name: '利用者' });
  await expect(page.getByRole('tablist')).toBeVisible();
  await expect(postsTab).toHaveAttribute('aria-selected', 'true');
  await expectNoSeriousViolations(page, '/admin 投稿');
  await postsTab.focus();
  await page.keyboard.press('ArrowRight');
  await expect(usersTab).toHaveAttribute('aria-selected', 'true');
  await expect(usersTab).toBeFocused();
  await expectNoSeriousViolations(page, '/admin 利用者');
  await page.keyboard.press('ArrowLeft');
  await expect(postsTab).toHaveAttribute('aria-selected', 'true');

  // The delete button's name, the dialog opened with the keyboard, the focus trapped inside.
  const open = page.getByRole('button', { name: `@${victim.username} の投稿 を削除` });
  await open.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('alertdialog', {
    name: `@${victim.username} の投稿 を削除しますか？`,
  });
  await expect(dialog).toBeVisible();
  await expectNoSeriousViolations(page, '/admin 確認のダイアログ');
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);

  // Escape closes it, leaves the post and returns the focus to the button.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
  expect(postRows(userRow(victim.username)!.id as string)).toHaveLength(1);
});
