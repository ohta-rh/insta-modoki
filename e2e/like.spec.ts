import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test as base, type BrowserContext } from '@playwright/test';
import { signUpViaUi } from './support/auth';
import { seedUser, withDb } from './support/db';
import { waitForHydration } from './support/hydration';
import { insertPost, putPostFiles } from './support/posts';

/**
 * `page` signed in. One user signs up per worker and every test of the worker reuses that session
 * (a likes test only needs a session, and each sign-up is a burst of writes to the shared D1 file).
 */
const signedIn = base.extend<
  object,
  { session: Awaited<ReturnType<BrowserContext['storageState']>> }
>({
  session: [
    async ({ browser }, use) => {
      const context = await browser.newContext({
        baseURL: `http://localhost:${process.env.PORT ?? 3100}`,
      });
      await signUpViaUi(await context.newPage());
      const state = await context.storageState();
      await context.close();
      await use(state);
    },
    { scope: 'worker' },
  ],
  storageState: async ({ session }, use) => {
    await use(session);
  },
});

const heart = (page: Page) => page.getByRole('button', { name: 'いいね', exact: true });
const countLink = (page: Page, n: number) =>
  page.getByRole('button', { name: `${n} 件のいいね`, exact: true });
/** The like button's own message (Next.js keeps an empty alert region of its own on every page). */
const alert = (page: Page) => page.locator('p[role="alert"]');
const likersDialog = (page: Page) => page.getByRole('dialog', { name: 'いいねした人' });
const nextFrames = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );

/** A user nobody is signed in as, with a post of their own whose photos are stored. */
async function strangerPost(page: Page) {
  const username = `e2e_l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  seedUser(username, `${username}@example.com`);
  const post = insertPost({ authorUsername: username, mediaCount: 2, caption: 'いいねの対象' });
  await putPostFiles(page, post);
  return post;
}

const likeRowCount = (postId: string) =>
  withDb(
    (db) =>
      (db.prepare('SELECT count(*) AS n FROM likes WHERE post_id = ?').get(postId) as { n: number })
        .n,
  );
const storedLikeCount = (postId: string) =>
  withDb(
    (db) =>
      (db.prepare('SELECT like_count AS n FROM posts WHERE id = ?').get(postId) as { n: number }).n,
  );

/**
 * Makes `n` users like the post, the i-th at a later time than the one before. One transaction, so
 * the app's own writes are held up for as short a time as possible.
 */
function seedLikers(postId: string, n: number): string[] {
  const names: string[] = [];
  const start = Date.now() - 3_600_000;
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  withDb((db) => {
    db.exec('BEGIN');
    for (let i = 0; i < n; i += 1) {
      const username = `e2e_f${stamp}${i}`;
      const id = crypto.randomUUID();
      const now = Date.now();
      db.prepare(
        'INSERT INTO users (id, username, display_name, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(id, username, username, `${username}@example.com`, now, now);
      db.prepare('INSERT INTO likes (user_id, post_id, created_at) VALUES (?, ?, ?)').run(
        id,
        postId,
        start + i * 1000,
      );
      names.push(username);
    }
    db.prepare('UPDATE posts SET like_count = ? WHERE id = ?').run(n, postId);
    db.exec('COMMIT');
  });
  return names;
}

signedIn(
  'ボタンでいいねすると、押した瞬間に塗りつぶしと件数 +1 になり、再読み込みしても残る',
  async ({ page }) => {
    const post = await strangerPost(page);
    // Holds the Server Action's answer, to see the screen change before the server replies.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(
      (url) => url.pathname === `/p/${post.id}`,
      async (route) => {
        if (route.request().method() === 'POST') await gate;
        await route.continue();
      },
    );
    await page.goto(`/p/${post.id}`);
    await waitForHydration(page);

    await expect(heart(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(heart(page).locator('svg')).toHaveAttribute('fill', 'none');
    await expect(countLink(page, 0)).toBeVisible();

    await heart(page).click();
    // The server has not answered yet.
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(heart(page).locator('svg')).toHaveAttribute('fill', 'currentColor');
    await expect(countLink(page, 1)).toBeVisible();
    expect(likeRowCount(post.id)).toBe(0);
    release();
    await expect.poll(() => likeRowCount(post.id)).toBe(1);
    expect(storedLikeCount(post.id)).toBe(1);

    await page.reload();
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(countLink(page, 1)).toBeVisible();

    await waitForHydration(page);
    await heart(page).click();
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(countLink(page, 0)).toBeVisible();
    await expect.poll(() => likeRowCount(post.id)).toBe(0);
    await page.reload();
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(countLink(page, 0)).toBeVisible();
    expect(storedLikeCount(post.id)).toBe(0);
  },
);

signedIn('JS が読み込まれる前でも ハートを押していいねでき 取り消せる', async ({ page }) => {
  const post = await strangerPost(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/_next/static/chunks/**', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(`/p/${post.id}`, { waitUntil: 'commit' });

  await heart(page).waitFor();
  await heart(page).focus();
  await page.keyboard.press('Enter');
  await expect(heart(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(countLink(page, 1)).toBeVisible();
  expect(likeRowCount(post.id)).toBe(1);
  expect(storedLikeCount(post.id)).toBe(1);

  await heart(page).focus();
  await page.keyboard.press('Enter');
  await expect(heart(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(countLink(page, 0)).toBeVisible();
  expect(likeRowCount(post.id)).toBe(0);
  release();
});

signedIn('写真のダブルタップでいいねされ、いいね済みでは取り消されない', async ({ page }) => {
  const post = await strangerPost(page);
  await page.goto(`/p/${post.id}`);
  await waitForHydration(page);
  const photo = page.locator('[aria-roledescription="carousel"] img').first();
  await expect(photo).toBeVisible();

  await photo.dblclick();
  await expect(page.getByTestId('like-burst')).toBeVisible();
  await expect(heart(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(countLink(page, 1)).toBeVisible();
  await expect.poll(() => likeRowCount(post.id)).toBe(1);

  // Already liked: another double tap shows the heart again but does not undo the like.
  await photo.dblclick();
  await nextFrames(page);
  await expect(heart(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(countLink(page, 1)).toBeVisible();
  expect(likeRowCount(post.id)).toBe(1);
  await page.reload();
  await expect(heart(page)).toHaveAttribute('aria-pressed', 'true');
});

signedIn(
  '視差効果を減らす設定ではダブルタップでハートの動きが出ず 状態だけ変わる',
  async ({ page }) => {
    const post = await strangerPost(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/p/${post.id}`);
    await waitForHydration(page);
    const photo = page.locator('[aria-roledescription="carousel"] img').first();
    await expect(photo).toBeVisible();

    await photo.dblclick();
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('like-burst')).toHaveCount(0);
  },
);

signedIn('サーバーが失敗を返すと表示が元に戻りエラーを出す', async ({ page }) => {
  // A post the server can no longer find: it answers NOT_FOUND with its own message.
  const gone = await strangerPost(page);
  await page.goto(`/p/${gone.id}`);
  await waitForHydration(page);
  withDb((db) => db.prepare('DELETE FROM posts WHERE id = ?').run(gone.id));

  await heart(page).click();
  await expect(alert(page)).toHaveText('ページが見つかりません');
  await expect(heart(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(countLink(page, 0)).toBeVisible();
  // The next try clears the message.
  await heart(page).click();
  await expect(alert(page)).toHaveText('ページが見つかりません');

  // The connection fails: the same, with the fixed message.
  const lost = await strangerPost(page);
  await page.goto(`/p/${lost.id}`);
  await waitForHydration(page);
  await page.route(
    (url) => url.pathname === `/p/${lost.id}`,
    (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()),
  );
  await heart(page).click();
  await expect(alert(page)).toHaveText(
    'エラーが発生しました。しばらくしてからもう一度お試しください',
  );
  await expect(heart(page)).toHaveAttribute('aria-pressed', 'false');
  await expect(countLink(page, 0)).toBeVisible();
  expect(likeRowCount(lost.id)).toBe(0);
});

signedIn('素早く 5 回押すと最後の状態で止まり 同時のリクエストは 1 つ', async ({ page }) => {
  const post = await strangerPost(page);
  await page.goto(`/p/${post.id}`);
  await waitForHydration(page);
  // The first request is held while the other presses come in; every request is counted.
  let hold: Promise<void> = Promise.resolve();
  let open = 0;
  let most = 0;
  let sent = 0;
  await page.route(
    (url) => url.pathname === `/p/${post.id}`,
    async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      sent += 1;
      open += 1;
      most = Math.max(most, open);
      await hold;
      await route.continue();
      open -= 1;
    },
  );
  const holdRequests = () => {
    let release!: () => void;
    hold = new Promise<void>((resolve) => (release = resolve));
    return release;
  };
  const button = heart(page);

  // Five presses (odd): the last wanted state is "liked", and the held first request answers it.
  const release = holdRequests();
  for (let i = 0; i < 5; i += 1) await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(countLink(page, 1)).toBeVisible();
  expect(sent).toBe(1);
  release();
  await expect.poll(() => likeRowCount(post.id)).toBe(1);
  await expect.poll(() => open).toBe(0);
  await nextFrames(page);
  expect(sent).toBe(1);
  expect(storedLikeCount(post.id)).toBe(1);
  await expect(button).toHaveAttribute('aria-pressed', 'true');

  // Four presses (even) on the liked heart: "unlike" is sent first, then "like" once it ends.
  const release2 = holdRequests();
  for (let i = 0; i < 4; i += 1) await button.click();
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(sent).toBe(2);
  release2();
  await expect.poll(() => sent).toBe(3);
  await expect.poll(() => open).toBe(0);
  await expect.poll(() => likeRowCount(post.id)).toBe(1);
  expect(storedLikeCount(post.id)).toBe(1);
  expect(most).toBe(1);
  await expect(countLink(page, 1)).toBeVisible();
});

signedIn('件数から一覧を開き、21 人目が追加読み込みで出て、Esc で閉じる', async ({ page }) => {
  const post = await strangerPost(page);
  const names = seedLikers(post.id, 21);
  await page.goto(`/p/${post.id}`);
  await waitForHydration(page);

  const trigger = countLink(page, 21);
  await trigger.click();
  const dialog = likersDialog(page);
  await expect(dialog).toBeVisible();
  const rows = dialog.getByRole('listitem');
  await expect(rows).toHaveCount(20);
  // Newest like first: the last seeded user leads; the first seeded user is the 21st.
  await expect(rows.first()).toContainText(names[20]!);
  await expect(dialog.getByText(names[0]!)).toHaveCount(0);

  // The end of the list scrolls into view and the next page is loaded.
  await dialog.getByRole('listitem').last().scrollIntoViewIfNeeded();
  await expect(rows).toHaveCount(21);
  await expect(rows.last()).toContainText(names[0]!);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  // Closing and opening again starts from the first page.
  await trigger.click();
  await expect(rows).toHaveCount(20);
});

signedIn('いいねが 0 件のとき 一覧に「まだいいねはありません」が出る', async ({ page }) => {
  const post = await strangerPost(page);
  await page.goto(`/p/${post.id}`);
  await waitForHydration(page);
  await countLink(page, 0).click();
  await expect(likersDialog(page).getByText('まだいいねはありません')).toBeVisible();
});

base('ログインしていない人がハートを押すとログイン画面へ移る', async ({ page }) => {
  const post = await strangerPost(page);
  await page.goto(`/p/${post.id}`);
  await waitForHydration(page);
  await expect(heart(page)).toHaveAttribute('aria-pressed', 'false');
  await heart(page).click();
  await expect(page).toHaveURL(/\/accounts\/login/);
  expect(likeRowCount(post.id)).toBe(0);
});

signedIn(
  'いいねをキーボードで操作でき、状態が読み上げられ、axe の重大な違反が 0 件',
  async ({ page }) => {
    const post = await strangerPost(page);
    seedLikers(post.id, 2);
    let finished = 0;
    page.on('requestfinished', (r) => {
      if (r.method() === 'POST' && new URL(r.url()).pathname === `/p/${post.id}`) finished += 1;
    });
    await page.goto(`/p/${post.id}`);
    await waitForHydration(page);
    await expect(page.locator('[aria-roledescription="carousel"] img').first()).toBeVisible();

    const serious = async () =>
      (await new AxeBuilder({ page }).analyze()).violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
    expect(await serious()).toEqual([]);

    const box = (await heart(page).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    const countBox = (await countLink(page, 2).boundingBox())!;
    expect(countBox.height).toBeGreaterThanOrEqual(44);

    // Tab reaches the heart; Enter and Space both switch it.
    await focusByTab(page, heart(page));
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Enter');
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(heart(page)).toBeFocused();
    // The state and the new count are said by a polite live region.
    const live = page.locator('[aria-live="polite"]').filter({ hasText: 'いいね済み' });
    await expect(live).toHaveText('いいね済み（3 件）');
    await page.keyboard.press('Space');
    await expect(heart(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(
      page.locator('[aria-live="polite"]').filter({ hasText: 'いいねを取り消しました' }),
    ).toHaveText('いいねを取り消しました（2 件）');
    // Both requests (like, then unlike) have ended.
    await expect.poll(() => finished).toBe(2);
    expect(likeRowCount(post.id)).toBe(2);

    // Tab goes on to the count, which opens the dialog; the focus stays inside it.
    await focusByTab(page, countLink(page, 2));
    await page.keyboard.press('Enter');
    const dialog = likersDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('listitem')).toHaveCount(2);
    expect(await serious()).toEqual([]);
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(countLink(page, 2)).toBeFocused();
  },
);

async function focusByTab(page: Page, target: ReturnType<Page['locator']>) {
  for (let i = 0; i < 30; i += 1) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error('Tab で目的の要素に届きません');
}
