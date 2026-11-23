import type { Page } from '@playwright/test';
import { expect, test } from './support/auth';

const SIDE_LABELS = ['ホーム', '検索', '発見', '投稿', '通知', 'プロフィール'];
const TAB_LABELS = ['ホーム', '発見', '投稿', '通知', 'プロフィール'];
const side = (page: Page) => page.locator('nav[data-nav="side"]');
const bottom = (page: Page) => page.locator('nav[data-nav="bottom"]');

test('375px では下部ナビの 5 項目が見えて、サイドナビは見えない', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'メイン' });
  await expect(nav).toHaveCount(1);
  await expect(bottom(page)).toBeVisible();
  for (const label of TAB_LABELS)
    await expect(bottom(page).getByRole('link', { name: label })).toBeVisible();
  await expect(side(page)).toBeHidden();
});

test('768px では左サイドナビが見えて、下部ナビは見えない', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto('/');
  await expect(side(page)).toBeVisible();
  for (const label of SIDE_LABELS)
    await expect(side(page).getByRole('link', { name: label })).toBeVisible();
  await expect(side(page).locator('svg').first()).toBeVisible();
  await expect(bottom(page)).toBeHidden();
});

test('767px では下部ナビが見える', async ({ page }) => {
  await page.setViewportSize({ width: 767, height: 800 });
  await page.goto('/');
  await expect(bottom(page)).toBeVisible();
  await expect(side(page)).toBeHidden();
});

for (const width of [375, 768, 1280]) {
  test(`Tab で本文へ移動とナビの項目に順に移り、Enter で移動できる (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'メイン' });
    if (width === 375) await page.getByRole('link', { name: 'ストーリーを追加' }).waitFor();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: '本文へ移動' })).toBeFocused();
    if (width === 375) {
      // The top bar's その他 comes first; the bottom nav follows the main region, whose first stop
      // on the home is the story tray's add button.
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'その他' })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: 'ストーリーを追加' })).toBeFocused();
    }
    for (const label of width === 375 ? TAB_LABELS : SIDE_LABELS) {
      await page.keyboard.press('Tab');
      await expect(nav.getByRole('link', { name: label })).toBeFocused();
    }
    if (width !== 375) {
      await page.keyboard.press('Tab');
      await expect(nav.getByRole('button', { name: 'その他' })).toBeFocused();
    }
    // Back to a screen-changing item and Enter: 発見 on both (the side nav's 検索 opens a panel, #95).
    const back = width === 375 ? 3 : 4;
    for (let i = 0; i < back; i += 1) await page.keyboard.press('Shift+Tab');
    await expect(nav.getByRole('link', { name: '発見' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/explore$/);
  });
}

test('フォーカスの輪郭が 2px 以上', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  // The tray renders after the page; Tab only reaches its add button once it is there.
  await page.getByRole('link', { name: 'ストーリーを追加' }).waitFor();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: '本文へ移動' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'その他' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'ストーリーを追加' })).toBeFocused();
  await page.keyboard.press('Tab');
  const link = bottom(page).getByRole('link', { name: 'ホーム' });
  await expect(link).toBeFocused();
  const width = await link.evaluate((el) => parseFloat(getComputedStyle(el).outlineWidth));
  expect(width).toBeGreaterThanOrEqual(2);
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  const skip = page.getByRole('link', { name: '本文へ移動' });
  await expect(skip).toBeFocused();
  expect(
    await skip.evaluate((el) => parseFloat(getComputedStyle(el).outlineWidth)),
  ).toBeGreaterThanOrEqual(2);
});

test('現在のパスの項目だけが aria-current="page"', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await expect(bottom(page).locator('[aria-current="page"]')).toHaveText('ホーム');
  await expect(bottom(page).locator('[aria-current="page"]')).toHaveCount(1);
  await bottom(page).getByRole('link', { name: '発見' }).click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(bottom(page).locator('[aria-current="page"]')).toHaveText('発見');
  await expect(bottom(page).locator('[aria-current="page"]')).toHaveCount(1);
  // Below /explore the 発見 tab stays current; the search screen has no tab (検索 is a side item).
  await page.goto('/explore/tags/a');
  await expect(bottom(page).locator('[aria-current="page"]')).toHaveText('発見');

  // The side nav at 768px: on the search screen (opened by its link; the nav's 検索 opens a panel,
  // #95) only 検索 is current.
  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto('/explore/search');
  await expect(side(page).locator('[aria-current="page"]')).toHaveText('検索');
  await expect(side(page).locator('[aria-current="page"]')).toHaveCount(1);
  await side(page).getByRole('link', { name: '発見' }).click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(side(page).locator('[aria-current="page"]')).toHaveText('発見');
});

for (const width of [375, 768, 1280]) {
  test(`ナビの全ての項目が 44×44px 以上 (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const links = (width === 375 ? bottom(page) : side(page)).locator('a, button');
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < count; i += 1) {
      const box = await links.nth(i).boundingBox();
      expect(box?.width, `item ${i} width`).toBeGreaterThanOrEqual(44);
      expect(box?.height, `item ${i} height`).toBeGreaterThanOrEqual(44);
    }
  });
}

test.describe('視差効果を減らす設定', () => {
  test.use({ reducedMotion: 'reduce' });
  test('視差効果を減らす設定のとき、トランジションの長さが 0 秒', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    const motion = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--motion-fast').trim(),
    );
    // The build minifies 0ms to 0s; both are zero.
    expect(motion).toMatch(/^0(ms|s)$/);
    const duration = await bottom(page)
      .getByRole('link')
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duration).toBe('0s');
  });
});

test('フッターに非公式の表記が出る', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('contentinfo')).toHaveText(
    '学習目的の非公式プロジェクトです。Meta 社とは関係ありません。',
  );
});

test('ページを開いたとき外部オリジンへの通信が 0 件', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const external: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:'))
      external.push(url);
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(external).toEqual([]);
});

test('404 の画面もナビつきで、nonce つきの CSP を持ち、コンソールのエラーが 0 件', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    // The browser logs the 404 document itself as a failed resource; that is not an app error.
    if (
      message.type() === 'error' &&
      !message.location().url.endsWith('/this-page-does-not-exist')
    ) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));

  const response = await page.goto('/this-page-does-not-exist');
  expect(response?.status()).toBe(404);
  expect(response?.headers()['content-security-policy']).toMatch(/'nonce-[^']+'/);
  await expect(page.locator('nav[data-nav="side"], nav[data-nav="bottom"]').first()).toBeAttached();
  await page.waitForLoadState('networkidle');
  expect(errors).toEqual([]);
});
