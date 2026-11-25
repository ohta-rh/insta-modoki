import type { Page } from '@playwright/test';
import { freshUser as test, expect, type NewUser } from './support/auth';
import { expectNoSeriousViolations } from './support/axe';
import { seedFollow, seedUser, userRow, withDb } from './support/db';
import { waitForHydration } from './support/hydration';
import { tabTo } from './support/keys';
import { expectPx, rect, styles } from './support/measure';

const GRAY = 'rgb(115, 115, 115)';
const INDIGO = 'rgb(79, 70, 200)';
const NOTICE = '学習目的の非公式プロジェクトです。Meta 社とは関係ありません。';

const aside = (page: Page) => page.locator('aside[aria-label="おすすめ"]');
const shellFooter = (page: Page) => page.locator('footer[data-shell-footer]');

/** `me` follows `friend`, who follows `cand`: `cand` is the first suggestion ("<friend> さんがフォロー中"). */
function suggestion(me: NewUser, longName = false) {
  const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const friend = `e2e_fr${tag}`;
  // The longest name users.username allows (30 chars, data-model.md).
  const cand = longName ? `e2e_cd${tag}`.padEnd(30, 'a') : `e2e_cd${tag}`;
  seedUser(friend, `${friend}@example.com`);
  seedUser(cand, `${cand}@example.com`);
  const id = (u: string) => userRow(u)!.id as string;
  seedFollow(id(me.username), id(friend));
  seedFollow(id(friend), id(cand));
  return { friend, cand, candId: id(cand) };
}
const home = async (page: Page, width: number) => {
  await page.setViewportSize({ width, height: 800 });
  await page.goto('/');
  await waitForHydration(page);
};
const row = (page: Page, cand: string) =>
  aside(page).getByRole('listitem').filter({ hasText: cand });
const followRows = (me: string, followeeId: string) =>
  withDb(
    (db) =>
      (
        db
          .prepare(
            'SELECT count(*) AS n FROM follows WHERE followee_id = ? AND follower_id = (SELECT id FROM users WHERE username = ?)',
          )
          .get(followeeId, me) as { n: number }
      ).n,
  );

test('1280px のホームの右に 319px のおすすめの列が出る', async ({ page, me }) => {
  const { cand } = suggestion(me);
  await home(page, 1280);
  const column = await rect(page.getByRole('navigation', { name: 'ストーリー' }));
  const box = await rect(aside(page));
  expectPx(box.width, 319, '右の列の幅');
  expectPx(box.x - (column.x + column.width), 64, '中央の列との間');

  const self = aside(page).getByRole('link', { name: new RegExp(me.username) });
  await expect(self).toHaveAttribute('href', `/${me.username}`);
  const avatar = await rect(self.locator('span[aria-hidden="true"], img').first());
  expectPx(avatar.width, 44, '自分のアバターの幅');
  expectPx(avatar.height, 44, '自分のアバターの高さ');
  const name = await styles(self.getByText(me.username, { exact: true }), [
    'font-size',
    'font-weight',
  ]);
  expect(name).toEqual({ 'font-size': '14px', 'font-weight': '600' });
  const display = await styles(self.getByText(me.displayName, { exact: true }), [
    'font-size',
    'color',
  ]);
  expect(display).toEqual({ 'font-size': '14px', color: GRAY });

  const heading = aside(page).getByRole('heading', { name: 'おすすめ' });
  expect(await styles(heading, ['font-size', 'font-weight', 'color'])).toEqual({
    'font-size': '14px',
    'font-weight': '600',
    color: GRAY,
  });
  const ys = [
    (await rect(self)).y,
    (await rect(heading)).y,
    (await rect(row(page, cand))).y,
    (await rect(aside(page).locator('footer'))).y,
  ];
  expect(ys).toEqual([...ys].sort((a, b) => a - b));
});

test('右の列は 1160px から出る', async ({ page, me }) => {
  void me;
  await home(page, 1280);
  await expect(aside(page)).toHaveCount(1);
  for (const [width, visible] of [
    [1159, false],
    [1160, true],
    [1024, false],
    [375, false],
  ] as const) {
    await page.setViewportSize({ width, height: 800 });
    if (visible) await expect(aside(page)).toBeVisible();
    else await expect(aside(page)).toBeHidden();
  }
});

test('候補の行はアバター・名前・理由・フォローのボタン', async ({ page, me }) => {
  const { cand, friend } = suggestion(me);
  await home(page, 1280);
  const item = row(page, cand);
  const avatar = await rect(item.locator('span[aria-hidden="true"], img').first());
  expectPx(avatar.width, 32, 'アバターの幅');
  expectPx(avatar.height, 32, 'アバターの高さ');
  const link = item.getByRole('link', { name: cand });
  await expect(link).toHaveAttribute('href', `/${cand}`);
  expect(await styles(link, ['font-size', 'font-weight'])).toEqual({
    'font-size': '14px',
    'font-weight': '600',
  });
  const reason = item.getByText(`${friend} さんがフォロー中`);
  expect(await styles(reason, ['font-size', 'color'])).toEqual({
    'font-size': '12px',
    color: GRAY,
  });
  const button = item.getByRole('button', { name: `${cand} をフォロー`, exact: true });
  expect(await styles(button, ['font-size', 'font-weight', 'color'])).toEqual({
    'font-size': '12px',
    'font-weight': '600',
    color: INDIGO,
  });
  const b = await rect(button);
  expect(b.width).toBeGreaterThanOrEqual(44);
  expect(b.height).toBeGreaterThanOrEqual(44);
  const r = await rect(item);
  expectPx(r.x + r.width - (b.x + b.width), 0, 'ボタンの右端');
});

test('おすすめの行からフォローできる', async ({ page, me }) => {
  const { cand, candId } = suggestion(me);
  await home(page, 1280);
  const item = row(page, cand);
  const button = item.getByRole('button', { name: new RegExp(`^${cand} をフォロー`) });
  await button.click();
  await expect(button).toHaveText('フォロー中');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => followRows(me.username, candId)).toBe(1);
  await button.click();
  await expect(button).toHaveText('フォロー');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => followRows(me.username, candId)).toBe(0);

  await page.route(
    (url) => url.pathname === '/',
    (route) =>
      route.request().method() === 'POST' ? route.fulfill({ status: 500 }) : route.continue(),
  );
  await button.click();
  await expect(item.locator('p[role="alert"]')).toBeVisible();
  await expect(button).toHaveText('フォロー');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  expect(followRows(me.username, candId)).toBe(0);
});

test('広い画面ではフッターが右の列の下に移る', async ({ page, me }) => {
  void me;
  const year = new Date().getUTCFullYear();
  await home(page, 1280);
  await expect(aside(page).locator('footer')).toContainText(`© ${year} Mado（仮称）`);
  await expect(aside(page).locator('footer')).toContainText(NOTICE);
  await expect(shellFooter(page)).toBeHidden();
  await expect(page.getByText(NOTICE).filter({ visible: true })).toHaveCount(1);
  for (const width of [1024, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(aside(page)).toBeHidden();
    await expect(shellFooter(page)).toBeVisible();
    await expect(shellFooter(page)).toContainText(NOTICE);
    await expect(page.getByText(NOTICE).filter({ visible: true })).toHaveCount(1);
  }
});

test('右の列に axe の重大な違反が無く、キーボードで辿れる', async ({ page, me }) => {
  const { cand } = suggestion(me);
  await home(page, 1280);
  await expectNoSeriousViolations(page, '1280px のホーム');
  const inOrder = await page.evaluate(() => {
    const column = document.querySelector('nav[aria-label="ストーリー"]')!;
    const side = document.querySelector('aside[aria-label="おすすめ"]')!;
    return Boolean(column.compareDocumentPosition(side) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(inOrder).toBe(true);
  const self = aside(page).getByRole('link', { name: new RegExp(me.username) });
  const item = row(page, cand);
  await tabTo(page, self);
  await page.keyboard.press('Tab');
  await expect(item.getByRole('link', { name: cand })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(item.getByRole('button', { name: new RegExp(`^${cand} をフォロー`) })).toBeFocused();
});

test('おすすめの名前は 44×44px 以上で押せる', async ({ page, me }) => {
  const { cand } = suggestion(me);
  await home(page, 1280);
  const item = row(page, cand);
  const box = await rect(item.getByRole('link', { name: cand }));
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  // The press area grows without moving the row: its height and the reason's place are unchanged.
  const r = await rect(item);
  const reason = await rect(item.getByText('さんがフォロー中'));
  expectPx(r.height, 52, '行の高さ（フォローのボタンの 44px と上下の余白）');
  expectPx(reason.y - r.y, 27, '理由の位置');
});

test('30 字のユーザー名でもおすすめの行は崩れない', async ({ page, me }) => {
  const short = suggestion(me);
  await home(page, 1280);
  const shortItem = row(page, short.cand);
  const shortButton = await rect(
    shortItem.getByRole('button', { name: `${short.cand} をフォロー`, exact: true }),
  );
  const shortRow = await rect(shortItem);

  const long = suggestion(me, true);
  expect(long.cand).toHaveLength(30);
  await home(page, 1280);
  const item = row(page, long.cand);
  const link = item.getByRole('link', { name: long.cand });
  await expect(link).toBeVisible();
  const column = await rect(aside(page));
  const linkBox = await rect(link);
  expect(linkBox.x + linkBox.width, '名前の右端は右の列の右端以下').toBeLessThanOrEqual(
    column.x + column.width + 0.5,
  );
  const button = await rect(
    item.getByRole('button', { name: `${long.cand} をフォロー`, exact: true }),
  );
  const itemBox = await rect(item);
  expectPx(button.x + button.width, itemBox.x + itemBox.width, 'ボタンの右端は行の右端');
  expectPx(button.x, shortButton.x, 'フォローのボタンの位置は短い名前のときと同じ');
  expectPx(button.width, shortButton.width, 'フォローのボタンの幅');
  expectPx(itemBox.height, shortRow.height, '行の高さ');
  expect(linkBox.width).toBeGreaterThanOrEqual(43.5);
  expect(linkBox.height).toBeGreaterThanOrEqual(43.5);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/${long.cand}$`));
});
