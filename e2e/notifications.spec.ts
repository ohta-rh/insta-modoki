import { expect, test as base } from '@playwright/test';
import { baseURL, signedIn, signUpViaUi } from './support/auth';
import { expectNoSeriousViolations } from './support/axe';
import { seedUser, userRow, withDb } from './support/db';
import { harness } from './support/harness';
import { waitForHydration } from './support/hydration';
import { tabTo } from './support/keys';
import { insertPost, putPostFiles } from './support/posts';

const NAV = 'メイン';
// The link's name is its label and the badge's hidden text. Chrome puts a space between the two
// (they are separate blocks of the flex link), so the name is matched with optional white space.
const UNREAD_ONE = /^通知\s*（未読 1 件）$/;

signedIn(
  'いいねの通知がバッジに 10 秒以内に出て、一覧を開くと既読になる',
  async ({ page, browser, account }) => {
    // The badge waits for one 10 s poll, on top of two sign-ups and a like.
    signedIn.setTimeout(90_000);
    const post = insertPost({ authorUsername: account.me.username, caption: '通知の対象' });
    await putPostFiles(page, post);
    await page.goto('/');
    await waitForHydration(page);
    const nav = page.getByRole('navigation', { name: NAV }).first();
    await expect(nav.getByRole('link', { name: '通知', exact: true })).toBeVisible();

    // B signs up in a second browser context and likes A's post on the screen.
    // An empty storage state: a context made from `browser` otherwise inherits A's session.
    const context = await browser.newContext({
      baseURL: baseURL(),
      storageState: { cookies: [], origins: [] },
    });
    try {
      const other = await context.newPage();
      await signUpViaUi(other);
      await other.goto(`/p/${post.id}`);
      await waitForHydration(other);
      await other.getByRole('button', { name: 'いいね', exact: true }).click();
      await expect(other.getByRole('button', { name: '1 件のいいね', exact: true })).toBeVisible();
    } finally {
      await context.close();
    }

    // A did nothing: the name changes by itself within one polling interval (10 s) plus the call.
    await expect(nav.getByRole('link', { name: UNREAD_ONE })).toBeVisible({
      timeout: 15_000,
    });

    await nav.getByRole('link', { name: UNREAD_ONE }).click();
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.getByRole('heading', { level: 1, name: '通知' })).toBeVisible();
    const row = page.getByRole('link', { name: /さんがあなたの投稿にいいねしました/ });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('新着');
    await expect(row).toHaveAttribute('href', `/p/${post.id}`);
    // Opening the list marks everything read: the badge goes away, the row keeps its mark.
    await expect(nav.getByRole('link', { name: '通知', exact: true })).toBeVisible();
    await expect(row).toContainText('新着');
    const unreadRows = () =>
      withDb(
        (db) =>
          (
            db
              .prepare(
                'SELECT count(*) AS n FROM notifications WHERE read_at IS NULL AND recipient_id = (SELECT id FROM users WHERE username = ?)',
              )
              .get(account.me.username) as { n: number }
          ).n,
      );
    await expect.poll(unreadRows).toBe(0);

    await page.reload();
    await waitForHydration(page);
    await expect(
      page.getByRole('link', { name: /さんがあなたの投稿にいいねしました/ }),
    ).not.toContainText('新着');
  },
);

base('未ログインは通知の画面からログインへ移る', async ({ page }) => {
  await page.goto('/notifications');
  await expect(page).toHaveURL(/\/accounts\/login/);
  await expect(page.getByTestId('notification-badge')).toHaveCount(0);
});

signedIn('キーボードだけで通知を開け、axe の重大な違反が 0 件', async ({ page, account }) => {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const actor = `e2e_n${stamp}`;
  seedUser(actor, `${actor}@example.com`, { displayName: '通知の相手' });
  const actorId = userRow(actor)!.id as string;
  const meId = userRow(account.me.username)!.id as string;
  const post = insertPost({ authorUsername: account.me.username, caption: '写真' });
  await putPostFiles(page, post);
  const now = Date.now();
  harness({
    op: 'seedNotification',
    recipientId: meId,
    actorId,
    type: 'like',
    postId: post.id,
    createdAt: now - 60_000,
  });
  harness({
    op: 'seedNotification',
    recipientId: meId,
    actorId,
    type: 'follow',
    createdAt: now - 120_000,
  });

  await page.goto('/notifications');
  await waitForHydration(page);
  const list = page.getByRole('list', { name: '通知の一覧' });
  await expect(list.getByRole('link')).toHaveCount(2);

  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await expectNoSeriousViolations(page, `/notifications ${width}px`);
  }

  // Keyboard only: Tab reaches the row's link and Enter opens the post.
  await page.setViewportSize({ width: 1280, height: 800 });
  const like = list.getByRole('link', { name: /通知の相手さんがあなたの投稿にいいねしました/ });
  await tabTo(page, like);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/p/${post.id}`));

  await page.goBack();
  await waitForHydration(page);
  const follow = page
    .getByRole('list', { name: '通知の一覧' })
    .getByRole('link', { name: /通知の相手さんがあなたをフォローしました/ });
  await tabTo(page, follow);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/${actor}$`));
});
