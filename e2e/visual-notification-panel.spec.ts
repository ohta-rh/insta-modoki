import type { Locator, Page } from '@playwright/test';
import { expect, freshUser as test, type NewUser } from './support/auth';
import { expectNoSeriousViolations } from './support/axe';
import { seedFollowers, seedUser, unreadNotificationCount, userRow } from './support/db';
import { harness } from './support/harness';
import { waitForHydration } from './support/hydration';
import { expectPx, rect, styles, VIEWPORTS } from './support/measure';
import { insertPost, putPostFiles } from './support/posts';

const DAY = 24 * 3_600_000;
const side = (page: Page) => page.locator('nav[data-nav="side"]');
const bell = (page: Page, name: string | RegExp = /^通知/) =>
  side(page).getByRole('link', { name });
const panel = (page: Page) => page.getByRole('dialog', { name: '通知' });

const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const idOf = (username: string) => userRow(username)!.id as string;

/** Three unread notifications for `me`: today (a like on a post), 3 days ago and 40 days ago (follows). */
async function seedThree(page: Page, me: NewUser) {
  const s = stamp();
  const actors = ['a', 'b', 'c'].map((k) => `e2e_p${k}${s}`);
  actors.forEach((u) => seedUser(u, `${u}@example.com`, { displayName: `相手${u.slice(5, 6)}` }));
  const post = insertPost({ authorUsername: me.username, caption: '写真' });
  await putPostFiles(page, post);
  const now = Date.now();
  const meId = idOf(me.username);
  harness({
    op: 'seedNotification',
    recipientId: meId,
    actorId: idOf(actors[0]!),
    type: 'like',
    postId: post.id,
    createdAt: now - 60_000,
  });
  harness({
    op: 'seedNotification',
    recipientId: meId,
    actorId: idOf(actors[1]!),
    type: 'follow',
    createdAt: now - 3 * DAY,
  });
  harness({
    op: 'seedNotification',
    recipientId: meId,
    actorId: idOf(actors[2]!),
    type: 'follow',
    createdAt: now - 40 * DAY,
  });
  return { post, actors };
}

async function openHome(
  page: Page,
  viewport: { width: number; height: number } = VIEWPORTS.wide,
  path = '/',
) {
  await page.setViewportSize(viewport);
  await page.goto(path);
  await waitForHydration(page);
}

async function openPanel(page: Page, name: string | RegExp = /^通知/) {
  await bell(page, name).click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page)).toHaveCSS('translate', 'none');
}

test('通知のパネルは期間の見出しで区切って出る', async ({ page, me }) => {
  await seedThree(page, me);
  await openHome(page);
  await openPanel(page, '通知（未読 3 件）');
  await expect(page).toHaveURL('/');
  const box = await rect(panel(page));
  expectPx(box.x, 72, 'パネルの左端');
  expectPx(box.width, 397, 'パネルの幅');
  expectPx(box.height, VIEWPORTS.wide.height, 'パネルの高さ');
  const title = panel(page).getByRole('heading', { level: 2, name: '通知' });
  expect(await styles(title, ['font-size', 'font-weight'])).toEqual({
    'font-size': '24px',
    'font-weight': '700',
  });
  const headings = panel(page).getByRole('heading', { level: 3 });
  await expect(headings).toHaveText(['今日', '今週', 'それ以前']);
  for (const h of await headings.all()) {
    expect(await styles(h, ['font-size', 'font-weight'])).toEqual({
      'font-size': '16px',
      'font-weight': '700',
    });
  }
  await expect(panel(page).getByRole('heading', { name: '今月' })).toHaveCount(0);
  for (const name of ['今日', '今週', 'それ以前']) {
    await expect(panel(page).getByRole('region', { name }).getByRole('link')).toHaveCount(1);
  }
});

test('パネルを開くと既読になり、バッジが消える', async ({ page, me }) => {
  await seedThree(page, me);
  await openHome(page);
  expect(unreadNotificationCount(me.username)).toBe(3);
  await openPanel(page, '通知（未読 3 件）');
  await expect(bell(page, '通知')).toBeVisible();
  await expect.poll(() => unreadNotificationCount(me.username)).toBe(0);
});

test('パネルを開かなければ既読にしない', async ({ page, me }) => {
  await seedThree(page, me);
  await openHome(page);
  await expect(bell(page, '通知（未読 3 件）')).toBeVisible();
  await expect(panel(page)).toBeHidden();
  expect(unreadNotificationCount(me.username)).toBe(3);
});

test('通知の行は 44px のアバターと写真で、押すと移ってパネルが閉じる', async ({ page, me }) => {
  const { post } = await seedThree(page, me);
  await openHome(page);
  await openPanel(page, '通知（未読 3 件）');
  const row = panel(page).getByRole('link', { name: /さんがあなたの投稿にいいねしました/ });
  await expect(row).toHaveCount(1);
  const avatar: Locator = row.locator('> :first-child');
  const a = await rect(avatar);
  expectPx(a.width, 44, 'アバターの幅');
  expectPx(a.height, 44, 'アバターの高さ');
  const photo = row.locator('img[sizes="44px"]');
  const p = await rect(photo);
  expectPx(p.width, 44, '写真の幅');
  expectPx(p.height, 44, '写真の高さ');
  expect((await rect(row)).height).toBeGreaterThanOrEqual(44);
  const text = row.locator('span.flex-1 > span').first();
  expect((await styles(text, ['font-size']))['font-size']).toBe('14px');
  expect((await styles(text.locator('span').first(), ['font-weight']))['font-weight']).toBe('600');
  expect((await styles(row.locator('time'), ['color'])).color).toBe('rgb(115, 115, 115)');
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/p/${post.id}`));
  await expect(panel(page)).toBeHidden();
});

test('パネルでも 21 件目を読み込める', async ({ page, me }) => {
  const followers = seedFollowers(idOf(me.username), 21);
  const now = Date.now();
  followers.forEach((u, i) =>
    harness({
      op: 'seedNotification',
      recipientId: idOf(me.username),
      actorId: idOf(u),
      type: 'follow',
      createdAt: now - i * 1000,
    }),
  );
  await openHome(page);
  await openPanel(page);
  const links = panel(page).getByRole('link');
  await expect(links).toHaveCount(20);
  await panel(page).getByRole('button', { name: 'さらに表示' }).click();
  await expect(links).toHaveCount(21);
});

test('読み込みに失敗したら理由とやり直しのボタンを出す', async ({ page, me }) => {
  await seedThree(page, me);
  await openHome(page);
  let fail = true;
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/*', async (route) => {
    const req = route.request();
    if (req.method() === 'POST' && req.headers()['next-action'] !== undefined) {
      if (fail) {
        await gate;
        await route.fulfill({ status: 500, body: 'boom' });
        return;
      }
    }
    await route.continue();
  });
  await bell(page, '通知（未読 3 件）').click();
  await expect(panel(page).getByRole('status')).toHaveText('読み込み中');
  release();
  const alert = panel(page).getByRole('alert');
  await expect(alert).toContainText('通知を読み込めませんでした');
  expect(unreadNotificationCount(me.username)).toBe(3);
  fail = false;
  await alert.getByRole('button', { name: 'もう一度読み込む' }).click();
  await expect(panel(page).getByRole('heading', { level: 3, name: '今日' })).toBeVisible();
  await expect(panel(page).getByRole('alert')).toHaveCount(0);
});

test('通知のページも期間で区切り、狭い画面ではページに移る', async ({ page, me }) => {
  await seedThree(page, me);
  await openHome(page, VIEWPORTS.wide, '/notifications');
  await expect(page.getByRole('heading', { level: 1, name: '通知' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3 })).toHaveText(['今日', '今週', 'それ以前']);
  await expect(panel(page)).toHaveCount(0);
  await expect.poll(() => unreadNotificationCount(me.username)).toBe(0);

  await openHome(page, VIEWPORTS.mobile);
  await page
    .locator('nav[data-nav="bottom"]')
    .getByRole('link', { name: '通知', exact: true })
    .click();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(page.getByRole('heading', { level: 3, name: '今日' })).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
});

for (const viewport of [VIEWPORTS.wide, VIEWPORTS.narrow]) {
  test(`通知のパネルに axe の重大な違反が無く、Esc で閉じてフォーカスが戻る (${viewport.width}px)`, async ({
    page,
    me,
  }) => {
    await seedThree(page, me);
    await openHome(page, viewport);
    await openPanel(page, '通知（未読 3 件）');
    await expect(panel(page).getByRole('heading', { level: 3, name: '今日' })).toBeVisible();
    await expectNoSeriousViolations(page, `通知のパネル ${viewport.width}px`);
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();
    await expect(bell(page, /^通知/)).toBeFocused();
  });
}
