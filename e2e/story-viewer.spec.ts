import { expect, test as base, type Locator, type Page } from '@playwright/test';
import { test } from './support/auth';
import { expectNoSeriousViolations } from './support/axe';
import { seedFollow, seedUser, userRow, withDb } from './support/db';
import { nextFrames, waitForHydration } from './support/hydration';
import { insertPost } from './support/posts';
import { insertStory, insertStoryView, putStoryFiles } from './support/stories';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const uniqueName = (tag: string) =>
  `e2e_${tag}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** The username of the signed-in user, read from the profile link in the navigation. */
async function ownUsername(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('main').waitFor();
  const href = await page.getByRole('link', { name: 'プロフィール' }).first().getAttribute('href');
  return href!.slice(1);
}

type StorySpec = {
  type?: 'image' | 'video';
  durationMs?: number;
  altText?: string;
  /** Hours ago it was created; later stories of one person have smaller values. */
  hoursAgo?: number;
};

/** A person `me` follows, with the given stories (files stored) oldest first. */
async function followedWith(page: Page, me: string, specs: StorySpec[]) {
  const username = uniqueName('v');
  seedUser(username, `${username}@example.com`, { displayName: '見本の人' });
  seedFollow(userRow(me)!.id as string, userRow(username)!.id as string);
  const stories = [];
  for (const [i, spec] of specs.entries()) {
    const story = insertStory({
      authorUsername: username,
      type: spec.type,
      durationMs: spec.durationMs,
      altText: spec.altText,
      createdAt: Date.now() - (spec.hoursAgo ?? 3) * HOUR + i * 1000,
    });
    await putStoryFiles(page, story);
    stories.push(story);
  }
  return { username, stories };
}

async function openHome(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('main').waitFor();
  await waitForHydration(page);
}

const viewerOf = (page: Page, username: string) =>
  page.getByRole('dialog', { name: `${username}のストーリー` });
const trayLink = (page: Page, username: string) =>
  page.getByTestId('story-tray').locator(`a[href="/stories/${username}"]`);
const position = (page: Page) =>
  page.locator('[aria-live="polite"]', { hasText: /ストーリー \d+ \/ \d+/ });

/** A point on the story surface: `x` and `y` as fractions of its size. */
async function pointOn(page: Page, x: number, y = 0.7): Promise<{ x: number; y: number }> {
  const box = (await page.getByTestId('story-surface').boundingBox())!;
  return { x: box.x + box.width * x, y: box.y + box.height * y };
}
async function tap(page: Page, side: 'left' | 'right'): Promise<void> {
  const p = await pointOn(page, side === 'left' ? 0.15 : 0.7);
  await page.mouse.click(p.x, p.y);
}

const viewRows = (storyId: string) =>
  withDb(
    (db) =>
      (
        db.prepare('SELECT count(*) AS n FROM story_views WHERE story_id = ?').get(storyId) as {
          n: number;
        }
      ).n,
  );

test('左右のタップと ← / → で前後に移り、最後は次の人へ進む', async ({ page }) => {
  const me = await ownUsername(page);
  const c = await followedWith(page, me, [{ hoursAgo: 5 }]);
  const b = await followedWith(page, me, [{ hoursAgo: 2 }, { hoursAgo: 2 }, { hoursAgo: 2 }]);
  await openHome(page);

  await trayLink(page, b.username).click();
  const viewer = viewerOf(page, b.username);
  await expect(viewer).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/stories/${b.username}$`));
  await expect(position(page)).toHaveText('ストーリー 1 / 3');
  await expect.poll(() => viewRows(b.stories[0]!.id)).toBe(1);

  await tap(page, 'right');
  await expect(position(page)).toHaveText('ストーリー 2 / 3');
  await tap(page, 'left');
  await expect(position(page)).toHaveText('ストーリー 1 / 3');
  await tap(page, 'left'); // the first story: nothing happens
  await expect(position(page)).toHaveText('ストーリー 1 / 3');
  await page.keyboard.press('ArrowRight');
  await expect(position(page)).toHaveText('ストーリー 2 / 3');
  await tap(page, 'right');
  await expect(position(page)).toHaveText('ストーリー 3 / 3');
  await page.keyboard.press('ArrowLeft');
  await expect(position(page)).toHaveText('ストーリー 2 / 3');
  await page.keyboard.press('ArrowRight');

  // The last story: next goes to the next person in the tray's order, without adding history.
  const historyBefore = await page.evaluate(() => history.length);
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(new RegExp(`/stories/${c.username}$`));
  await expect(viewerOf(page, c.username)).toBeVisible();
  await expect(position(page)).toHaveText('ストーリー 1 / 1');
  expect(await page.evaluate(() => history.length)).toBe(historyBefore);
  // Nobody comes after the last person: next closes the viewer.
  await tap(page, 'right');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('storyQueue'))).toBe(
    JSON.stringify([b.username, c.username]),
  );
});

test('順番の最後の人を見終えると 見終えたばかりの人に戻らずに閉じる', async ({ page }) => {
  const me = await ownUsername(page);
  const c = await followedWith(page, me, [{ hoursAgo: 5 }]);
  const b = await followedWith(page, me, [{ hoursAgo: 2 }, { hoursAgo: 2 }, { hoursAgo: 2 }]);
  await openHome(page);

  await trayLink(page, b.username).click();
  await expect(viewerOf(page, b.username)).toBeVisible();
  await expect(position(page)).toHaveText('ストーリー 1 / 3');
  await tap(page, 'right');
  await expect(position(page)).toHaveText('ストーリー 2 / 3');
  await tap(page, 'right');
  await expect(position(page)).toHaveText('ストーリー 3 / 3');
  // Every one of b's views is recorded before the walk goes on to c (so c's reel sees b as seen).
  for (const story of b.stories) await expect.poll(() => viewRows(story.id)).toBe(1);

  await tap(page, 'right');
  await expect(page).toHaveURL(new RegExp(`/stories/${c.username}$`));
  await expect(position(page)).toHaveText('ストーリー 1 / 1');
  await tap(page, 'right');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('閉じると元のスクロール位置と読み込んだフィードが保たれる', async ({ page }) => {
  const me = await ownUsername(page);
  const author = uniqueName('a');
  seedUser(author, `${author}@example.com`);
  seedFollow(userRow(me)!.id as string, userRow(author)!.id as string);
  for (let i = 0; i < 25; i++) {
    insertPost({
      authorUsername: author,
      caption: `スクロール ${i}`,
      createdAt: Date.now() - i * 60_000 - DAY / 2,
    });
  }
  const b = await followedWith(page, me, [{}]);
  await openHome(page);
  const articles = page.getByRole('article');
  await expect(articles).toHaveCount(12);
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="feed-sentinel"]')!;
    window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - window.innerHeight - 700);
  });
  await expect(articles).toHaveCount(24);
  await page.evaluate(() => window.scrollTo(0, 40));
  await nextFrames(page);
  expect(await page.evaluate(() => window.scrollY)).toBe(40);

  const link = trayLink(page, b.username);
  const open = async () => {
    // The tray item's top is above the viewport at scrollY 40: click its visible part with the
    // mouse (a locator click would scroll it into view first and change the position under test).
    await expect(link).toBeVisible();
    const box = (await link.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, Math.max(box.y, 0) + 20);
    await expect(viewerOf(page, b.username)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/stories/${b.username}$`));
  };
  const expectRestored = async () => {
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(link).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(40);
    await expect(articles).toHaveCount(24);
  };

  await open();
  await page.keyboard.press('Escape');
  await expectRestored();

  await open();
  await page.getByRole('button', { name: '閉じる' }).click();
  await expectRestored();

  // A swipe down of 79px does not close; 80px does.
  await open();
  const start = await pointOn(page, 0.5, 0.4);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, start.y + 40);
  await page.mouse.move(start.x, start.y + 79);
  await page.mouse.up();
  await expect(viewerOf(page, b.username)).toBeVisible();
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, start.y + 40);
  await page.mouse.move(start.x, start.y + 80);
  await page.mouse.up();
  await expectRestored();
});

test('直接開いたときは閉じるとホームへ移る', async ({ page }) => {
  const me = await ownUsername(page);
  // One story: after the first visit it is seen, and a viewer with everything seen starts at 0 again.
  const b = await followedWith(page, me, [{}]);
  for (const reload of [false, true]) {
    // Something to go "back" to that is not the home: closing must not walk the history.
    await page.goto(`/${me}`);
    await page.goto(`/stories/${b.username}`);
    if (reload) await page.reload();
    await waitForHydration(page);
    const viewer = viewerOf(page, b.username);
    await expect(viewer).toBeVisible();
    // A full-screen page: the viewer covers the viewport.
    const box = (await viewer.boundingBox())!;
    const size = page.viewportSize()!;
    expect(box.height).toBeGreaterThanOrEqual(size.height - 1);
    await expect(position(page)).toHaveText('ストーリー 1 / 1');
    await page.getByRole('button', { name: '閉じる' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});

test('期限切れのストーリーは見つからないと表示する', async ({ page }) => {
  await ownUsername(page);
  const expired = uniqueName('x');
  seedUser(expired, `${expired}@example.com`);
  insertStory({
    authorUsername: expired,
    createdAt: Date.now() - DAY - 60_000,
  });
  const response = await page.goto(`/stories/${expired}`);
  expect(response!.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'ページが見つかりません' })).toBeVisible();
  const missing = await page.goto('/stories/no_such_user_here');
  expect(missing!.status()).toBe(404);

  // Opened over the home (a soft navigation, as the tray's link makes) while the person's only
  // story has already expired, as when it expires after the tray was drawn: the modal says so.
  await openHome(page);
  await page.evaluate(
    (name) =>
      (window as unknown as { next: { router: { push(url: string): void } } }).next.router.push(
        `/stories/${name}`,
      ),
    expired,
  );
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('ページが見つかりません')).toBeVisible();
  await expect(dialog.getByRole('button', { name: '閉じる' })).toBeFocused();
  await dialog.getByRole('button', { name: '閉じる' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('投稿者だけが閲覧者の一覧を見られる', async ({ page }) => {
  const me = await ownUsername(page);
  const mine = insertStory({ authorUsername: me, createdAt: Date.now() - HOUR });
  await putStoryFiles(page, mine);
  const viewers: string[] = [];
  for (let i = 0; i < 21; i++) {
    const name = uniqueName('w');
    seedUser(name, `${name}@example.com`);
    insertStoryView({
      storyId: mine.id,
      viewerUsername: name,
      createdAt: Date.now() - 60_000 + i * 1000,
    });
    viewers.push(name);
  }
  await page.goto(`/stories/${me}`);
  await waitForHydration(page);
  const open = page.getByRole('button', { name: '閲覧者 21 人' });
  await expect(open).toBeVisible();
  await open.click();
  const sheet = page.getByRole('dialog', { name: '閲覧者' });
  await expect(sheet).toBeVisible();
  const rows = sheet.getByRole('listitem');
  await expect(rows).toHaveCount(20);
  await expect(rows.first()).toContainText(viewers[20]!);
  await sheet.getByRole('button', { name: 'さらに表示' }).click();
  await expect(rows).toHaveCount(21);
  await expect(rows.last()).toContainText(viewers[0]!);
  await expect(sheet.getByRole('button', { name: 'さらに表示' })).toHaveCount(0);
  await sheet.getByRole('button', { name: '閉じる' }).click();
  await expect(open).toBeFocused();

  // Someone else's story has no such button, and a stranger is refused by the action.
  const other = await followedWith(page, me, [{}]);
  await page.goto(`/stories/${other.username}`);
  await waitForHydration(page);
  await expect(viewerOf(page, other.username)).toBeVisible();
  await expect(page.getByRole('button', { name: /閲覧者/ })).toHaveCount(0);
});

base.describe('視差効果を減らす', () => {
  base.use({ reducedMotion: 'reduce' });
  test('視差効果を減らす設定で自動進行が止まる', async ({ page }) => {
    const me = await ownUsername(page);
    const b = await followedWith(page, me, [{}, {}]);
    await page.clock.install();
    await page.goto(`/stories/${b.username}`);
    await waitForHydration(page);
    await expect(position(page)).toHaveText('ストーリー 1 / 2');
    await page.clock.runFor(6000);
    await expect(position(page)).toHaveText('ストーリー 1 / 2');
    // The current bar is a static, filled one.
    const widths = await page.locator('[data-current="true"]').evaluate((el) => ({
      fill: el.getBoundingClientRect().width,
      track: el.parentElement!.getBoundingClientRect().width,
    }));
    expect(widths.fill).toBeCloseTo(widths.track, 0);
    await page.keyboard.press('ArrowRight');
    await expect(position(page)).toHaveText('ストーリー 2 / 2');
  });
});

test('写真は 5 秒で次へ進み、長押しの間は止まり、離すと再開する', async ({ page }) => {
  const me = await ownUsername(page);
  const b = await followedWith(page, me, [{}, {}]);
  await page.clock.install();
  await page.goto(`/stories/${b.username}`);
  await waitForHydration(page);
  await expect(position(page)).toHaveText('ストーリー 1 / 2');
  const p = await pointOn(page, 0.5);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.clock.runFor(6000);
  await expect(position(page)).toHaveText('ストーリー 1 / 2');
  await page.mouse.up();
  await expect(position(page)).toHaveText('ストーリー 1 / 2'); // the hold does not move
  await page.clock.runFor(3000);
  await expect(position(page)).toHaveText('ストーリー 1 / 2');
  await page.clock.runFor(3000);
  await expect(position(page)).toHaveText('ストーリー 2 / 2');
});

test('フォーカスが閉じ込められ、名前が読み上げられ、axe の重大な違反が 0 件', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const me = await ownUsername(page);
  const b = await followedWith(page, me, [{ altText: '海辺の夕焼け' }, {}]);
  await openHome(page);
  await trayLink(page, b.username).click();
  const viewer = viewerOf(page, b.username);
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveAttribute('aria-modal', 'true');
  await expect(viewer.getByRole('button', { name: '閉じる' })).toBeFocused();
  await expect(position(page)).toHaveAttribute('aria-live', 'polite');

  for (const name of ['前へ', '次へ', '閉じる', '一時停止']) {
    const box = (await viewer.getByRole('button', { name, exact: true }).boundingBox())!;
    expect(box.width, name).toBeGreaterThanOrEqual(44);
    expect(box.height, name).toBeGreaterThanOrEqual(44);
  }
  await expect(viewer.getByRole('img', { name: '海辺の夕焼け' })).toBeVisible();
  await expectNoSeriousViolations(page, 'ストーリーのビューア（モーダル）');

  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await viewer.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await viewer.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }

  await page.keyboard.press('ArrowRight');
  await expect(position(page)).toHaveText('ストーリー 2 / 2');
  await expect(viewer.getByRole('img', { name: `${b.username}のストーリー` })).toBeVisible();

  await page.goto(`/stories/${b.username}`);
  await waitForHydration(page);
  await expect(viewerOf(page, b.username)).toBeVisible();
  await expectNoSeriousViolations(page, 'ストーリーのビューア（全画面）');
});

test('動画が読み込めないときは警告を出し、手動で次へ進める', async ({ page }) => {
  const me = await ownUsername(page);
  const b = await followedWith(page, me, [{ type: 'video', durationMs: 1500 }, {}]);
  await page.route('**/video.mp4', (route) => route.abort());
  await page.clock.install();
  await page.goto(`/stories/${b.username}`);
  await waitForHydration(page);
  const alert = page.getByRole('alert').filter({ hasText: '動画を読み込めませんでした' });
  await expect(alert).toBeVisible();
  await page.clock.runFor(3000);
  await expect(position(page)).toHaveText('ストーリー 1 / 2');
  await expect(alert).toBeVisible();
  await page.getByRole('button', { name: '次へ' }).click();
  await expect(position(page)).toHaveText('ストーリー 2 / 2');
  await expect(alert).toHaveCount(0);
});

test('動画は再生され、再生時間のあとで次へ進む', async ({ page }) => {
  const me = await ownUsername(page);
  const b = await followedWith(page, me, [{ type: 'video', durationMs: 2500 }, {}]);
  await page.goto(`/stories/${b.username}`);
  await waitForHydration(page);
  const video: Locator = page.locator('video');
  await expect(video).toBeVisible();
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime))
    .toBeGreaterThan(0);
  await expect(position(page)).toHaveText('ストーリー 1 / 2');
  await expect(position(page)).toHaveText('ストーリー 2 / 2', { timeout: 6000 });
});
