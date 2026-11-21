import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test as base } from '@playwright/test';
import { signedIn } from './support/auth';
import { seedFollow, seedFollowers, seedUser, userRow, withDb } from './support/db';
import { holdScripts, waitForHydration } from './support/hydration';
import { tabTo } from './support/keys';

const followButton = (page: Page) =>
  page.getByRole('button', { name: /^(フォローする|フォロー中)$/ });
const countOf = (page: Page, label: string) =>
  page.getByRole('listitem').filter({ hasText: label });
/** The follow button's own message (Next.js keeps an empty alert region of its own on every page). */
const alert = (page: Page) => page.locator('p[role="alert"]');

/** A user nobody is signed in as. */
function newPerson(displayName = '相手') {
  const username = `e2e_f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  seedUser(username, `${username}@example.com`, { displayName });
  return { username, id: userRow(username)!.id as string };
}

const followRows = (followerUsername: string, followeeId: string) =>
  withDb(
    (db) =>
      (
        db
          .prepare(
            'SELECT count(*) AS n FROM follows WHERE followee_id = ? AND follower_id = (SELECT id FROM users WHERE username = ?)',
          )
          .get(followeeId, followerUsername) as { n: number }
      ).n,
  );

signedIn(
  '他人のプロフィールでフォローすると、ボタンが「フォロー中」になりフォロワー数が 1 増える',
  async ({ page, account }) => {
    const bob = newPerson();
    // Holds the Server Action's answer, to see the screen change before the server replies.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(
      (url) => url.pathname === `/${bob.username}`,
      async (route) => {
        if (route.request().method() === 'POST') await gate;
        await route.continue();
      },
    );
    await page.goto(`/${bob.username}`);
    await waitForHydration(page);

    await expect(followButton(page)).toHaveText('フォローする');
    await expect(followButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(countOf(page, 'フォロワー')).toHaveText('0 フォロワー');

    await followButton(page).click();
    // The server has not answered yet.
    await expect(followButton(page)).toHaveText('フォロー中');
    await expect(followButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(countOf(page, 'フォロワー')).toHaveText('1 フォロワー');
    expect(followRows(account.me.username, bob.id)).toBe(0);
    release();
    await expect.poll(() => followRows(account.me.username, bob.id)).toBe(1);

    await page.reload();
    await expect(followButton(page)).toHaveText('フォロー中');
    await expect(countOf(page, 'フォロワー')).toHaveText('1 フォロワー');

    await waitForHydration(page);
    await followButton(page).click();
    await expect(followButton(page)).toHaveText('フォローする');
    await expect(countOf(page, 'フォロワー')).toHaveText('0 フォロワー');
    await expect.poll(() => followRows(account.me.username, bob.id)).toBe(0);
    await page.reload();
    await expect(followButton(page)).toHaveText('フォローする');
    await expect(countOf(page, 'フォロワー')).toHaveText('0 フォロワー');
  },
);

signedIn(
  'JS が読み込まれる前でも ボタンを押してフォローでき 解除できる',
  async ({ page, account }) => {
    const bob = newPerson();
    const release = await holdScripts(page);
    await page.goto(`/${bob.username}`, { waitUntil: 'commit' });

    await followButton(page).waitFor();
    await followButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(followButton(page)).toHaveText('フォロー中');
    await expect(countOf(page, 'フォロワー')).toHaveText('1 フォロワー');
    expect(followRows(account.me.username, bob.id)).toBe(1);

    await followButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(followButton(page)).toHaveText('フォローする');
    await expect(countOf(page, 'フォロワー')).toHaveText('0 フォロワー');
    expect(followRows(account.me.username, bob.id)).toBe(0);
    release();
  },
);

signedIn('通信が失敗すると ボタンと数が元に戻りエラーを出す', async ({ page, account }) => {
  const bob = newPerson();
  await page.goto(`/${bob.username}`);
  await waitForHydration(page);
  await page.route(
    (url) => url.pathname === `/${bob.username}`,
    (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()),
  );
  await followButton(page).click();
  await expect(alert(page)).toHaveText(
    'エラーが発生しました。しばらくしてからもう一度お試しください',
  );
  await expect(followButton(page)).toHaveText('フォローする');
  await expect(followButton(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(countOf(page, 'フォロワー')).toHaveText('0 フォロワー');
  expect(followRows(account.me.username, bob.id)).toBe(0);
});

signedIn('ヘッダーの数値から一覧を開き、21 人目が追加読み込みで出る', async ({ page }) => {
  const bob = newPerson();
  const names = seedFollowers(bob.id, 21);
  await page.goto(`/${bob.username}`);
  await waitForHydration(page);

  await page.getByRole('link', { name: '21 フォロワー' }).click();
  await expect(page).toHaveURL(`/${bob.username}/followers`);
  await expect(page.getByRole('heading', { level: 1, name: 'フォロワー' })).toBeVisible();
  const rows = page.getByTestId('follow-list').getByRole('listitem');
  await expect(rows).toHaveCount(20);
  // Newest follow first: the last seeded user leads; the first seeded user is the 21st.
  await expect(rows.first()).toContainText(names[20]!);
  await expect(page.getByText(names[0]!)).toHaveCount(0);
  await expect(rows.first().getByRole('link')).toHaveAttribute('href', `/${names[20]!}`);

  // The end of the list scrolls into view and the next page is loaded.
  await rows.last().scrollIntoViewIfNeeded();
  await expect(rows).toHaveCount(21);
  await expect(rows.last()).toContainText(names[0]!);
});

signedIn('フォロー中の数値から一覧を開き、フォローした相手が並ぶ', async ({ page }) => {
  const bob = newPerson();
  const first = newPerson('一人目');
  const second = newPerson('二人目');
  seedFollow(bob.id, first.id);
  seedFollow(bob.id, second.id);
  await page.goto(`/${bob.username}`);

  await page.getByRole('link', { name: '2 フォロー中' }).click();
  await expect(page).toHaveURL(`/${bob.username}/following`);
  await expect(page.getByRole('heading', { level: 1, name: 'フォロー中' })).toBeVisible();
  const rows = page.getByTestId('follow-list').getByRole('listitem');
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: first.username })).toHaveCount(1);
  await expect(rows.filter({ hasText: second.username })).toHaveCount(1);
});

signedIn('0 件のとき空の案内を出す', async ({ page }) => {
  const bob = newPerson();
  await page.goto(`/${bob.username}/followers`);
  await expect(page.getByText('まだフォロワーはいません')).toBeVisible();
  await page.goto(`/${bob.username}/following`);
  await expect(page.getByText('まだ誰もフォローしていません')).toBeVisible();
});

signedIn('存在しない利用者の一覧は 404 になる', async ({ page }) => {
  const response = await page.goto('/nobody_such_user/followers');
  expect(response!.status()).toBe(404);
  const response2 = await page.goto('/nobody_such_user/following');
  expect(response2!.status()).toBe(404);
});

signedIn('自分のプロフィールにはフォローボタンが出ない', async ({ page, account }) => {
  await page.goto(`/${account.me.username}`);
  await expect(page.getByRole('link', { name: 'プロフィールを編集' })).toBeVisible();
  await expect(followButton(page)).toHaveCount(0);
});

base('未ログインでボタンを押すとログイン画面へ移る', async ({ page }) => {
  const bob = newPerson();
  await page.goto(`/${bob.username}`);
  await waitForHydration(page);
  const link = page.getByRole('link', { name: 'フォローする' });
  await expect(link).toHaveAttribute('href', '/accounts/login');
  await link.click();
  await expect(page).toHaveURL(/\/accounts\/login/);
  expect(
    withDb(
      (db) =>
        (
          db.prepare('SELECT count(*) AS n FROM follows WHERE followee_id = ?').get(bob.id) as {
            n: number;
          }
        ).n,
    ),
  ).toBe(0);
});

signedIn(
  'フォローボタンをキーボードで切り替えられ、axe の重大な違反が 0 件',
  async ({ page, account }) => {
    const bob = newPerson();
    seedFollowers(bob.id, 2);
    await page.goto(`/${bob.username}`);
    await waitForHydration(page);

    const serious = async () =>
      (await new AxeBuilder({ page }).analyze()).violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
    expect(await serious()).toEqual([]);

    const box = (await followButton(page).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    for (const label of ['フォロワー', 'フォロー中']) {
      const linkBox = (await page
        .getByRole('link', { name: new RegExp(label) })
        .first()
        .boundingBox())!;
      expect(linkBox.height).toBeGreaterThanOrEqual(44);
    }

    // Tab reaches the button; Enter and Space both switch it.
    await tabTo(page, followButton(page));
    await expect(followButton(page)).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Enter');
    await expect(followButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(followButton(page)).toBeFocused();
    await expect(followButton(page)).toHaveText('フォロー中');
    await expect.poll(() => followRows(account.me.username, bob.id)).toBe(1);
    await page.keyboard.press('Space');
    await expect(followButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => followRows(account.me.username, bob.id)).toBe(0);
    expect(await serious()).toEqual([]);

    await page.goto(`/${bob.username}/followers`);
    expect(await serious()).toEqual([]);
  },
);
