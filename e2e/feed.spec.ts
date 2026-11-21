import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { signUpViaUi, type NewUser } from './support/auth';
import { seedFollow, seedUser, userRow, withDb } from './support/db';
import { waitForHydration } from './support/hydration';
import { insertPost, putPostFiles } from './support/posts';

/** `page` signed in as a new user, who is `me`. */
const signedIn = test.extend<{ me: NewUser }>({
  // auto: every test starts signed in, even one that never names `me`.
  me: [
    async ({ page }, use) => {
      await use(await signUpViaUi(page));
    },
    { auto: true },
  ],
});

const articles = (page: Page) => page.getByRole('article');
const heart = (page: Page) => page.getByRole('button', { name: 'いいね', exact: true });
/** The alert of the feed itself (Next.js keeps an empty alert region of its own on every page). */
const feedAlert = (page: Page) => page.locator('[role="alert"]', { hasText: '通信に失敗しました' });

/** A user `me` follows, with `n` posts one minute apart (caption `<tag> <i>`, newest has the highest i). */
function followedAuthor(me: NewUser, n: number, tag = 'フィード') {
  const username = `e2e_a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  seedUser(username, `${username}@example.com`);
  seedFollow(userRow(me.username)!.id as string, userRow(username)!.id as string);
  const start = Date.now() - 24 * 3_600_000;
  const posts = Array.from({ length: n }, (_, i) =>
    insertPost({
      authorUsername: username,
      caption: `${tag} ${i}`,
      createdAt: start + i * 60_000,
      altTexts: [`${tag} ${i} の写真`],
    }),
  );
  return { username, posts };
}

const captionsOf = (page: Page) =>
  articles(page).evaluateAll((els) =>
    els.map((el) => el.querySelector('p')?.textContent?.replace(/^\S+\s/, '') ?? ''),
  );

const likeRows = (postId: string) =>
  withDb(
    (db) =>
      (db.prepare('SELECT count(*) AS n FROM likes WHERE post_id = ?').get(postId) as { n: number })
        .n,
  );

const nextFrames = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );

test('未ログインで / を開くとログイン画面へ移る', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/accounts\/login/);
});

signedIn(
  'スクロールの手前で次の 12 件が重複なく読み込まれ、最後に「ここまでです」が出る',
  async ({ page, me }) => {
    const { posts } = followedAuthor(me, 25);
    expect(posts).toHaveLength(25);
    await page.goto('/');
    await waitForHydration(page);
    await expect(articles(page)).toHaveCount(12);
    await expect(page.getByText('ここまでです')).toHaveCount(0);

    // 900px before the end of the list nothing is fetched (the margin is 800px).
    const sentinel = page.getByTestId('feed-sentinel');
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="feed-sentinel"]')!;
      window.scrollTo(
        0,
        window.scrollY + el.getBoundingClientRect().top - window.innerHeight - 900,
      );
    });
    await nextFrames(page);
    await nextFrames(page);
    await expect(articles(page)).toHaveCount(12);

    // 700px before the end it is fetched.
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="feed-sentinel"]')!;
      window.scrollTo(
        0,
        window.scrollY + el.getBoundingClientRect().top - window.innerHeight - 700,
      );
    });
    await expect(articles(page)).toHaveCount(24);
    await sentinel.scrollIntoViewIfNeeded();
    await expect(articles(page)).toHaveCount(25);
    await expect(page.getByText('ここまでです')).toBeVisible();
    await expect(sentinel).toHaveCount(0);

    const expected = Array.from({ length: 25 }, (_, i) => `フィード ${24 - i}`);
    expect(await captionsOf(page)).toEqual(expected);
  },
);

signedIn('フォローが 0 人のとき空の案内を出す', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('フォローすると、その人の投稿がここに表示されます')).toBeVisible();
  await expect(articles(page)).toHaveCount(0);
  await expect(feedAlert(page)).toHaveCount(0);
});

signedIn(
  '次ページの読み込みに失敗しても表示済みの投稿が残り、再読み込みできる',
  async ({ page, me }) => {
    followedAuthor(me, 14);
    await page.goto('/');
    await waitForHydration(page);
    await expect(articles(page)).toHaveCount(12);

    // The next page is a Server Action call (a POST with a `next-action` header): break it once.
    let failing = true;
    await page.route(
      (url) => url.pathname === '/',
      async (route) => {
        const request = route.request();
        if (failing && request.method() === 'POST' && request.headers()['next-action']) {
          await route.abort();
        } else {
          await route.continue();
        }
      },
    );
    await page.getByTestId('feed-sentinel').scrollIntoViewIfNeeded();
    await expect(feedAlert(page)).toBeVisible();
    await expect(feedAlert(page)).toContainText('通信に失敗しました');
    await expect(articles(page)).toHaveCount(12);

    failing = false;
    await page.getByRole('button', { name: 'もう一度読み込む' }).click();
    await expect(articles(page)).toHaveCount(14);
    await expect(feedAlert(page)).toHaveCount(0);
    await expect(page.getByText('ここまでです')).toBeVisible();
  },
);

signedIn('フィードをキーボードで操れ、axe の重大な違反が 0 件', async ({ page, me }) => {
  const { posts } = followedAuthor(me, 2, 'キー');
  for (const post of posts) await putPostFiles(page, post);
  await page.goto('/');
  await waitForHydration(page);
  await expect(articles(page)).toHaveCount(2);

  // Photos carry their alt text.
  const alts = await articles(page)
    .locator('img[srcset]')
    .evaluateAll((imgs) => imgs.map((i) => i.getAttribute('alt')));
  expect(alts).toEqual(['キー 1 の写真', 'キー 0 の写真']);

  // Tab reaches the first post's like button, and Enter on it likes the post.
  await page.locator('body').click({ position: { x: 1, y: 1 } });
  let reached = false;
  for (let i = 0; i < 30 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = await heart(page)
      .first()
      .evaluate((el) => el === document.activeElement);
  }
  expect(reached).toBe(true);
  await page.keyboard.press('Enter');
  await expect(heart(page).first()).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => likeRows(posts[1]!.id)).toBe(1);

  const serious = (await new AxeBuilder({ page }).analyze()).violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  expect(serious).toEqual([]);
});

signedIn('JS が読み込まれる前でも ハートを押していいねできる', async ({ page, me }) => {
  const { posts } = followedAuthor(me, 1, '先');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/_next/static/chunks/**', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/', { waitUntil: 'commit' });
  await heart(page).waitFor();
  await heart(page).focus();
  await page.keyboard.press('Enter');
  await expect(heart(page)).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => likeRows(posts[0]!.id)).toBe(1);
  release();
});
