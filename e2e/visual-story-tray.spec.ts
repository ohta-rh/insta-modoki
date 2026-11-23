import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { test } from './support/auth';
import { expectNoSeriousViolations } from './support/axe';
import { seedFollow, seedUser, userRow } from './support/db';
import { waitForHydration } from './support/hydration';
import { tabTo } from './support/keys';
import { expectPx, rect, styles, VIEWPORTS } from './support/measure';
import { insertStory, insertStoryView } from './support/stories';

const HOUR = 3_600_000;

/** A person the signed-in user follows, with one story (seen or not). Returns the username. */
function followedWithStory(me: string, hoursAgo: number, seen = false): string {
  const username = `e2e_v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  seedUser(username, `${username}@example.com`, { displayName: '見本の人' });
  seedFollow(userRow(me)!.id as string, userRow(username)!.id as string);
  const story = insertStory({ authorUsername: username, createdAt: Date.now() - hoursAgo * HOUR });
  if (seen) insertStoryView({ storyId: story.id, viewerUsername: me });
  return username;
}

async function ownUsername(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('main').waitFor();
  const href = await page.getByRole('link', { name: 'プロフィール' }).first().getAttribute('href');
  return href!.slice(1);
}

async function openHome(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('main').waitFor();
  await waitForHydration(page);
  // The tray streams in behind a Suspense frame: wait until it is the real one.
  await expect(page.getByTestId('story-tray')).toBeVisible();
}

const tray = (page: Page) => page.getByTestId('story-tray');
const trayNav = (page: Page) => page.getByRole('navigation', { name: 'ストーリー' });
const links = (page: Page) => tray(page).getByRole('link');
const next = (page: Page) => trayNav(page).getByRole('button', { name: '次へ' });
const prev = (page: Page) => trayNav(page).getByRole('button', { name: '前へ' });
const scrollLeft = (page: Page) => tray(page).evaluate((el) => el.scrollLeft);

/** Follows `n` people with an unseen story each (the first is the newest). */
function followMany(me: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => followedWithStory(me, 1 + i * 0.01));
}

test('ストーリーの輪は外径 66px、アバター 56px、項目 80px', async ({ page }) => {
  const me = await ownUsername(page);
  const names = followMany(me, 7);
  // A long name (the tray shows the username) and one person who has seen everything.
  const long = `e2e_v${'x'.repeat(12)}${Date.now().toString(36)}`;
  seedUser(long, `${long}@example.com`, { displayName: '見本の人' });
  seedFollow(userRow(me)!.id as string, userRow(long)!.id as string);
  insertStory({ authorUsername: long, createdAt: Date.now() - 2 * HOUR });
  const seen = followedWithStory(me, 5, true);
  expect(names).toHaveLength(7);

  for (const viewport of Object.values(VIEWPORTS)) {
    await page.setViewportSize(viewport);
    await openHome(page);
    const items = links(page);
    // The add link plus nine people.
    await expect(items).toHaveCount(10);
    for (let i = 0; i < 10; i++) {
      const item = items.nth(i);
      const where = `${viewport.width}px 項目 ${i}`;
      const ring = item.locator('[data-story-ring]');
      const box = await rect(ring);
      expectPx(box.width, 66, `ストーリーの輪の幅（${where}）`);
      expectPx(box.height, 66, `ストーリーの輪の高さ（${where}）`);
      const avatar = await rect(item.locator('[data-story-avatar]'));
      expectPx(avatar.width, 56, `アバターの幅（${where}）`);
      expectPx(avatar.height, 56, `アバターの高さ（${where}）`);
      expectPx((await rect(item)).width, 80, `項目の幅（${where}）`);
      const name = item.locator('[data-story-name]');
      const text = await styles(name, [
        'font-size',
        'font-weight',
        'line-height',
        'color',
        'text-overflow',
        'white-space',
      ]);
      expect(text, `名前の文字（${where}）`).toMatchObject({
        'font-size': '12px',
        'font-weight': '400',
        'line-height': '16px',
        color: 'rgb(0, 0, 0)',
        'text-overflow': 'ellipsis',
        'white-space': 'nowrap',
      });
      expectPx((await rect(name)).height, 16, `名前は 1 行（${where}）`);
    }
  }

  // The ring: the own gradient while unseen, a 1px gray ring once everything was seen.
  await page.setViewportSize(VIEWPORTS.wide);
  await openHome(page);
  const unseenRing = links(page)
    .filter({ hasText: `${long}のストーリー（未視聴）` })
    .locator('[data-story-ring]');
  const gradient = (await styles(unseenRing, ['background-image']))['background-image'];
  expect(gradient).toContain('linear-gradient');
  expect(gradient).toContain('rgb(11, 184, 169)');
  const seenRing = links(page)
    .filter({ hasText: `${seen}のストーリー（視聴済み）` })
    .locator('[data-story-ring]');
  const seenStyle = await styles(seenRing, ['box-shadow', 'background-image']);
  expect(seenStyle['box-shadow']).toContain('rgb(219, 219, 219)');
  expect(seenStyle['box-shadow']).toContain('inset');
  expect(seenStyle['background-image']).toBe('none');
});

test('ストーリーの列は 102px で、下に 24px 空ける', async ({ page }) => {
  const me = await ownUsername(page);
  followMany(me, 8);
  for (const viewport of Object.values(VIEWPORTS)) {
    await page.setViewportSize(viewport);
    await openHome(page);
    expectPx((await rect(tray(page))).height, 102, `列の高さ（${viewport.width}px）`);
    const gap = await trayNav(page).evaluate((nav) => {
      const after = nav.nextElementSibling!.getBoundingClientRect().top;
      return after - nav.getBoundingClientRect().bottom;
    });
    expectPx(gap, 24, `列の下端と次の要素の上端の差（${viewport.width}px）`);
  }
});

test('広い画面では矢印で列を送れる', async ({ page }) => {
  const me = await ownUsername(page);
  // 15 items (the add link and 14 people) = 1200px: one step (630 - 80 = 550) stays short of the end (570).
  followMany(me, 14);
  await page.setViewportSize(VIEWPORTS.wide);
  await openHome(page);

  await expect(next(page)).toBeVisible();
  await expect(prev(page)).toHaveCount(0);
  const button = await rect(next(page));
  expectPx(button.width, 44, '「次へ」の幅');
  expectPx(button.height, 44, '「次へ」の高さ');
  const nav = await rect(trayNav(page));
  expect(button.x + button.width, '「次へ」が列の右端に重なる').toBeGreaterThan(
    nav.x + nav.width - 12,
  );
  expect(button.x + button.width).toBeLessThanOrEqual(nav.x + nav.width + 1);

  const width = await tray(page).evaluate((el) => el.clientWidth);
  await next(page).click();
  await expect.poll(() => scrollLeft(page)).toBeGreaterThanOrEqual(width - 80 - 1);
  expectPx(await scrollLeft(page), width - 80, '一度に送る幅');
  await expect(prev(page)).toBeVisible();
  await expect(next(page)).toBeVisible();

  await next(page).click();
  await expect(next(page)).toHaveCount(0);
  await expect(prev(page)).toBeVisible();
  await prev(page).click();
  await expect.poll(() => scrollLeft(page)).toBeLessThan(570 - 1);
});

test('収まるときと狭い画面では矢印を出さない', async ({ page }) => {
  const me = await ownUsername(page);
  followMany(me, 1);
  await page.setViewportSize(VIEWPORTS.wide);
  await openHome(page);
  await expect(links(page)).toHaveCount(2);
  await expect(trayNav(page).getByRole('button')).toHaveCount(0);

  followMany(me, 8);
  await page.setViewportSize(VIEWPORTS.mobile);
  await openHome(page);
  await expect(links(page)).toHaveCount(10);
  expect(await tray(page).evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await expect(trayNav(page).getByRole('button')).toHaveCount(0);
});

test('視差効果を減らす設定では矢印の送りが動かずに終わる', async ({ page }) => {
  const me = await ownUsername(page);
  followMany(me, 14);
  await page.setViewportSize(VIEWPORTS.wide);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openHome(page);
  expect((await styles(tray(page), ['scroll-behavior']))['scroll-behavior']).toBe('smooth');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHome(page);
  expect((await styles(tray(page), ['scroll-behavior']))['scroll-behavior']).toBe('auto');
  const width = await tray(page).evaluate((el) => el.clientWidth);
  await next(page).click();
  // No waiting: the move is already done when the click returns.
  expectPx(await scrollLeft(page), width - 80, '押した直後の scrollLeft');
});

test('ストーリーの列をキーボードで辿れる', async ({ page }) => {
  const me = await ownUsername(page);
  followMany(me, 14);
  await page.setViewportSize(VIEWPORTS.wide);
  await openHome(page);

  const all = links(page);
  await expect(all).toHaveCount(15);
  await expect(all.nth(0)).toHaveAccessibleName('ストーリーを追加');
  await tabTo(page, all.nth(0));
  for (let i = 1; i < 15; i++) {
    await page.keyboard.press('Tab');
    await expect(all.nth(i)).toBeFocused();
    await expect
      .poll(
        () =>
          all.nth(i).evaluate((el) => {
            const a = el.getBoundingClientRect();
            const b = el.closest('ul')!.getBoundingClientRect();
            return a.left >= b.left - 1 && a.right <= b.right + 1;
          }),
        { message: `フォーカスした項目 ${i} が列の見える範囲にある` },
      )
      .toBe(true);
    const outline = await styles(all.nth(i), ['outline-width', 'outline-style']);
    expect(parseFloat(outline['outline-width']), `輪郭の太さ（項目 ${i}）`).toBeGreaterThanOrEqual(
      2,
    );
    expect(outline['outline-style']).not.toBe('none');
  }
  // The last link took the tray to its end: "次へ" is gone and "前へ" is the next stop.
  await expect(next(page)).toHaveCount(0);
  await page.keyboard.press('Tab');
  await expect(prev(page)).toBeFocused();
  const outline = await styles(prev(page), ['outline-width']);
  expect(parseFloat(outline['outline-width'])).toBeGreaterThanOrEqual(2);
});

test('ストーリーの列に axe の重大な違反が無い', async ({ page }) => {
  const me = await ownUsername(page);
  followMany(me, 14);
  for (const viewport of Object.values(VIEWPORTS)) {
    await page.setViewportSize(viewport);
    await openHome(page);
    await expect(links(page)).toHaveCount(15);
    await expectNoSeriousViolations(page, `ホームのストーリーの列（${viewport.width}px）`);
    const targets = trayNav(page).locator('a, button');
    const count = await targets.count();
    for (let i = 0; i < count; i++) {
      const box = await rect(targets.nth(i));
      expect(box.width, `操作できる要素 ${i} の幅（${viewport.width}px）`).toBeGreaterThanOrEqual(
        44,
      );
      expect(
        box.height,
        `操作できる要素 ${i} の高さ（${viewport.width}px）`,
      ).toBeGreaterThanOrEqual(44);
    }
  }
});

test('読み込み中の枠は本物と同じ高さで、フィードが跳ねない', async ({ page }) => {
  const me = await ownUsername(page);
  followMany(me, 3);
  await page.setViewportSize(VIEWPORTS.wide);
  await openHome(page);

  const firstTop = () =>
    trayNav(page).evaluate((nav) => nav.nextElementSibling!.getBoundingClientRect().top);
  const before = await firstTop();

  // The fallback's own markup (its class list is read from the component) takes the tray's place.
  const source = readFileSync('src/features/story/ui/StoryTrayFallback.tsx', 'utf8');
  const className = /className="([^"]+)"/.exec(source)?.[1];
  expect(className, 'StoryTrayFallback の className').toBeTruthy();
  const frame = await page.evaluate((cls) => {
    const nav = document.querySelector('nav[aria-label="ストーリー"]')!;
    const el = document.createElement('div');
    el.className = cls;
    nav.replaceWith(el);
    const box = el.getBoundingClientRect();
    return {
      height: box.height,
      margin: parseFloat(getComputedStyle(el).marginBottom),
      next: el.nextElementSibling!.getBoundingClientRect().top - box.bottom,
      top: el.nextElementSibling!.getBoundingClientRect().top,
    };
  }, className!);
  expectPx(frame.height, 102, '読み込み中の枠の高さ');
  expectPx(frame.margin, 24, '読み込み中の枠の下の余白');
  expectPx(frame.top, before, '差し替えの前後で最初のカードの上端が同じ');
});
