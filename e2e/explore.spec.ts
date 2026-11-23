import { expect, test as anonymous, type Locator, type Page } from '@playwright/test';
import { signedIn } from './support/auth';
import { expectNoSeriousViolations } from './support/axe';
import { seedFollow, seedUser, userRow } from './support/db';
import { harness } from './support/harness';
import { waitForHydration } from './support/hydration';
import { tabTo } from './support/keys';
import { insertPost } from './support/posts';

const unique = () => Math.random().toString(36).slice(2, 8);
const HOUR = 60 * 60 * 1000;

const grid = (page: Page) => page.getByTestId('post-grid');
const tiles = (page: Page) => grid(page).getByRole('link');
const moreButton = (page: Page) => page.getByRole('button', { name: 'さらに表示' });
const hrefsOf = (links: Locator) =>
  links.evaluateAll((els) => els.map((e) => e.getAttribute('href') as string));

/** A new person with a username of this run's own. */
function newPerson() {
  const username = `e2e_x${Date.now().toString(36)}${unique()}`;
  seedUser(username, `${username}@example.com`);
  return { username, id: userRow(username)!.id as string };
}

/** Makes `n` new users like the post (the app's own harness writes the rows and the counter). */
function seedLikers(postId: string, n: number): void {
  const stamp = `${Date.now().toString(36)}${unique()}`;
  harness({
    op: 'seedLikers',
    postId,
    likers: Array.from({ length: n }, (_, i) => ({
      username: `e2e_l${stamp}${i}`,
      email: `e2e_l${stamp}${i}@example.com`,
      likedAt: Date.now() - HOUR + i * 1000,
    })),
  });
}

/** `n` posts by a new author, a minute apart, ending an hour ago; returns their ids. */
function seedPosts(n: number, authorUsername = newPerson().username): string[] {
  const base = Date.now() - 2 * HOUR;
  return Array.from(
    { length: n },
    (_, i) => insertPost({ authorUsername, createdAt: base + i * 60_000 }).id,
  );
}

/** Presses "さらに表示" until there is none, waiting each time on the tile count or the button. */
async function readAll(page: Page): Promise<void> {
  const more = moreButton(page);
  for (;;) {
    await expect(grid(page)).toBeVisible();
    const before = await tiles(page).count();
    if ((await more.count()) === 0) return;
    await more.click();
    await expect
      .poll(async () => (await more.count()) === 0 || (await tiles(page).count()) > before)
      .toBe(true);
  }
}

anonymous('未ログインで発見タブを開くとログインへ移る', async ({ page }) => {
  await page.goto('/explore');
  await expect(page).toHaveURL(/\/accounts\/login/);
});

signedIn('発見タブにいいねの多い順のグリッドが出て、検索のリンクがある', async ({ page }) => {
  const author = newPerson();
  const at = Date.now() - 3 * HOUR;
  const low = insertPost({ authorUsername: author.username, createdAt: at });
  const mid = insertPost({ authorUsername: author.username, createdAt: at + 60_000 });
  const top = insertPost({
    authorUsername: author.username,
    createdAt: at + 120_000,
    mediaCount: 2,
  });
  seedLikers(low.id, 1);
  seedLikers(mid.id, 2);
  seedLikers(top.id, 3);
  // The slot holds other specs' posts too, so only these three are compared, among themselves.
  await page.goto('/explore');
  await waitForHydration(page);
  await readAll(page);

  await expect(page.getByRole('heading', { level: 1, name: '発見' })).toBeAttached();
  const search = page.getByRole('link', { name: 'ユーザーを検索' });
  await expect(search).toHaveAttribute('href', '/explore/search');
  const searchBox = (await search.boundingBox())!;
  expect(searchBox.y + searchBox.height).toBeLessThanOrEqual((await grid(page).boundingBox())!.y);

  const style = await grid(page).evaluate((el) => {
    const s = getComputedStyle(el);
    return { columns: s.gridTemplateColumns.split(' ').length, gap: s.columnGap, rowGap: s.rowGap };
  });
  expect(style).toEqual({ columns: 3, gap: '1px', rowGap: '1px' });
  const first = (await tiles(page).first().boundingBox())!;
  expect(Math.abs(first.width * (4 / 3) - first.height)).toBeLessThan(1);

  const mine = new Set([top.id, mid.id, low.id].map((id) => `/p/${id}`));
  const order = (await hrefsOf(tiles(page))).filter((h) => mine.has(h));
  expect(order).toEqual([`/p/${top.id}`, `/p/${mid.id}`, `/p/${low.id}`]);

  const topTile = tiles(page).and(page.locator(`a[href="/p/${top.id}"]`));
  await expect(topTile.getByRole('img', { name: '2 枚の写真' })).toBeVisible();
  const lowTile = page.locator(`a[href="/p/${low.id}"]`);
  await expect(lowTile.getByRole('img', { name: /枚の写真/ })).toHaveCount(0);
  await topTile.click();
  await expect(page).toHaveURL(new RegExp(`/p/${top.id}$`));
});

signedIn('自分とフォロー中の人の投稿は出ない', async ({ page, account }) => {
  const followed = newPerson();
  seedFollow(userRow(account.me.username)!.id as string, followed.id);
  const stranger = newPerson();
  const at = Date.now() - 24 * HOUR;
  const own = insertPost({ authorUsername: account.me.username, createdAt: at });
  const theirs = insertPost({ authorUsername: followed.username, createdAt: at });
  const other = insertPost({ authorUsername: stranger.username, createdAt: at });
  for (const post of [own, theirs, other]) seedLikers(post.id, 1);

  await page.goto('/explore');
  await waitForHydration(page);
  await readAll(page);
  const hrefs = await hrefsOf(tiles(page));
  // The stranger's post is on the list, so the other two are missing for a reason.
  expect(hrefs).toContain(`/p/${other.id}`);
  expect(hrefs).not.toContain(`/p/${own.id}`);
  expect(hrefs).not.toContain(`/p/${theirs.id}`);
});

signedIn('スクロールとキーボードの両方で続きを読み込む', async ({ page }) => {
  seedPosts(25);
  await page.goto('/explore');
  await waitForHydration(page);
  await expect(tiles(page)).toHaveCount(24);
  // Scroll: the marker below the last row comes into view and loads the next page.
  await page.getByTestId('grid-sentinel').scrollIntoViewIfNeeded();
  await expect.poll(() => tiles(page).count()).toBeGreaterThan(24);
  const hrefs = await hrefsOf(tiles(page));
  expect(new Set(hrefs).size).toBe(hrefs.length);

  // Keyboard: with no observer only the button can load more.
  const keyboardPage = await page.context().newPage();
  await keyboardPage.addInitScript(() => {
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  });
  await keyboardPage.goto('/explore');
  await waitForHydration(keyboardPage);
  await expect(tiles(keyboardPage)).toHaveCount(24);
  await tabTo(keyboardPage, moreButton(keyboardPage));
  await keyboardPage.keyboard.press('Enter');
  await expect.poll(() => tiles(keyboardPage).count()).toBeGreaterThan(24);
  const keyHrefs = await hrefsOf(tiles(keyboardPage));
  expect(new Set(keyHrefs).size).toBe(keyHrefs.length);
});

signedIn('取得が失敗したときの警告と再読み込み', async ({ page }) => {
  seedPosts(25);
  let blocked = false;
  await page.route(
    (url) => url.pathname === '/explore',
    async (route) => {
      // Only the Server Action (a POST that names its action) is held back.
      const isAction =
        route.request().method() === 'POST' && 'next-action' in route.request().headers();
      if (blocked && isAction) await route.abort();
      else await route.continue();
    },
  );
  await page.goto('/explore');
  await waitForHydration(page);
  await expect(tiles(page)).toHaveCount(24);

  blocked = true;
  await moreButton(page).click();
  // The route announcer is also an alert; this one carries the message.
  const alert = page.getByRole('alert').filter({ hasText: '読み込めませんでした' });
  await expect(alert).toContainText('読み込めませんでした');
  await expect(tiles(page)).toHaveCount(24);

  blocked = false;
  await alert.getByRole('button', { name: 'もう一度読み込む' }).click();
  await expect.poll(() => tiles(page).count()).toBeGreaterThan(24);
  await expect(alert).toHaveCount(0);
});

signedIn('キーボードだけで操作でき、axe の重大な違反が 0 件', async ({ page }) => {
  const author = newPerson();
  const at = Date.now() - 2 * HOUR;
  const withAlt = insertPost({ authorUsername: author.username, createdAt: at, altTexts: ['猫'] });
  for (let i = 1; i < 24; i++) {
    insertPost({ authorUsername: author.username, createdAt: at + i * 60_000 });
  }
  const multi = insertPost({
    authorUsername: author.username,
    createdAt: at + 24 * 60_000,
    mediaCount: 3,
  });
  // A like each keeps the two posts the checks below look for on the first pages.
  seedLikers(withAlt.id, 1);
  seedLikers(multi.id, 1);
  // Tabbing scrolls the marker into view and would load the next page by itself: with no observer
  // only the button can (the scroll path has its own scenario).
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[]) {
        if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  });
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/explore');
  await waitForHydration(page);
  await expect(tiles(page)).toHaveCount(24);

  const search = page.getByRole('link', { name: 'ユーザーを検索' });
  await tabTo(page, search);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/explore\/search$/);
  await page.goBack();
  await waitForHydration(page);
  await expect(tiles(page)).toHaveCount(24);
  await tabTo(page, search);

  for (let i = 0; i < 24; i++) await tabTo(page, tiles(page).nth(i));
  const more = moreButton(page);
  await tabTo(page, more);
  expect((await more.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Enter');
  await expect.poll(() => tiles(page).count()).toBeGreaterThan(24);
  const total = await tiles(page).count();
  expect(new Set(await hrefsOf(tiles(page))).size).toBe(total);

  // Every tile has a name: the photo's alt text, or its author and position when the alt is empty.
  for (let i = 0; i < total; i++) await expect(tiles(page).nth(i)).toHaveAccessibleName(/\S/);
  await expect(page.locator(`a[href="/p/${withAlt.id}"]`)).toHaveAccessibleName(/猫/);
  await expect(page.locator(`a[href="/p/${multi.id}"]`)).toHaveAccessibleName(
    new RegExp(`${author.username} が投稿した写真（1 / 3）.*3 枚の写真`),
  );

  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  expect(cls).toBeLessThanOrEqual(0.1);

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(tiles(page).first()).toBeVisible();
    for (const box of await tiles(page).evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().toJSON() as { width: number; height: number }),
    )) {
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await expectNoSeriousViolations(page, `/explore at ${width}px`);
  }
});
