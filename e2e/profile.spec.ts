import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { signUpViaUi } from './support/auth';
import { seedFollow, seedUser, userRow } from './support/db';
import { waitForHydration } from './support/hydration';
import { insertPost, putPostFiles, type InsertedPost } from './support/posts';

/** A user nobody is signed in as. */
function newProfileUser(options: { displayName?: string; bio?: string } = {}) {
  const username = `e2e_p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  seedUser(username, `${username}@example.com`, {
    displayName: options.displayName ?? '表示名',
    bio: options.bio ?? '',
  });
  return { username, id: userRow(username)!.id as string };
}

/** A post made `minutesAgo` minutes ago, with real photo files in storage. */
async function postAt(
  page: Page,
  username: string,
  minutesAgo: number,
  options: { mediaCount?: number; altTexts?: string[] } = {},
): Promise<InsertedPost> {
  const post = insertPost({
    authorUsername: username,
    createdAt: Date.now() - minutesAgo * 60_000,
    ...options,
  });
  await putPostFiles(page, post);
  return post;
}

const grid = (page: Page) => page.getByTestId('post-grid');
const tiles = (page: Page) => grid(page).locator('a');
const countOf = (page: Page, label: string) =>
  page.getByRole('listitem').filter({ hasText: label });

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('要素が表示されていません');
  return box;
}

test('他人のプロフィールを開くと ヘッダーと投稿のグリッドが新しい順に表示される', async ({
  page,
}) => {
  const haru = newProfileUser({ displayName: 'ハル', bio: '猫と散歩\n毎日更新' });
  const fan1 = newProfileUser();
  const fan2 = newProfileUser();
  const friend = newProfileUser();
  seedFollow(fan1.id, haru.id);
  seedFollow(fan2.id, haru.id);
  seedFollow(haru.id, friend.id);
  const a = await postAt(page, haru.username, 30, { altTexts: ['写真A'] });
  const b = await postAt(page, haru.username, 20, { altTexts: ['写真B'] });
  const c = await postAt(page, haru.username, 10, { altTexts: ['写真C'] });

  const response = await page.goto(`/${haru.username}`);
  expect(response!.status()).toBe(200);

  await expect(page.getByRole('heading', { level: 1, name: haru.username })).toBeVisible();
  await expect(page.getByText('ハル', { exact: true })).toBeVisible();
  await expect(page.getByText('猫と散歩')).toBeVisible();
  await expect(page.getByText('毎日更新')).toBeVisible();
  // No avatar is stored, so the first letter of the username shows in a circle.
  await expect(page.getByTestId('avatar-initial')).toHaveText(haru.username[0]!.toUpperCase());
  await expect(countOf(page, '投稿')).toHaveText('3 投稿');
  await expect(countOf(page, 'フォロワー')).toHaveText('2 フォロワー');
  await expect(countOf(page, 'フォロー中')).toHaveText('1 フォロー中');

  await expect(tiles(page)).toHaveCount(3);
  expect(await tiles(page).evaluateAll((els) => els.map((e) => e.getAttribute('href')))).toEqual([
    `/p/${c.id}`,
    `/p/${b.id}`,
    `/p/${a.id}`,
  ]);
  await expect(tiles(page).locator('img')).toHaveCount(3);
  expect(
    await tiles(page)
      .locator('img')
      .evaluateAll((els) => els.map((e) => e.getAttribute('alt'))),
  ).toEqual(['写真C', '写真B', '写真A']);
  await expect(tiles(page).first().locator('img')).toBeVisible();
  // The tile is a plain link to the post page.
  await tiles(page).first().click();
  await expect(page).toHaveURL(new RegExp(`/p/${c.id}$`));
});

test('13 件目はスクロールすると読み込まれる', async ({ page }) => {
  const twelve = newProfileUser();
  for (let i = 0; i < 12; i++) await postAt(page, twelve.username, 100 - i);
  await page.goto(`/${twelve.username}`);
  await waitForHydration(page);
  await expect(tiles(page)).toHaveCount(12);
  // Exactly 12 posts: there is nothing more to load, so no end marker is on the page.
  await expect(page.getByTestId('grid-sentinel')).toHaveCount(0);

  const thirteen = newProfileUser();
  for (let i = 0; i < 13; i++) await postAt(page, thirteen.username, 100 - i);
  await page.goto(`/${thirteen.username}`);
  await waitForHydration(page);
  await expect(tiles(page)).toHaveCount(12);
  await page.getByTestId('grid-sentinel').scrollIntoViewIfNeeded();
  await expect(tiles(page)).toHaveCount(13);
  // The oldest post is last, and the marker is gone once everything is loaded.
  await expect(page.getByTestId('grid-sentinel')).toHaveCount(0);
  await expect(page.getByText('読み込めませんでした')).toHaveCount(0);
});

test('続きの読み込みに失敗すると 失敗の表示から もう一度読み込める', async ({ page }) => {
  const user = newProfileUser();
  for (let i = 0; i < 13; i++) await postAt(page, user.username, 100 - i);
  // A Server Action is a POST carrying the Next-Action header; refuse it until told otherwise.
  let refuse = true;
  await page.route(`**/${user.username}`, (route) =>
    refuse && route.request().headers()['next-action'] ? route.abort() : route.continue(),
  );
  await page.goto(`/${user.username}`);
  await waitForHydration(page);
  await page.getByTestId('grid-sentinel').scrollIntoViewIfNeeded();
  await expect(page.getByText('読み込めませんでした')).toBeVisible();
  await expect(tiles(page)).toHaveCount(12);

  refuse = false;
  await page.getByRole('button', { name: 'もう一度読み込む' }).click();
  await expect(tiles(page)).toHaveCount(13);
  await expect(page.getByText('読み込めませんでした')).toHaveCount(0);
});

test('存在しないユーザー名では 404 の画面が出る', async ({ page }) => {
  for (const name of [`nobody_${Date.now().toString(36)}`, '.abc', 'ab']) {
    const response = await page.goto(`/${name}`);
    expect(response!.status(), name).toBe(404);
    await expect(page.getByText('ページが見つかりません')).toBeVisible();
  }
  // Only the case differs: the same profile.
  const haru = newProfileUser({ displayName: '大文字' });
  const response = await page.goto(`/${haru.username.toUpperCase()}`);
  expect(response!.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: haru.username })).toBeVisible();
  await expect(page.getByText('大文字', { exact: true })).toBeVisible();
});

test('グリッドの画像が全て alt を持ち axe の重大な違反が無い', async ({ page }) => {
  const user = newProfileUser({ displayName: 'アクセシビリティ' });
  await postAt(page, user.username, 30, { altTexts: ['猫'] });
  await postAt(page, user.username, 20, { mediaCount: 2 });
  await postAt(page, user.username, 10);
  await page.goto(`/${user.username}`);
  await expect(tiles(page).first().locator('img')).toBeVisible();

  const alts = await grid(page)
    .locator('img')
    .evaluateAll((els) => els.map((e) => e.getAttribute('alt')));
  expect(alts).toEqual([
    `${user.username} が投稿した写真（1 / 1）`,
    `${user.username} が投稿した写真（1 / 2）`,
    '猫',
  ]);
  const serious = (await new AxeBuilder({ page }).analyze()).violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
  expect(serious).toEqual([]);
});

test('投稿が無いときは空の状態が表示される', async ({ page }) => {
  const other = newProfileUser({ displayName: '空の人' });
  await page.goto(`/${other.username}`);
  await expect(page.getByText('まだ投稿がありません')).toBeVisible();
  await expect(page.getByRole('link', { name: '写真を投稿する' })).toHaveCount(0);
  await expect(grid(page)).toHaveCount(0);

  const me = await signUpViaUi(page);
  await page.goto(`/${me.username}`);
  await expect(page.getByText('まだ投稿がありません')).toBeVisible();
  await expect(page.getByRole('link', { name: '写真を投稿する' })).toHaveAttribute(
    'href',
    '/create',
  );
  // Someone else's empty profile still has no link while signed in.
  await page.goto(`/${other.username}`);
  await expect(page.getByText('まだ投稿がありません')).toBeVisible();
  await expect(page.getByRole('link', { name: '写真を投稿する' })).toHaveCount(0);
});

test('複数枚の投稿だけに 枚数が表示される', async ({ page }) => {
  const user = newProfileUser();
  const single = await postAt(page, user.username, 30);
  const three = await postAt(page, user.username, 20, { mediaCount: 3 });
  await page.goto(`/${user.username}`);
  await expect(tiles(page)).toHaveCount(2);

  const threeTile = grid(page).locator(`a[href="/p/${three.id}"]`);
  const singleTile = grid(page).locator(`a[href="/p/${single.id}"]`);
  const badge = threeTile.getByRole('img', { name: '3 枚の写真' });
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText('');
  await expect(singleTile.getByRole('img', { name: /枚の写真/ })).toHaveCount(0);
  // The badge sits in the top-right corner of the thumbnail.
  const tile = await boxOf(threeTile);
  const mark = await boxOf(badge);
  expect(mark.x + mark.width).toBeGreaterThan(tile.x + tile.width * 0.6);
  expect(mark.y).toBeLessThan(tile.y + tile.height * 0.4);
});

test('375px と 1280px でグリッドが 3 列の 3:4 で並ぶ', async ({ page }) => {
  const user = newProfileUser();
  for (let i = 0; i < 6; i++) await postAt(page, user.username, 60 - i);

  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`/${user.username}`);
    await expect(tiles(page)).toHaveCount(6);
    await expect(tiles(page).first().locator('img')).toBeVisible();
    const boxes = [];
    for (let i = 0; i < 6; i++) boxes.push(await boxOf(tiles(page).nth(i)));
    const lefts = [...new Set(boxes.map((b) => Math.round(b.x)))];
    expect(lefts, `${width}px の列`).toHaveLength(3);
    for (const [i, box] of boxes.entries()) {
      expect(Math.abs(box.width * (4 / 3) - box.height), `${width}px の ${i} 番目`).toBeLessThan(1);
    }
    // Neighbours are 1px apart, across and down.
    expect(boxes[1]!.x - (boxes[0]!.x + boxes[0]!.width)).toBeCloseTo(1, 0);
    expect(boxes[3]!.y - (boxes[0]!.y + boxes[0]!.height)).toBeCloseTo(1, 0);
    expect(boxes[3]!.x).toBeCloseTo(boxes[0]!.x, 0);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${width}px の横スクロール`).toBeLessThanOrEqual(0);
  }
});
