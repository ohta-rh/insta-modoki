import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { baseURL, signInViaHarness, type NewUser } from './support/auth';
import { seedFollow, seedUser, userRow, withDb } from './support/db';
import { expectNoSeriousViolations } from './support/axe';
import { harness } from './support/harness';
import { holdScripts, waitForHydration } from './support/hydration';
import { insertPost, putPostFiles, type InsertedPost } from './support/posts';
import { tabTo } from './support/keys';

/** `page` signed in as a new user (`me`), so every test starts with no saved posts. */
const signedIn = test.extend<{ me: NewUser }>({
  me: [
    async ({ page }, use) => {
      await use(await signInViaHarness(page));
    },
    { auto: true },
  ],
});

const saveButton = (page: Page) => page.getByRole('button', { name: '保存', exact: true });
/** The save button's own message (Next.js keeps an empty alert region of its own on every page). */
const alert = (page: Page) => page.locator('p[role="alert"]');
const savedGrid = (page: Page) => page.getByRole('region', { name: '保存済み' });
const tiles = (page: Page) => savedGrid(page).locator('a[href^="/p/"]');
const dialog = (page: Page) => page.getByRole('dialog', { name: '投稿', exact: true });

const unique = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** A user nobody is signed in as, with `n` posts (caption `保存 <i>`) one minute apart. */
function author(n: number, options: { follower?: NewUser } = {}) {
  const username = `e2e_s${unique()}`;
  seedUser(username, `${username}@example.com`);
  if (options.follower) {
    seedFollow(userRow(options.follower.username)!.id as string, userRow(username)!.id as string);
  }
  const start = Date.now() - 24 * 3_600_000;
  const posts = Array.from({ length: n }, (_, i) =>
    insertPost({
      authorUsername: username,
      caption: `保存 ${i}`,
      createdAt: start + i * 60_000,
      altTexts: [`保存 ${i} の写真`],
    }),
  );
  return { username, posts };
}

/** `posts` saved by `me`, the i-th one minute after the one before (the last is the newest). */
function saveFor(me: NewUser, posts: InsertedPost[]): void {
  const start = Date.now() - 3_600_000;
  harness({
    op: 'insertBookmarks',
    userId: userRow(me.username)!.id as string,
    items: posts.map((p, i) => ({ postId: p.id, savedAt: start + i * 60_000 })),
  });
}

const bookmarkRows = (postId: string) =>
  withDb(
    (db) =>
      (
        db.prepare('SELECT count(*) AS n FROM bookmarks WHERE post_id = ?').get(postId) as {
          n: number;
        }
      ).n,
  );

signedIn(
  'フィードと投稿詳細で保存を押すと即座に反映され、再読み込みしても残る',
  async ({ page, me }) => {
    const a = author(1, { follower: me });
    const post = a.posts[0]!;
    await putPostFiles(page, post);

    // Holds the Server Action's answer, to see the screen change before the server replies.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(
      (url) => url.pathname === '/',
      async (route) => {
        // The unread badge polls with a POST whose body is `[]`; only the save action is held.
        const request = route.request();
        if (request.method() === 'POST' && request.postData() !== '[]') await gate;
        await route.continue();
      },
    );
    await page.goto('/');
    await waitForHydration(page);
    await expect(saveButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(saveButton(page).locator('svg')).toHaveAttribute('fill', 'none');

    await saveButton(page).click();
    // The server has not answered yet.
    await expect(saveButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(saveButton(page).locator('svg')).toHaveAttribute('fill', 'currentColor');
    expect(bookmarkRows(post.id)).toBe(0);
    release();
    await expect.poll(() => bookmarkRows(post.id)).toBe(1);

    await page.reload();
    await expect(saveButton(page)).toHaveAttribute('aria-pressed', 'true');
    await waitForHydration(page);
    await saveButton(page).click();
    await expect(saveButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => bookmarkRows(post.id)).toBe(0);
    await page.unroute((url) => url.pathname === '/');

    // The post's own screen.
    await page.goto(`/p/${post.id}`);
    await waitForHydration(page);
    await expect(saveButton(page)).toHaveAttribute('aria-pressed', 'false');
    await saveButton(page).click();
    await expect(saveButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => bookmarkRows(post.id)).toBe(1);
    await page.reload();
    await expect(saveButton(page)).toHaveAttribute('aria-pressed', 'true');
    await waitForHydration(page);
    await saveButton(page).click();
    await expect(saveButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => bookmarkRows(post.id)).toBe(0);
    await page.reload();
    await expect(saveButton(page)).toHaveAttribute('aria-pressed', 'false');
  },
);

signedIn('保存に失敗したときだけ元に戻り、理由が出る', async ({ page }) => {
  // The post is deleted after the page was opened: the server answers NOT_FOUND with its message.
  const gone = author(1).posts[0]!;
  await page.goto(`/p/${gone.id}`);
  await waitForHydration(page);
  harness({ op: 'deletePost', postId: gone.id });
  await saveButton(page).click();
  await expect(alert(page)).toHaveText('ページが見つかりません');
  await expect(saveButton(page)).toHaveAttribute('aria-pressed', 'false');
  expect(bookmarkRows(gone.id)).toBe(0);

  // The connection fails: the same, with the fixed message.
  const lost = author(1).posts[0]!;
  await page.goto(`/p/${lost.id}`);
  await waitForHydration(page);
  await page.route(
    (url) => url.pathname === `/p/${lost.id}`,
    (route) =>
      route.request().method() === 'POST' && route.request().postData() !== '[]'
        ? route.abort()
        : route.continue(),
  );
  await saveButton(page).click();
  await expect(alert(page)).toHaveText(
    'エラーが発生しました。しばらくしてからもう一度お試しください',
  );
  await expect(saveButton(page)).toHaveAttribute('aria-pressed', 'false');
  expect(bookmarkRows(lost.id)).toBe(0);
});

test('未ログインはログインへ移り、JS が読み込まれる前でも保存できる', async ({ page, browser }) => {
  const post = author(1).posts[0]!;
  // A visitor, after hydration: the action answers UNAUTHENTICATED and the page goes to login.
  await page.goto(`/p/${post.id}`);
  await waitForHydration(page);
  await saveButton(page).click();
  await expect(page).toHaveURL(/\/accounts\/login/);

  // A visitor before hydration: the form post redirects to the login page.
  const early = await browser.newContext({ baseURL: baseURL() });
  const visitor = await early.newPage();
  const release = await holdScripts(visitor);
  await visitor.goto(`/p/${post.id}`, { waitUntil: 'commit' });
  await saveButton(visitor).waitFor();
  await saveButton(visitor).focus();
  await visitor.keyboard.press('Enter');
  await expect(visitor).toHaveURL(/\/accounts\/login/);
  release();
  await early.close();
  expect(bookmarkRows(post.id)).toBe(0);

  // A signed-in person before hydration saves with the form alone.
  const context = await browser.newContext({ baseURL: baseURL() });
  const signed = await context.newPage();
  await signInViaHarness(signed);
  const release2 = await holdScripts(signed);
  await signed.goto(`/p/${post.id}`, { waitUntil: 'commit' });
  await saveButton(signed).waitFor();
  await saveButton(signed).focus();
  await signed.keyboard.press('Enter');
  await expect(saveButton(signed)).toHaveAttribute('aria-pressed', 'true');
  expect(bookmarkRows(post.id)).toBe(1);
  release2();
  await context.close();
});

signedIn('保存すると保存済みタブに出て、解除すると消える', async ({ page, me }) => {
  const a = author(3);
  const [first, second, third] = a.posts as [InsertedPost, InsertedPost, InsertedPost];
  for (const p of a.posts) await putPostFiles(page, p);
  // `second` was saved last: it comes first. `third` stays unsaved.
  saveFor(me, [first, second]);

  await page.goto(`/${me.username}`);
  await waitForHydration(page);
  await page.getByRole('tab', { name: '保存済み' }).click();
  await expect(page).toHaveURL(new RegExp(`/${me.username}\\?tab=saved$`));
  await expect(page.getByRole('tab', { name: '保存済み' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(tiles(page)).toHaveCount(2);
  expect(await tiles(page).evaluateAll((els) => els.map((e) => e.getAttribute('href')))).toEqual([
    `/p/${second.id}`,
    `/p/${first.id}`,
  ]);
  await expect(savedGrid(page).locator(`a[href="/p/${third.id}"]`)).toHaveCount(0);

  // A tile opens the post in the modal (a soft navigation, so the page is hydrated first); the
  // saved state is shown and can be undone there.
  await waitForHydration(page);
  await tiles(page).first().click();
  await expect(dialog(page)).toBeVisible();
  await expect(saveButton(page)).toHaveAttribute('aria-pressed', 'true');
  await saveButton(page).click();
  await expect(saveButton(page)).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => bookmarkRows(second.id)).toBe(0);
  await dialog(page).getByRole('button', { name: '閉じる' }).click();
  await expect(dialog(page)).toBeHidden();

  // Opening the tab again leaves the unsaved post out.
  await page.goto(`/${me.username}?tab=saved`);
  await expect(tiles(page)).toHaveCount(1);
  await expect(savedGrid(page).locator(`a[href="/p/${first.id}"]`)).toHaveCount(1);

  // Unsaving the last one leaves the empty message.
  await page.goto(`/p/${first.id}`);
  await waitForHydration(page);
  await saveButton(page).click();
  await expect.poll(() => bookmarkRows(first.id)).toBe(0);
  await page.goto(`/${me.username}?tab=saved`);
  await expect(page.getByText('保存した投稿はまだありません')).toBeVisible();
});

signedIn('保存済みタブは下までスクロールすると続きを読み込む', async ({ page, me }) => {
  const a = author(13);
  saveFor(me, a.posts);
  await page.goto(`/${me.username}?tab=saved`);
  await waitForHydration(page);
  await expect(tiles(page)).toHaveCount(12);

  await page.getByTestId('grid-sentinel').scrollIntoViewIfNeeded();
  await expect(tiles(page)).toHaveCount(13);
  const hrefs = await tiles(page).evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  expect(new Set(hrefs).size).toBe(13);
  expect(hrefs[12]).toBe(`/p/${a.posts[0]!.id}`);
});

signedIn(
  '他人のプロフィールには保存済みタブが出ず、tab=saved は無視される',
  async ({ page, me, browser }) => {
    // `owner` saved a post of `other`; `me` and a visitor look at the owner's profile.
    const owner = author(1);
    const other = author(1);
    const savedPost = other.posts[0]!;
    harness({
      op: 'insertBookmarks',
      userId: userRow(owner.username)!.id as string,
      items: [{ postId: savedPost.id, savedAt: Date.now() - 60_000 }],
    });
    const ownPost = owner.posts[0]!;

    const look = async (visitor: Page) => {
      const response = await visitor.goto(`/${owner.username}?tab=saved`);
      expect(response!.status()).toBe(200);
      expect(await response!.text()).not.toContain(savedPost.id);
      await expect(visitor.getByRole('tab', { name: '保存済み' })).toHaveCount(0);
      await expect(visitor.getByRole('tab', { name: '投稿' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(visitor.locator(`a[href="/p/${ownPost.id}"]`)).toHaveCount(1);
      await expect(visitor.locator(`a[href="/p/${savedPost.id}"]`)).toHaveCount(0);
    };
    await look(page);
    const context = await browser.newContext({ baseURL: baseURL() });
    await look(await context.newPage());
    await context.close();

    // The owner's own profile treats an unknown tab as the posts tab.
    const ownerContext = await browser.newContext({ baseURL: baseURL() });
    const ownerPage = await ownerContext.newPage();
    // (the owner has no password here, so a fresh account stands in for "own profile")
    const mine = await signInViaHarness(ownerPage);
    await ownerPage.goto(`/${mine.username}?tab=foo`);
    await expect(ownerPage.getByRole('tab', { name: '投稿' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(ownerPage.getByRole('tab', { name: '保存済み' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    await ownerContext.close();
    expect(me.username).toBeTruthy();
  },
);

signedIn('キーボードだけで保存とタブを操作でき、axe の重大な違反が 0 件', async ({ page, me }) => {
  const a = author(1, { follower: me });
  const post = a.posts[0]!;
  await putPostFiles(page, post);

  // The feed: Tab reaches the button; Enter and Space both press it.
  await page.goto('/');
  await waitForHydration(page);
  const button = saveButton(page);
  await expect(button).toBeVisible();
  const box = (await button.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await tabTo(page, button);
  await page.keyboard.press('Enter');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('保存しました', { exact: true })).toBeAttached();
  await expect.poll(() => bookmarkRows(post.id)).toBe(1);
  await page.keyboard.press('Space');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('保存を取り消しました', { exact: true })).toBeAttached();
  await expect.poll(() => bookmarkRows(post.id)).toBe(0);
  await expectNoSeriousViolations(page, 'フィード');

  await page.goto(`/p/${post.id}`);
  await waitForHydration(page);
  await expectNoSeriousViolations(page, '投稿詳細');

  // The profile's tabs: only the selected tab is in the Tab order; arrows move, Enter opens.
  saveFor(me, [post]);
  await page.goto(`/${me.username}`);
  await waitForHydration(page);
  await expect(page.getByRole('tablist', { name: 'プロフィールの表示' })).toBeVisible();
  const posts = page.getByRole('tab', { name: '投稿' });
  const saved = page.getByRole('tab', { name: '保存済み' });
  await expect(posts).toHaveAttribute('tabindex', '0');
  await expect(saved).toHaveAttribute('tabindex', '-1');
  await tabTo(page, posts);
  await page.keyboard.press('ArrowRight');
  await expect(saved).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(posts).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`\\?tab=saved$`));
  await expect(tiles(page)).toHaveCount(1);
  await expectNoSeriousViolations(page, '保存済みタブ');
});
