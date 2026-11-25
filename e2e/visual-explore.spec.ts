import type { Locator, Page } from '@playwright/test';
import { signedIn as test, expect } from './support/auth';
import { expectNoSeriousViolations } from './support/axe';
import { seedUser } from './support/db';
import { harness } from './support/harness';
import { waitForHydration } from './support/hydration';
import { expectPx, rect, styles, VIEWPORTS } from './support/measure';
import { insertPost, tagPost } from './support/posts';

const HOUR = 60 * 60 * 1000;
const HIGHLIGHT = 'rgb(239, 239, 239)';
const BLACK = 'rgb(0, 0, 0)';

const grid = (page: Page) => page.getByTestId('post-grid');
const tiles = (page: Page) => grid(page).getByRole('link');
const searchLink = (page: Page) =>
  page.locator('main').getByRole('link', { name: '検索', exact: true });
const unique = () => Math.random().toString(36).slice(2, 8);

/** A new author with `n` posts, each liked once, so they are on the popular list. */
function seedPopular(n: number): string[] {
  const username = `e2e_ve${Date.now().toString(36)}${unique()}`;
  seedUser(username, `${username}@example.com`);
  // One like each and older than other specs' posts: on ties the newer post wins, so this
  // spec's 24 posts never push their liked posts off the popular list's first pages.
  const base = Date.now() - 5 * HOUR;
  const ids = Array.from(
    { length: n },
    (_, i) => insertPost({ authorUsername: username, createdAt: base + i * 60_000 }).id,
  );
  const stamp = `${Date.now().toString(36)}${unique()}`;
  for (const [k, postId] of ids.entries()) {
    harness({
      op: 'seedLikers',
      postId,
      likers: Array.from({ length: 1 }, (_, i) => ({
        username: `e2e_vl${stamp}${k}x${i}`,
        email: `e2e_vl${stamp}${k}x${i}@example.com`,
        likedAt: Date.now() - HOUR + i * 1000,
      })),
    });
  }
  return ids;
}

/** `n` posts carrying the tag `name`. */
function seedTagged(name: string, n: number): void {
  const username = `e2e_vt${Date.now().toString(36)}${unique()}`;
  seedUser(username, `${username}@example.com`);
  const base = Date.now() - 2 * HOUR;
  for (let i = 0; i < n; i++) {
    const at = base + i * 60_000;
    tagPost(insertPost({ authorUsername: username, createdAt: at }).id, [name], at);
  }
}

const open = async (page: Page, path: string, viewport: { width: number; height: number }) => {
  await page.setViewportSize(viewport);
  await page.goto(path);
  await waitForHydration(page);
};
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test('発見のグリッドは 935px・3 列・3:4', async ({ page }) => {
  seedPopular(24);
  for (const viewport of [VIEWPORTS.wide, VIEWPORTS.narrow, VIEWPORTS.mobile]) {
    await open(page, '/explore', viewport);
    await expect(tiles(page)).toHaveCount(24);
    const at = `${viewport.width}px`;
    const box = await rect(grid(page));
    const mobile = viewport.width === 375;
    expectPx(box.width, mobile ? 375 : 935, `${at} 発見のグリッドの幅`);
    const columns = await grid(page).evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
    );
    expect(columns, `${at} 列の数`).toBe(3);
    const gap = await styles(grid(page), ['column-gap', 'row-gap']);
    expect(gap, `${at} 隙間`).toEqual({ 'column-gap': '1px', 'row-gap': '1px' });
    const tile = await rect(tiles(page).first());
    expectPx(tile.width, mobile ? 124.3 : 311, `${at} タイルの幅`);
    expectPx(tile.height, mobile ? 165.8 : 414.7, `${at} タイルの高さ`);
    if (mobile) expect(await overflow(page), `${at} 横スクロール`).toBeLessThanOrEqual(0);
  }
});

test('検索の入口は狭い画面だけに出る', async ({ page }) => {
  await open(page, '/explore', { width: 768, height: 800 });
  await expect(searchLink(page)).toBeHidden();
  await open(page, '/explore', { width: 767, height: 800 });
  await expect(searchLink(page)).toBeVisible();
});

test('狭い画面の検索の入口は 44px の灰色の欄で、検索のページへ移る', async ({ page }) => {
  await open(page, '/explore', VIEWPORTS.mobile);
  const link = searchLink(page);
  const box = await rect(link);
  expectPx(box.height, 44, '入口の高さ');
  const style = await styles(link, ['background-color', 'border-radius', 'color']);
  expect(style).toEqual({
    'background-color': HIGHLIGHT,
    'border-radius': '8px',
    color: BLACK,
  });
  await link.click();
  await expect(page).toHaveURL(/\/explore\/search$/);
});

const heading = (page: Page): Locator => page.getByRole('heading', { level: 1 });

test('タグの画面も 935px のグリッド', async ({ page }) => {
  const tag = `ve${unique()}`;
  seedTagged(tag, 13);
  for (const viewport of [VIEWPORTS.wide, VIEWPORTS.mobile]) {
    await open(page, `/explore/tags/${tag}`, viewport);
    await expect(tiles(page).first()).toBeVisible(); // the first page holds 12 of the 13
    const at = `${viewport.width}px`;
    const mobile = viewport.width === 375;
    const box = await rect(grid(page));
    expectPx(box.width, mobile ? 375 : 935, `${at} タグのグリッドの幅`);
    await expect(heading(page)).toHaveText(`#${tag}`);
    await expect(page.getByText('投稿 13 件')).toBeVisible();
    // The heading text starts at the grid's left edge (the mobile heading keeps a 16px inset).
    const inset = mobile ? 16 : 0;
    const title = await heading(page).evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getBoundingClientRect().left;
    });
    expectPx(title - box.x, inset, `${at} 見出しの左端`);
    const count = await rect(page.getByText('投稿 13 件'));
    expectPx(count.x - box.x, inset, `${at} 件数の左端`);
  }
});

test('100 字のタグ名でも 375px と 1280px で横にはみ出さず、グリッドの幅が変わらない', async ({
  page,
}) => {
  const short = `vs${unique()}`;
  const long = `l${unique()}`.padEnd(100, 'x');
  expect(long).toHaveLength(100);
  seedTagged(short, 3);
  seedTagged(long, 3);
  for (const viewport of [VIEWPORTS.mobile, VIEWPORTS.wide]) {
    await open(page, `/explore/tags/${short}`, viewport);
    const reference = await rect(tiles(page).first());
    await open(page, `/explore/tags/${long}`, viewport);
    await expect(tiles(page)).toHaveCount(3);
    const at = `${viewport.width}px`;
    expect(await overflow(page), `${at} 横スクロール`).toBeLessThanOrEqual(0);
    const tile = await rect(tiles(page).first());
    expectPx(tile.width, reference.width, `${at} タイルの幅（短い名前と同じ）`);
    expectPx((await rect(grid(page))).width, viewport.width === 375 ? 375 : 935, `${at} 幅`);
  }
});

test('タグの画面に axe の重大な違反が無い', async ({ page }) => {
  const tag = `va${unique()}`;
  seedTagged(tag, 3);
  for (const viewport of [VIEWPORTS.mobile, VIEWPORTS.narrow, VIEWPORTS.wide]) {
    await open(page, `/explore/tags/${tag}`, viewport);
    await expect(tiles(page)).toHaveCount(3);
    await expectNoSeriousViolations(page, `/explore/tags/${tag} at ${viewport.width}px`);
  }
});
