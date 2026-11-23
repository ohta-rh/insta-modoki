import type { Locator, Page } from '@playwright/test';
import { expect, signedIn as test } from './support/auth';
import { expectNoSeriousViolations } from './support/axe';
import { holdScripts, waitForHydration } from './support/hydration';
import { expectPx, rect, styles, VIEWPORTS } from './support/measure';

const side = (page: Page) => page.locator('nav[data-nav="side"]');
const bottom = (page: Page) => page.locator('nav[data-nav="bottom"]');
const topBar = (page: Page) => page.locator('header[data-shell-top-bar]');
const menu = (page: Page) => page.locator('#more-menu');

const SIDE_LABELS = ['ホーム', '検索', '発見', '投稿', '通知', 'プロフィール'];
const TAB_LABELS = ['ホーム', '発見', '投稿', '通知', 'プロフィール'];

/** The text of a navigation item is visually hidden (`sr-only`): its box is at most 1px. */
async function nameHidden(item: Locator): Promise<boolean> {
  return item.evaluate((el) => {
    const spans = [...el.querySelectorAll('span')].filter((s) => (s.textContent ?? '').trim());
    return (
      spans.length > 0 &&
      spans.every((s) => {
        const r = s.getBoundingClientRect();
        return r.width <= 1 && r.height <= 1;
      })
    );
  });
}

async function open(page: Page, viewport: { width: number; height: number }, path = '/') {
  await page.setViewportSize(viewport);
  await page.goto(path);
  await waitForHydration(page);
}

test('1280px ではナビが 244px で名前つきの 7 項目になる', async ({ page }) => {
  await open(page, VIEWPORTS.wide);
  const nav = side(page);
  expectPx((await rect(nav)).width, 244, 'サイドナビの幅');
  const links = nav.getByRole('link');
  await expect(links).toHaveCount(6);
  for (const [i, label] of SIDE_LABELS.entries()) {
    const link = links.nth(i);
    await expect(link).toContainText(label);
    const box = await rect(link);
    expect(box.height, `${label} の高さ`).toBeGreaterThanOrEqual(48);
    const s = await styles(link, ['border-radius', 'font-size', 'color']);
    expect(s['border-radius'], `${label} の角丸`).toBe('8px');
    expect(s['font-size'], `${label} の文字`).toBe('16px');
    expect(s['color'], `${label} の色`).toBe('rgb(0, 0, 0)');
    expect(await nameHidden(link), `${label} の名前`).toBe(false);
  }
  const more = nav.getByRole('button', { name: 'その他' });
  await expect(more).toBeVisible();
  const moreBox = await rect(more);
  expect(moreBox.y, 'その他は一番下').toBeGreaterThan((await rect(links.last())).y);
  // The logo is the mark and the name.
  const logo = nav.getByRole('img', { name: /（仮称）/ });
  await expect(logo).toBeVisible();
  await expect(logo).toContainText(/\S/);
});

test('1024px ではナビがアイコンだけの 72px になり、名前はリンクの名前に残る', async ({ page }) => {
  await open(page, VIEWPORTS.narrow);
  const nav = side(page);
  expectPx((await rect(nav)).width, 72, 'サイドナビの幅');
  for (const label of SIDE_LABELS) {
    const link = nav.getByRole('link', { name: label });
    const box = await rect(link);
    expect(box.width, `${label} の幅`).toBeGreaterThanOrEqual(48);
    expect(box.height, `${label} の高さ`).toBeGreaterThanOrEqual(48);
    expect(await nameHidden(link), `${label} の名前`).toBe(true);
  }
  await expect(nav.getByRole('button', { name: 'その他' })).toBeVisible();
  const logo = nav.getByRole('img', { name: /（仮称）/ });
  await expect(logo).toBeVisible();
  await expect(logo).not.toContainText(/\S/);
});

test('ナビの境目は 768px と 1264px', async ({ page }) => {
  const cases: [number, 'side' | 'bottom', number?][] = [
    [1263, 'side', 72],
    [1264, 'side', 244],
    [768, 'side', 72],
    [767, 'bottom'],
  ];
  for (const [width, kind, navWidth] of cases) {
    await open(page, { width, height: 800 });
    if (kind === 'bottom') {
      await expect(bottom(page), `${width}px`).toBeVisible();
      await expect(side(page), `${width}px`).toBeHidden();
    } else {
      await expect(side(page), `${width}px`).toBeVisible();
      await expect(bottom(page), `${width}px`).toBeHidden();
      expectPx((await rect(side(page))).width, navWidth!, `${width}px のサイドナビの幅`);
    }
  }
});

test('375px では上部バー 45px と下部タブ 50px のアイコンだけになる', async ({ page }) => {
  await open(page, VIEWPORTS.mobile);
  await expect(side(page)).toBeHidden();
  const tabs = bottom(page);
  expectPx((await rect(tabs)).height, 50, '下部タブの高さ');
  await expect(tabs.getByRole('link')).toHaveCount(5);
  for (const label of TAB_LABELS) {
    const link = tabs.getByRole('link', { name: label });
    await expect(link).toBeVisible();
    expect(await nameHidden(link), `${label} の名前`).toBe(true);
  }
  const bar = topBar(page);
  expectPx((await rect(bar)).height, 45, '上部バーの高さ');
  const edge = await styles(bar, ['border-bottom-width', 'border-bottom-color']);
  expect(edge['border-bottom-width']).toBe('1px');
  expect(edge['border-bottom-color']).toBe('rgb(219, 219, 219)');
  const logo = bar.getByRole('img', { name: /（仮称）/ });
  await expect(logo).toBeVisible();
  await expect(logo).toContainText(/\S/);
  const more = bar.getByRole('button', { name: 'その他' });
  await expect(more).toBeVisible();
  expect((await rect(more)).x, 'その他は右').toBeGreaterThan((await rect(logo)).x);
});

test('今の項目は塗りつぶしのアイコンと太字で示し、線を引かない', async ({ page }) => {
  for (const [viewport, nav] of [
    [VIEWPORTS.wide, side(page)],
    [VIEWPORTS.narrow, side(page)],
    [VIEWPORTS.mobile, bottom(page)],
  ] as const) {
    await open(page, viewport);
    const here = nav.locator('[aria-current="page"]');
    await expect(here, `${viewport.width}px`).toHaveCount(1);
    await expect(nav.getByRole('link', { name: 'ホーム' })).toHaveAttribute('aria-current', 'page');
    await expect(here.locator('svg[data-filled="true"]')).toHaveCount(1);
    await expect(nav.locator('svg[data-filled="true"]')).toHaveCount(1);
    if (viewport.width === 1280) {
      expect((await styles(here, ['font-weight']))['font-weight']).toBe('700');
      await expect(
        nav.getByRole('link', { name: '検索' }).locator('svg[data-filled="true"]'),
      ).toHaveCount(0);
    }
    const links = nav.getByRole('link');
    for (let i = 0; i < (await links.count()); i += 1) {
      const s = await styles(links.nth(i), [
        'border-left-width',
        'border-right-width',
        'border-top-width',
      ]);
      expect(s, `${viewport.width}px 項目 ${i}`).toEqual({
        'border-left-width': '0px',
        'border-right-width': '0px',
        'border-top-width': '0px',
      });
    }
  }
});

test('その他のメニューから設定とログアウトに行ける', async ({ page }) => {
  for (const [viewport, scope] of [
    [VIEWPORTS.wide, side(page)],
    [VIEWPORTS.mobile, topBar(page)],
  ] as const) {
    await open(page, viewport);
    const more = scope.getByRole('button', { name: 'その他' });
    await more.click();
    await expect(menu(page), `${viewport.width}px`).toBeVisible();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(menu(page).getByRole('link', { name: 'プロフィールを編集' })).toHaveAttribute(
      'href',
      '/accounts/edit',
    );
    await expect(menu(page).getByRole('link', { name: 'ログアウト' })).toHaveAttribute(
      'href',
      '/accounts/logout',
    );
    // Esc closes it and gives the focus back to the button.
    await page.keyboard.press('Escape');
    await expect(menu(page)).toBeHidden();
    await expect(more).toBeFocused();
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    // A press outside closes it as well.
    await more.click();
    await expect(menu(page)).toBeVisible();
    await page.mouse.click(viewport.width - 20, viewport.height - 120);
    await expect(menu(page)).toBeHidden();
  }
  await open(page, VIEWPORTS.wide);
  await side(page).getByRole('button', { name: 'その他' }).click();
  await menu(page).getByRole('link', { name: 'ログアウト' }).click();
  await expect(page).toHaveURL(/\/accounts\/logout$/);
});

test('その他のメニューはスクリプトの前でも開く', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.wide);
  const release = await holdScripts(page);
  await page.goto('/', { waitUntil: 'commit' });
  const more = side(page).getByRole('button', { name: 'その他' });
  await more.waitFor();
  // Held stylesheets block the first paint, so Playwright's "stable" check (animation frames) never
  // passes: press without waiting for it.
  await more.click({ force: true });
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).getByRole('link', { name: 'ログアウト' })).toBeVisible();
  release();
});

test('data-page-width="wide" の画面だけ main が 630px を超える', async ({ page }) => {
  // Not the home: it is itself a wide screen (630px column + 319px right column).
  await open(page, VIEWPORTS.wide, '/explore');
  const main = page.locator('main');
  expectPx((await rect(main)).width, 630, '通常の main の幅');
  await main.evaluate((el) => {
    const marker = document.createElement('div');
    marker.dataset.pageWidth = 'wide';
    el.prepend(marker);
  });
  expectPx((await rect(main)).width, 1036, 'wide の main の幅');
});

test('ナビとその他のメニューに axe の重大な違反が無く、操作できる要素は 44px 以上', async ({
  page,
}) => {
  test.setTimeout(90_000);
  for (const viewport of [VIEWPORTS.mobile, VIEWPORTS.narrow, VIEWPORTS.wide]) {
    await open(page, viewport);
    const scope = viewport.width === 375 ? topBar(page) : side(page);
    const targets = page.locator(
      'nav[data-nav] a, nav[data-nav] button, header[data-shell-top-bar] button',
    );
    const measured: string[] = [];
    for (let i = 0; i < (await targets.count()); i += 1) {
      const box = await targets.nth(i).boundingBox();
      if (!box) continue; // hidden at this width
      expect(box.width, `${viewport.width}px 操作 ${i} の幅`).toBeGreaterThanOrEqual(44);
      expect(box.height, `${viewport.width}px 操作 ${i} の高さ`).toBeGreaterThanOrEqual(44);
      measured.push(String(i));
    }
    expect(measured.length, `${viewport.width}px で測った要素`).toBeGreaterThanOrEqual(6);
    await expectNoSeriousViolations(page, `/ ${viewport.width}px（閉じた状態）`);
    await scope.getByRole('button', { name: 'その他' }).click();
    await expect(menu(page)).toBeVisible();
    const links = menu(page).getByRole('link');
    for (let i = 0; i < (await links.count()); i += 1) {
      const box = (await links.nth(i).boundingBox())!;
      expect(box.height, `${viewport.width}px メニュー ${i}`).toBeGreaterThanOrEqual(44);
    }
    await expectNoSeriousViolations(page, `/ ${viewport.width}px（開いた状態）`);
  }
});
