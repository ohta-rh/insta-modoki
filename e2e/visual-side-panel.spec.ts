import type { Page } from '@playwright/test';
import { expect, signedIn as test } from './support/auth';
import { expectNoSeriousViolations } from './support/axe';
import { seedUser } from './support/db';
import { holdScripts, waitForHydration } from './support/hydration';
import { expectPx, rect, styles, VIEWPORTS } from './support/measure';

const side = (page: Page) => page.locator('nav[data-nav="side"]');
const searchItem = (page: Page) => side(page).getByRole('link', { name: '検索' });
const panel = (page: Page) => page.getByRole('dialog', { name: '検索' });
const input = (page: Page) => panel(page).getByRole('combobox', { name: /検索/ });

/** A random lower-case prefix, so a run only sees the users it made itself. */
const prefix = () => `e2ep${Math.random().toString(36).slice(2, 7)}`;

async function open(page: Page, viewport: { width: number; height: number }, path = '/') {
  await page.setViewportSize(viewport);
  await page.goto(path);
  await waitForHydration(page);
}

async function openPanel(page: Page, viewport: { width: number; height: number }) {
  await open(page, viewport);
  await searchItem(page).click();
  await expect(panel(page)).toBeVisible();
  // Measure once the slide is over.
  await expect(panel(page)).toHaveCSS('translate', 'none');
}

test('1280px で検索を押すとナビが畳まれ、397px のパネルが出る', async ({ page }) => {
  await open(page, VIEWPORTS.wide);
  expectPx((await rect(side(page))).width, 244, '開く前のナビの幅');
  await searchItem(page).click();
  await expect(page).toHaveURL('/');
  await expect(panel(page)).toBeVisible();
  await expect(panel(page)).toHaveCSS('translate', 'none');
  await expect(searchItem(page)).toHaveAttribute('aria-expanded', 'true');
  expectPx((await rect(side(page))).width, 72, 'ナビの幅');
  const box = await rect(panel(page));
  expectPx(box.x, 72, 'パネルの左端');
  expectPx(box.width, 397, 'パネルの幅');
  expectPx(box.height, VIEWPORTS.wide.height, 'パネルの高さ');
  const s = await styles(panel(page), [
    'border-top-right-radius',
    'border-bottom-right-radius',
    'box-shadow',
  ]);
  expect(s['border-top-right-radius']).toBe('16px');
  expect(s['border-bottom-right-radius']).toBe('16px');
  expect(s['box-shadow']).toBe('rgba(11, 16, 20, 0.16) 0px 4px 32px 0px');
});

test('1024px でも同じパネルがナビの右に出る', async ({ page }) => {
  await open(page, VIEWPORTS.narrow);
  await searchItem(page).click();
  await expect(page).toHaveURL('/');
  await expect(panel(page)).toBeVisible();
  await expect(panel(page)).toHaveCSS('translate', 'none');
  expectPx((await rect(panel(page))).x, 72, 'パネルの左端');
  expectPx((await rect(side(page))).width, 72, 'ナビの幅');
});

test('パネルの入力にフォーカスが移り、候補からプロフィールへ移れる', async ({ page }) => {
  const p = prefix();
  const username = `${p}_hana`;
  seedUser(username, `${username}@example.com`, { displayName: 'Hana' });
  await openPanel(page, VIEWPORTS.wide);
  await expect(input(page)).toBeFocused();
  const heading = panel(page).getByRole('heading', { name: '検索' });
  expect(await styles(heading, ['font-size', 'font-weight'])).toEqual({
    'font-size': '24px',
    'font-weight': '700',
  });
  const s = await styles(input(page), ['background-color', 'border-radius']);
  expect(s['background-color']).toBe('rgb(239, 239, 239)');
  expect(s['border-radius']).toBe('8px');
  expectPx((await rect(input(page))).height, 44, '入力の高さ');
  await input(page).fill(`${p}_ha`);
  const option = panel(page).getByRole('option');
  await expect(option).toHaveCount(1);
  await option.click();
  await expect(page).toHaveURL(new RegExp(`/${username}$`));
  await expect(panel(page)).toBeHidden();
});

test('パネルで Enter を押すと検索の結果のページに移る', async ({ page }) => {
  const p = prefix();
  await openPanel(page, VIEWPORTS.wide);
  await input(page).fill(p);
  await input(page).press('Enter');
  await expect(page).toHaveURL(`/explore/search?q=${p}`);
  await expect(panel(page)).toBeHidden();
  await expect(page.getByRole('main').getByRole('combobox')).toBeVisible();
});

test('Esc・外・同じ項目でパネルが閉じ、フォーカスが戻る', async ({ page }) => {
  await openPanel(page, VIEWPORTS.wide);
  // Esc
  await page.keyboard.press('Escape');
  await expect(panel(page)).toBeHidden();
  await expect(searchItem(page)).toBeFocused();
  await expect(searchItem(page)).toHaveAttribute('aria-expanded', 'false');
  expectPx((await rect(side(page))).width, 244, 'ナビの幅');
  // Outside (the main area)
  await searchItem(page).click();
  await expect(panel(page)).toBeVisible();
  await page.mouse.click(VIEWPORTS.wide.width - 40, VIEWPORTS.wide.height - 40);
  await expect(panel(page)).toBeHidden();
  await expect(searchItem(page)).toHaveAttribute('aria-expanded', 'false');
  expectPx((await rect(side(page))).width, 244, 'ナビの幅');
  // The same item again
  await searchItem(page).click();
  await expect(panel(page)).toBeVisible();
  await searchItem(page).click();
  await expect(panel(page)).toBeHidden();
  await expect(searchItem(page)).toBeFocused();
  await expect(searchItem(page)).toHaveAttribute('aria-expanded', 'false');
  expectPx((await rect(side(page))).width, 244, 'ナビの幅');
});

test('狭い画面ではパネルを出さずに検索のページへ移る', async ({ page }) => {
  await open(page, VIEWPORTS.mobile);
  await page
    .locator('nav[data-nav="bottom"]')
    .getByRole('link', { name: '発見', exact: true })
    .click();
  await expect(page).toHaveURL(/\/explore$/);
  await page.getByRole('link', { name: 'ユーザーを検索' }).click();
  await expect(page).toHaveURL(/\/explore\/search$/);
  await expect(panel(page)).toHaveCount(0);
});

test('スクリプトの前と直接のリンクでは検索のページが開く', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.wide);
  const release = await holdScripts(page);
  await page.goto('/', { waitUntil: 'commit' });
  const item = searchItem(page);
  await item.waitFor();
  // Held stylesheets can block "stable": press without waiting for it.
  await item.click({ force: true });
  await expect(page).toHaveURL(/\/explore\/search$/);
  release();
  await page.goto('/explore/search');
  await waitForHydration(page);
  await expect(page.getByRole('main').getByRole('combobox')).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
});

test('パネルの動きは 200ms で、視差効果を減らす設定では動かない', async ({ page }) => {
  await open(page, VIEWPORTS.wide);
  await searchItem(page).click();
  const el = panel(page);
  await expect(el).toBeVisible();
  const t = await styles(el, [
    'transition-property',
    'transition-duration',
    'transition-timing-function',
  ]);
  expect(t['transition-property']).toContain('transform');
  expect(t['transition-duration']).toBe('0.2s');
  expect(t['transition-timing-function']).toBe('cubic-bezier(0.17, 0.17, 0, 1)');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect((await styles(el, ['transition-duration']))['transition-duration']).toBe('0s');
});

for (const viewport of [VIEWPORTS.wide, VIEWPORTS.narrow]) {
  test(`パネルに axe の重大な違反が無く、キーボードで出入りできる (${viewport.width}px)`, async ({
    page,
  }) => {
    await open(page, viewport);
    await searchItem(page).focus();
    await page.keyboard.press('Enter');
    await expect(panel(page)).toBeVisible();
    await expect(panel(page)).toHaveCSS('translate', 'none');
    await expect(panel(page)).not.toHaveAttribute('aria-modal', /.*/);
    await expectNoSeriousViolations(page, `パネル ${viewport.width}px`);
    await expect(input(page)).toBeFocused();
    // Tab leaves the panel (it is not a trap) and goes on to the page behind; Shift+Tab comes back.
    await page.keyboard.press('Tab');
    await expect(panel(page).locator(':focus')).toHaveCount(0);
    await page.keyboard.press('Shift+Tab');
    await expect(input(page)).toBeFocused();
    // Shift+Tab goes back to the navigation (the panel follows the nav in the DOM).
    await page.keyboard.press('Shift+Tab');
    await expect(side(page).locator(':focus')).toHaveCount(1);
  });
}

test('別のページへ移って戻っても、パネルは閉じたまま', async ({ page }) => {
  const p = prefix();
  const username = `${p}_back`;
  seedUser(username, `${username}@example.com`, { displayName: 'Back' });
  await openPanel(page, VIEWPORTS.wide);
  await input(page).fill(`${p}_ba`);
  await panel(page).getByRole('option').click();
  await expect(page).toHaveURL(new RegExp(`/${username}$`));
  await page.goBack();
  await expect(page).toHaveURL('/');
  await expect(panel(page)).toBeHidden();
  await expect(searchItem(page)).toHaveAttribute('aria-expanded', 'false');
  // Coming back through the ホーム link, after opening the panel on /, does not reopen it either.
  await searchItem(page).click();
  await expect(panel(page)).toBeVisible();
  await panel(page).getByRole('combobox').fill(`${p}_ba`);
  await panel(page).getByRole('option').click();
  await expect(page).toHaveURL(new RegExp(`/${username}$`));
  await side(page).getByRole('link', { name: 'ホーム' }).click();
  await expect(page).toHaveURL('/');
  await expect(panel(page)).toBeHidden();
  await expect(searchItem(page)).toHaveAttribute('aria-expanded', 'false');
});

test('今いるプロフィールの人を候補から選ぶとパネルが閉じる', async ({ page }) => {
  const p = prefix();
  const username = `${p}_same`;
  seedUser(username, `${username}@example.com`, { displayName: 'Same' });
  await open(page, VIEWPORTS.wide, `/${username}`);
  await searchItem(page).click();
  await expect(panel(page)).toBeVisible();
  await input(page).fill(`${p}_sa`);
  await panel(page).getByRole('option').click();
  // The path does not change, so only a press inside the panel can close it.
  await expect(page).toHaveURL(new RegExp(`/${username}$`));
  await expect(panel(page)).toBeHidden();
  await expect(searchItem(page)).toHaveAttribute('aria-expanded', 'false');
});
