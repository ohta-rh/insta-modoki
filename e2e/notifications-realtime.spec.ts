import { expect, test as base, type Browser, type Page } from '@playwright/test';
import { baseURL, freshUser, signedIn, signUpViaUi, type NewUser } from './support/auth';
import { unreadNotificationCount } from './support/db';
import { waitForHydration } from './support/hydration';
import { insertPost, putPostFiles } from './support/posts';

const NAV = 'メイン';
/** A second signed-in person in a browser context of their own (an empty storage state). */
async function otherPerson(
  browser: Browser,
): Promise<{ page: Page; user: NewUser; close: () => Promise<void> }> {
  const context = await browser.newContext({
    baseURL: baseURL(),
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  const user = await signUpViaUi(page);
  return { page, user, close: () => context.close() };
}

async function like(page: Page, postId: string): Promise<void> {
  await page.goto(`/p/${postId}`);
  await waitForHydration(page);
  await page.getByRole('button', { name: 'いいね', exact: true }).click();
  await expect(page.getByRole('button', { name: '1 件のいいね', exact: true })).toBeVisible();
}

/**
 * Playwright's offline switch stops new requests only: a stream already open keeps delivering
 * (measured: the badge rose while offline). So the cut is made the way the app itself sees one: the
 * tab is hidden, which closes its connection; showing it opens a new one.
 */
const setTabHidden = (page: Page, hidden: boolean) =>
  page.evaluate((h) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);

const navOf = (page: Page) => page.getByRole('navigation', { name: NAV }).first();
const badgeLink = (page: Page, n: number) =>
  navOf(page).getByRole('link', { name: `通知（未読 ${n} 件）`, exact: true });

freshUser('いいねから 5 秒以内にバッジが増える', async ({ page, browser, me }) => {
  freshUser.setTimeout(90_000);
  const post = insertPost({ authorUsername: me.username, caption: '通知の対象' });
  await putPostFiles(page, post);
  await page.goto('/');
  await waitForHydration(page);
  await expect(navOf(page).getByRole('link', { name: '通知', exact: true })).toBeVisible();

  const b = await otherPerson(browser);
  try {
    await like(b.page, post.id);
    // A did nothing: the stream pushes the count (a check every 3 s, a reconnect after 1 s at worst).
    await expect.poll(() => badgeLink(page, 1).isVisible(), { timeout: 5_000 }).toBe(true);
  } finally {
    await b.close();
  }
});

signedIn('配信は接続から 1 秒以内に最初のイベントを流す', async ({ page }) => {
  await page.goto('/');
  await waitForHydration(page);
  const firstEventMs = await page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const started = performance.now();
        const source = new EventSource('/api/notifications/stream');
        source.addEventListener('unread', (e) => {
          source.close();
          resolve(
            /^\{"unreadCount":\d+\}$/.test((e as MessageEvent<string>).data)
              ? performance.now() - started
              : -1,
          );
        });
        source.onerror = () => {
          source.close();
          reject(new Error('stream failed'));
        };
      }),
  );
  expect(firstEventMs).toBeGreaterThanOrEqual(0);
  expect(firstEventMs).toBeLessThan(1_000);
});

freshUser(
  '切断中の通知を再接続後に取りこぼさず、二重に数えない',
  async ({ page, context, browser, me }) => {
    freshUser.setTimeout(90_000);
    const post = insertPost({ authorUsername: me.username, caption: '通知の対象' });
    await putPostFiles(page, post);
    const connected = page.waitForResponse((r) => r.url().includes('/api/notifications/stream'));
    await page.goto('/');
    await waitForHydration(page);
    await connected;
    await expect(navOf(page).getByRole('link', { name: '通知', exact: true })).toBeVisible();

    const b = await otherPerson(browser);
    try {
      await context.setOffline(true);
      await setTabHidden(page, true);
      await like(b.page, post.id);
      // Nothing can reach A while it is offline.
      await expect(navOf(page).getByRole('link', { name: '通知', exact: true })).toBeVisible();
      await context.setOffline(false);
      await setTabHidden(page, false);
      await expect.poll(() => badgeLink(page, 1).isVisible(), { timeout: 5_000 }).toBe(true);
      // The same number as the server's, and not counted twice.
      expect(await unreadNotificationCount(me.username)).toBe(1);
      await expect(badgeLink(page, 1)).toBeVisible();
      await expect(navOf(page).getByTestId('notification-badge')).toHaveText('1');
    } finally {
      await b.close();
    }
  },
);

freshUser('配信が使えなくてもポーリングでバッジが増える', async ({ page, browser, me }) => {
  freshUser.setTimeout(90_000);
  const post = insertPost({ authorUsername: me.username, caption: '通知の対象' });
  await putPostFiles(page, post);
  await page.route('**/api/notifications/stream', (route) => route.abort());
  await page.goto('/');
  await waitForHydration(page);
  await expect(navOf(page).getByRole('link', { name: '通知', exact: true })).toBeVisible();

  const b = await otherPerson(browser);
  try {
    await like(b.page, post.id);
    await expect.poll(() => badgeLink(page, 1).isVisible(), { timeout: 10_000 }).toBe(true);
  } finally {
    await b.close();
  }
});

freshUser('他人宛ての通知でバッジが変わらない', async ({ page, browser, me }) => {
  freshUser.setTimeout(120_000);
  const mine = insertPost({ authorUsername: me.username, caption: 'A の投稿' });
  await putPostFiles(page, mine);
  const connected = page.waitForResponse((r) => r.url().includes('/api/notifications/stream'));
  await page.goto('/');
  await waitForHydration(page);
  await connected;

  const b = await otherPerson(browser);
  const c = await otherPerson(browser);
  try {
    // C likes B's post: the notification is B's. A's connection must not carry it.
    const theirs = insertPost({ authorUsername: b.user.username, caption: 'B の投稿' });
    await putPostFiles(b.page, theirs);
    await like(c.page, theirs.id);
    await expect.poll(() => unreadNotificationCount(b.user.username)).toBe(1);
    await expect(navOf(page).getByRole('link', { name: '通知', exact: true })).toBeVisible();

    // Then B likes A's post: A's count is 1 (not 2), so B's own notification was never counted.
    await like(b.page, mine.id);
    await expect.poll(() => badgeLink(page, 1).isVisible(), { timeout: 5_000 }).toBe(true);
    expect(await unreadNotificationCount(me.username)).toBe(1);
    await expect(badgeLink(page, 1)).toBeVisible();
  } finally {
    await b.close();
    await c.close();
  }
});

base('未ログインの配信は 401 の JSON で、イベントの流れではない', async ({ request }) => {
  const response = await request.get(`${baseURL()}/api/notifications/stream?userId=x`);
  expect(response.status()).toBe(401);
  expect(response.headers()['content-type']).not.toContain('text/event-stream');
  expect(await response.json()).toEqual({
    code: 'UNAUTHENTICATED',
    message: 'ログインしてください',
  });
});
