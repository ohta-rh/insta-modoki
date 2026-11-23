import type { Locator, Page } from '@playwright/test';
import { freshUser as test, expect } from './support/auth';
import { expectNoSeriousViolations } from './support/axe';
import { seedUser } from './support/db';
import { waitForHydration } from './support/hydration';
import { expectPx, rect, styles, VIEWPORTS } from './support/measure';
import { insertPost } from './support/posts';

const BLACK = 'rgb(0, 0, 0)';
const GRAY = 'rgb(115, 115, 115)';
const LINE = 'rgb(219, 219, 219)';
const HIGHLIGHT = 'rgb(239, 239, 239)';

/** A profile of someone else (the viewer, `me`, follows them), with `posts` posts. */
function otherProfile(options: { posts?: number; threePhotos?: boolean; bio?: string } = {}) {
  const username = `e2e_vp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  seedUser(username, `${username}@example.com`, {
    displayName: '表示 名前',
    bio: options.bio ?? 'ひとこと目\nふたこと目',
  });
  const start = Date.now() - 6 * 3_600_000;
  const ids: string[] = [];
  for (let i = 0; i < (options.posts ?? 0); i++) {
    ids.push(insertPost({ authorUsername: username, createdAt: start + i * 60_000 }).id);
  }
  const three = options.threePhotos
    ? insertPost({ authorUsername: username, mediaCount: 3, createdAt: start + 3_600_000 }).id
    : null;
  return { username, ids, three };
}

const open = async (page: Page, username: string, viewport: { width: number; height: number }) => {
  await page.setViewportSize(viewport);
  await page.goto(`/${username}`);
  await waitForHydration(page);
};
const wide = (page: Page) => page.locator('[data-page-width="wide"]');
const header = (page: Page) => wide(page).locator('> header');
const countItem = (page: Page, label: string) =>
  header(page).getByRole('listitem').filter({ hasText: label });
const tiles = (page: Page) => page.getByTestId('post-grid').locator('a');
const px = (value: string) => Number.parseFloat(value);

test('プロフィールの中身は 935px', async ({ page, me }) => {
  void me; // signed in as a viewer
  const { username } = otherProfile({ posts: 3 });
  for (const viewport of [VIEWPORTS.wide, VIEWPORTS.narrow]) {
    await open(page, username, viewport);
    const at = `${viewport.width}px`;
    const body = await rect(wide(page));
    expectPx(body.width, 935, `${at} 中身の幅`);
    const first = await rect(header(page));
    expect(
      Math.abs(first.y - body.y - 30) <= 2,
      `${at} 上の余白: ${first.y - body.y}px（参照 30px ±2）`,
    ).toBe(true);
  }
});

test('1280px のヘッダーは 150px のアバターと、ユーザー名の 1 行目', async ({ page, me }) => {
  const other = otherProfile({ posts: 1 });
  await open(page, other.username, VIEWPORTS.wide);
  const head = await rect(header(page));
  const avatar = await rect(header(page).locator('[data-testid="avatar-initial"], img').first());
  expectPx(avatar.width, 150, 'アバターの幅');
  expectPx(avatar.height, 150, 'アバターの高さ');
  expectPx(
    avatar.x + avatar.width / 2 - head.x,
    head.width * 0.15,
    'アバターの中心（左の区画の中央）',
  );

  const name = header(page).getByRole('heading', { level: 1, name: other.username, exact: true });
  const nameStyle = await styles(name, ['font-size', 'font-weight', 'line-height', 'color']);
  expect(nameStyle).toEqual({
    'font-size': '20px',
    'font-weight': '400',
    'line-height': '25px',
    color: BLACK,
  });
  const nameBox = await rect(name);
  const follow = header(page).getByRole('button', { name: 'フォローする' });
  const followBox = await rect(follow);
  expect(followBox.x, 'フォローのボタンはユーザー名の右').toBeGreaterThan(
    nameBox.x + nameBox.width - 1,
  );
  expect(
    Math.abs(followBox.y + followBox.height / 2 - (nameBox.y + nameBox.height / 2)) <= 1,
    'フォローのボタンはユーザー名と同じ行',
  ).toBe(true);

  await open(page, me.username, VIEWPORTS.wide);
  const mineName = header(page).getByRole('heading', { level: 1, name: me.username, exact: true });
  const edit = header(page).getByRole('link', { name: 'プロフィールを編集' });
  const mineBox = await rect(mineName);
  const editBox = await rect(edit);
  expect(editBox.x).toBeGreaterThan(mineBox.x + mineBox.width - 1);
  expect(Math.abs(editBox.y + editBox.height / 2 - (mineBox.y + mineBox.height / 2)) <= 1).toBe(
    true,
  );
});

test('数の行は 16px で、単位は灰色、間は 40px', async ({ page, me }) => {
  void me; // signed in as a viewer
  const other = otherProfile({ posts: 2 });
  await open(page, other.username, VIEWPORTS.wide);
  const name = header(page).getByRole('heading', { level: 1 });
  const action = header(page).getByRole('button', { name: 'フォローする' });
  const rowBottom = Math.max(
    (await rect(name)).y + (await rect(name)).height,
    (await rect(action)).y + (await rect(action)).height,
  );
  const labels = ['投稿', 'フォロワー', 'フォロー中'];
  const boxes = [];
  for (const label of labels) {
    const item = countItem(page, label);
    boxes.push(await rect(item));
    const number = item.locator(':scope > * > span').first();
    const unit = item.locator(':scope > * > span').last();
    const n = await styles(number, ['font-size', 'font-weight', 'color']);
    expect(n, `${label} の数`).toEqual({ 'font-size': '16px', 'font-weight': '600', color: BLACK });
    const u = await styles(unit, ['font-size', 'font-weight', 'color']);
    expect(u, `${label} の単位`).toEqual({
      'font-size': '16px',
      'font-weight': '400',
      color: GRAY,
    });
  }
  expect(
    Math.abs(boxes[0]!.y - rowBottom - 20) <= 2,
    `数の行は 1 行目の ${boxes[0]!.y - rowBottom}px 下（参照 20px ±2）`,
  ).toBe(true);
  expect(Math.abs(boxes[1]!.y - boxes[0]!.y) <= 1 && Math.abs(boxes[2]!.y - boxes[0]!.y) <= 1).toBe(
    true,
  );
  expectPx(boxes[1]!.x - (boxes[0]!.x + boxes[0]!.width), 40, '投稿とフォロワーの間');
  expectPx(boxes[2]!.x - (boxes[1]!.x + boxes[1]!.width), 40, 'フォロワーとフォロー中の間');
  await expect(countItem(page, 'フォロワー').getByRole('link')).toHaveAttribute(
    'href',
    `/${other.username}/followers`,
  );
  await expect(countItem(page, 'フォロー中').getByRole('link')).toHaveAttribute(
    'href',
    `/${other.username}/following`,
  );
});

test('375px の数の行は 3 等分で、単位が途中で折り返さない', async ({ page, me }) => {
  void me; // signed in as a viewer
  const other = otherProfile({ posts: 2 });
  await open(page, other.username, VIEWPORTS.mobile);
  const avatar = await rect(header(page).locator('[data-testid="avatar-initial"], img').first());
  expectPx(avatar.width, 77, 'アバターの幅');
  expectPx(avatar.height, 77, 'アバターの高さ');

  const head = await rect(header(page));
  const row = header(page).locator('ul');
  const rowBox = await rect(row);
  expectPx(rowBox.width, 375, '数の行の幅');
  expectPx(rowBox.y + rowBox.height, head.y + head.height, '数の行はヘッダーの下');
  const rowStyle = await styles(row, ['border-top-width', 'border-top-color']);
  expect(rowStyle).toEqual({ 'border-top-width': '1px', 'border-top-color': LINE });

  for (const label of ['投稿', 'フォロワー', 'フォロー中']) {
    const item = countItem(page, label);
    expectPx((await rect(item)).width, 125, `${label} の幅`);
    const number = await rect(item.locator(':scope > * > span').first());
    const unit = item.locator(':scope > * > span').last();
    const unitBox = await rect(unit);
    expect(unitBox.y, `${label}: 数が上、単位が下`).toBeGreaterThanOrEqual(
      number.y + number.height - 1,
    );
    const { 'line-height': line } = await styles(unit, ['line-height']);
    expect(unitBox.height, `${label} の単位は 1 行（${unitBox.height}px）`).toBeLessThanOrEqual(
      px(line) + 1,
    );
  }
});

test('768px 以上の右の区画は、画面の右端から 16px 空く', async ({ page, me }) => {
  void me;
  const other = otherProfile({ posts: 1, bio: 'とても長い自己紹介です。'.repeat(12) });
  await open(page, other.username, { width: 900, height: 800 });
  const head = await rect(header(page));
  const right = head.x + head.width;
  const rows = [
    header(page).locator('> div').nth(1),
    header(page).locator('> ul'),
    header(page).locator('> div').nth(2),
  ];
  for (const [i, row] of rows.entries()) {
    // The row is a grid item that stretches to the column edge, so its padding is inside the box:
    // the content edge is the border box's right edge minus the right padding.
    const edge = await row.evaluate(
      (el) =>
        el.getBoundingClientRect().right - Number.parseFloat(getComputedStyle(el).paddingRight),
    );
    expect(
      edge <= right - 16 + 0.5,
      `${i + 1} 番目の行の内容の右端は ${edge}px（ヘッダーの右端 ${right}px − 16px 以下）`,
    ).toBe(true);
  }
  // The text itself: the right edge of the longest line of the bio.
  const textRight = await rows[2]!
    .locator('p')
    .last()
    .evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return Math.max(...Array.from(range.getClientRects()).map((r) => r.right));
    });
  expect(
    textRight <= right - 16 + 0.5,
    `自己紹介の文字の右端は ${textRight}px（ヘッダーの右端 ${right}px − 16px 以下）`,
  ).toBe(true);
});

test('表示名は自己紹介の先頭に 600 で出る', async ({ page, me }) => {
  void me; // signed in as a viewer
  const other = otherProfile({ posts: 1 });
  for (const viewport of [VIEWPORTS.mobile, VIEWPORTS.wide]) {
    await open(page, other.username, viewport);
    const at = `${viewport.width}px`;
    const displayName = header(page).getByText('表示 名前', { exact: true });
    const body = header(page).getByText('ひとこと目', { exact: false });
    expect(await styles(displayName, ['font-size', 'font-weight']), `${at} 表示名`).toEqual({
      'font-size': '14px',
      'font-weight': '600',
    });
    expect(await styles(body, ['font-size', 'line-height']), `${at} 本文`).toEqual({
      'font-size': '14px',
      'line-height': '18px',
    });
    const nameBox = await rect(displayName);
    const bodyBox = await rect(body);
    expect(bodyBox.y, `${at} 表示名が先頭`).toBeGreaterThanOrEqual(nameBox.y + nameBox.height - 1);
  }
});

test('タブはアイコンだけで、今のタブは下の 2px の線', async ({ page, me }) => {
  insertPost({ authorUsername: me.username });
  for (const viewport of [VIEWPORTS.mobile, VIEWPORTS.wide]) {
    await open(page, me.username, viewport);
    const at = `${viewport.width}px`;
    const list = page.getByRole('tablist');
    const listBox = await rect(list);
    expectPx(listBox.height, 45, `${at} タブの列の高さ`);
    expect(await styles(list, ['border-bottom-width', 'border-bottom-color'])).toEqual({
      'border-bottom-width': '1px',
      'border-bottom-color': LINE,
    });
    const posts = page.getByRole('tab', { name: '投稿', exact: true });
    const saved = page.getByRole('tab', { name: '保存済み', exact: true });
    for (const tab of [posts, saved]) {
      await expect(tab).toHaveText('');
      const svg = await rect(tab.locator('svg'));
      expectPx(svg.width, 24, `${at} アイコンの幅`);
      expectPx(svg.height, 24, `${at} アイコンの高さ`);
    }
    const a = await rect(posts);
    const b = await rect(saved);
    if (viewport.width >= 768) {
      expectPx(a.width, 64, `${at} タブの幅`);
      expectPx(a.height, 44, `${at} タブの高さ`);
      expectPx(b.x - (a.x + a.width), 60, `${at} タブの間`);
      expectPx((a.x + b.x + b.width) / 2, listBox.x + listBox.width / 2, `${at} タブは中央`);
    } else {
      expectPx(a.width, listBox.width / 2, `${at} 投稿のタブの幅`);
      expectPx(b.width, listBox.width / 2, `${at} 保存済みのタブの幅`);
    }
    expect(await styles(posts, ['border-bottom-width', 'border-bottom-color'])).toEqual({
      'border-bottom-width': '2px',
      'border-bottom-color': BLACK,
    });
    expect((await styles(posts.locator('svg'), ['color'])).color).toBe(BLACK);
    expect((await styles(saved.locator('svg'), ['color'])).color).toBe(GRAY);
    expect((await styles(saved, ['border-bottom-color']))['border-bottom-color']).not.toBe(BLACK);
  }
});

async function expectGrid(page: Page, viewport: { width: number; height: number }) {
  const at = `${viewport.width}px`;
  const column = viewport.width >= 768 ? 935 : viewport.width;
  const tile = (column - 2) / 3;
  await expect(tiles(page)).toHaveCount(12);
  const boxes = [];
  for (let i = 0; i < 12; i++) boxes.push(await rect(tiles(page).nth(i)));
  expect(new Set(boxes.map((b) => Math.round(b.x))).size, `${at} 列の数`).toBe(3);
  for (const box of boxes) {
    expectPx(box.width, tile, 'タイルの幅');
    expectPx(box.height, (tile * 4) / 3, 'タイルの高さ');
  }
  expectPx(boxes[1]!.x - (boxes[0]!.x + boxes[0]!.width), 1, `${at} 横の隙間`);
  expectPx(boxes[3]!.y - (boxes[0]!.y + boxes[0]!.height), 1, `${at} 縦の隙間`);
  expect(
    await styles(tiles(page).first(), ['background-color']),
    `${at} 写真の無い所の背景`,
  ).toEqual({ 'background-color': HIGHLIGHT });
  expect((await styles(tiles(page).first().locator('img'), ['object-fit']))['object-fit']).toBe(
    'cover',
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${at} の横スクロール`).toBeLessThanOrEqual(0);
}

test('グリッドは 3:4 のタイルが 1px の隙間で並ぶ', async ({ page, me }) => {
  void me; // signed in as a viewer
  const other = otherProfile({ posts: 12 });
  await open(page, other.username, VIEWPORTS.wide);
  await expectGrid(page, VIEWPORTS.wide);
  await open(page, other.username, VIEWPORTS.mobile);
  await expectGrid(page, VIEWPORTS.mobile);
});

test('複数枚の印は右上 8px の白いアイコンで、枚数は名前に残る', async ({ page, me }) => {
  void me; // signed in as a viewer
  const other = otherProfile({ posts: 1, threePhotos: true });
  await open(page, other.username, VIEWPORTS.wide);
  const tile = tiles(page).and(page.locator(`a[href="/p/${other.three}"]`));
  const mark = tile.getByRole('img', { name: '3 枚の写真' });
  await expect(mark).toBeVisible();
  await expect(mark).toHaveText('');
  const tileBox = await rect(tile);
  const icon = mark.locator('svg');
  const iconBox = await rect(icon);
  expectPx(iconBox.width, 20, '印の幅');
  expectPx(iconBox.height, 20, '印の高さ');
  expectPx(tileBox.x + tileBox.width - (iconBox.x + iconBox.width), 8, '右から');
  expectPx(iconBox.y - tileBox.y, 8, '上から');
  expect((await styles(icon, ['color'])).color).toBe('rgb(255, 255, 255)');
  await expect(
    tiles(page)
      .and(page.locator(`a[href="/p/${other.ids[0]}"]`))
      .getByRole('img', {
        name: /枚の写真/,
      }),
  ).toHaveCount(0);
});

const interactive = (page: Page): Locator =>
  wide(page).locator('a:visible, button:visible, [role="tab"]:visible');

test('プロフィールに axe の重大な違反が無く、操作できる要素は 44px 以上', async ({ page, me }) => {
  insertPost({ authorUsername: me.username });
  const other = otherProfile({ posts: 4, threePhotos: true });
  const targets = [
    { name: '自分', username: me.username },
    { name: '他人', username: other.username },
  ];
  for (const viewport of Object.values(VIEWPORTS)) {
    for (const target of targets) {
      await open(page, target.username, viewport);
      const label = `${viewport.width}px ${target.name}`;
      await expectNoSeriousViolations(page, label);
      const small: string[] = [];
      for (const el of await interactive(page).all()) {
        const box = await rect(el);
        if (box.width < 44 - 0.5 || box.height < 44 - 0.5) {
          small.push(
            `${(await el.getAttribute('aria-label')) ?? ((await el.textContent()) || '').trim()} ` +
              `${box.width}x${box.height}`,
          );
        }
      }
      expect(small, `${label} 44px 未満の要素`).toEqual([]);
    }
  }
});
