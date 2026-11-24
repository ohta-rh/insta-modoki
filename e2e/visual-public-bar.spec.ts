import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { signedIn } from './support/auth';
import { expectNoSeriousViolations } from './support/axe';
import { seedUser } from './support/db';
import { waitForHydration } from './support/hydration';
import { tabTo } from './support/keys';
import { expectPx, rect, styles, VIEWPORTS } from './support/measure';
import { insertPost } from './support/posts';

const LINE = 'rgb(219, 219, 219)';
const bar = (page: Page) => page.locator('header[data-public-bar]');
const inner = (page: Page) => bar(page).locator('> div');
const side = (page: Page) => page.locator('nav[data-nav="side"]');
const bottom = (page: Page) => page.locator('nav[data-nav="bottom"]');

/** A profile with one post, opened by a visitor who is not logged in. */
function publicProfile() {
  const username = `e2e_pb${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  seedUser(username, `${username}@example.com`, { displayName: '公開 ユーザー', bio: 'ひとこと' });
  const post = insertPost({ authorUsername: username, createdAt: Date.now() - 3_600_000 });
  return { username, postId: post.id };
}

const open = async (page: Page, viewport: { width: number; height: number }, path: string) => {
  await page.setViewportSize(viewport);
  await page.goto(path);
  await waitForHydration(page);
};

test('ログインしていない人の公開ページは 60px の上部バーで、ナビを出さない', async ({ page }) => {
  const { username } = publicProfile();
  for (const [viewport, innerWidth] of [
    [VIEWPORTS.wide, 935],
    [VIEWPORTS.narrow, 935],
    [VIEWPORTS.mobile, 343],
  ] as const) {
    await open(page, viewport, `/${username}`);
    const at = `${viewport.width}px`;
    await expect(bar(page)).toBeVisible();
    expectPx((await rect(bar(page))).height, 60, `${at} バーの高さ`);
    expectPx((await rect(inner(page))).width - 32, innerWidth, `${at} 内側の幅（余白を除く）`);
    await expect(side(page)).toHaveCount(0);
    await expect(bottom(page)).toHaveCount(0);
    await expect(page.locator('header[data-shell-top-bar]')).toHaveCount(0);
    if (viewport.width !== 1280) continue;
    const s = await styles(bar(page), [
      'position',
      'top',
      'border-bottom-width',
      'border-bottom-color',
    ]);
    expect(s['position']).toBe('fixed');
    expect(s['border-bottom-width']).toBe('1px');
    expect(s['border-bottom-color']).toBe(LINE);
    // The content is centred: the same left and right space around it.
    const box = await rect(inner(page));
    expectPx(box.x, (viewport.width - box.width) / 2, '内側が中央');
    const logo = bar(page).getByRole('link', { name: /ホーム/ });
    await expect(logo.getByRole('img', { name: /（仮称）/ })).toBeVisible();
    expect((await rect(logo.locator('svg'))).height).toBeLessThanOrEqual(29);
    const login = bar(page).getByRole('link', { name: 'ログイン', exact: true });
    const signup = bar(page).getByRole('link', { name: '新しいアカウントを作成' });
    await expect(login).toHaveAttribute('href', '/accounts/login');
    await expect(signup).toHaveAttribute('href', '/accounts/signup');
    expect((await styles(login, ['background-color', 'color']))['background-color']).toBe(
      'rgb(79, 70, 200)',
    );
    expect((await styles(signup, ['background-color']))['background-color']).toBe(
      'rgba(0, 0, 0, 0)',
    );
    expect((await rect(login)).x).toBeLessThan((await rect(signup)).x);
    // Fixed: after a scroll the bar is still at the top.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(bar(page)).toBeVisible();
    expect((await rect(bar(page))).y).toBe(0);
  }
});

test('投稿と 404 もバーの下から本文が始まる', async ({ page }) => {
  const { postId } = publicProfile();
  for (const viewport of [VIEWPORTS.wide, VIEWPORTS.mobile]) {
    for (const path of [`/p/${postId}`, '/this-page-does-not-exist']) {
      await open(page, viewport, path);
      const at = `${viewport.width}px ${path}`;
      await expect(bar(page), at).toBeVisible();
      expectPx((await rect(bar(page))).height, 60, `${at} バーの高さ`);
      await expect(side(page)).toHaveCount(0);
      await expect(bottom(page)).toHaveCount(0);
      const main = await rect(page.locator('main#main'));
      expect(main.y, `${at} main の上端`).toBeGreaterThanOrEqual(59);
    }
  }
});

signedIn('ログインしている人には公開の上部バーを出さない', async ({ page }) => {
  const { username } = publicProfile();
  await open(page, VIEWPORTS.wide, `/${username}`);
  await expect(bar(page)).toHaveCount(0);
  expectPx((await rect(side(page))).width, 244, 'サイドナビの幅');
  await open(page, VIEWPORTS.mobile, `/${username}`);
  await expect(bar(page)).toHaveCount(0);
  expectPx((await rect(page.locator('header[data-shell-top-bar]'))).height, 45, '上部バーの高さ');
  await expect(bottom(page)).toBeVisible();
});

test('上部バーをキーボードで辿れる', async ({ page }) => {
  const { username } = publicProfile();
  await open(page, VIEWPORTS.wide, `/${username}`);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '本文へ移動' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(bar(page).getByRole('link', { name: /ホーム/ })).toBeFocused();
  await page.keyboard.press('Tab');
  const login = bar(page).getByRole('link', { name: 'ログイン', exact: true });
  await expect(login).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(bar(page).getByRole('link', { name: '新しいアカウントを作成' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await tabTo(page, login);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/accounts\/login$/);
});

test('上部バーに axe の重大な違反が無く、操作できる要素は 44px 以上', async ({ page }) => {
  const { username } = publicProfile();
  for (const viewport of [VIEWPORTS.mobile, VIEWPORTS.narrow, VIEWPORTS.wide]) {
    await open(page, viewport, `/${username}`);
    await expectNoSeriousViolations(page, `${viewport.width}px の公開プロフィール`);
    const items = bar(page).locator('a, button');
    const count = await items.count();
    expect(count).toBe(3);
    for (let i = 0; i < count; i += 1) {
      const box = await rect(items.nth(i));
      expect(box.width, `${viewport.width}px 要素 ${i} の幅`).toBeGreaterThanOrEqual(44);
      expect(box.height, `${viewport.width}px 要素 ${i} の高さ`).toBeGreaterThanOrEqual(44);
    }
  }
});
