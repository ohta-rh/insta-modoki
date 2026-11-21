import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { signUpViaUi } from './support/auth';
import { seedUser, userRow } from './support/db';
import { harness } from './support/harness';
import { waitForHydration } from './support/hydration';
import { fileKeysOf, insertPost, makeWebp, postRowCount } from './support/posts';
import { putObject } from './support/storage';

type Seeded = { username: string; ids: string[] };

/**
 * `count` posts for `username` (newest first in the grid), each with real photo files. One WebP is
 * made once and stored under every post's keys.
 */
async function postsFor(page: Page, username: string, count: number): Promise<Seeded> {
  await page.goto('/accounts/login');
  const body = await makeWebp(page, 64, 48, 200);
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const post = insertPost({
      authorUsername: username,
      caption: `モーダル試験の投稿 ${i}`,
      createdAt: Date.now() - (i + 1) * 60_000,
    });
    for (const storageKey of post.storageKeys) {
      for (const key of fileKeysOf(storageKey)) await putObject(key, body);
    }
    ids.push(post.id);
  }
  return { username, ids };
}

/** A user nobody is signed in as, with `count` posts. */
async function strangerWithPosts(page: Page, count = 24): Promise<Seeded> {
  const username = `e2e_m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  seedUser(username, `${username}@example.com`, { displayName: 'モーダルの人' });
  return postsFor(page, username, count);
}

const tile = (page: Page, id: string) =>
  page.locator(`[data-testid="post-grid"] a[href="/p/${id}"]`);
const dialog = (page: Page) => page.getByRole('dialog', { name: '投稿', exact: true });
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);

/** Opens the profile, waits for hydration, scrolls 800px down and returns the scroll position. */
async function openProfileScrolled(page: Page, username: string): Promise<number> {
  await page.goto(`/${username}`);
  await waitForHydration(page);
  // The grid loads 12 posts at a time as it scrolls: reach the end so that all of them are there.
  const links = page.locator('[data-testid="post-grid"] a');
  await expect(async () => {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(await links.count()).toBeGreaterThanOrEqual(24);
  }).toPass();
  await page.evaluate(() => window.scrollTo(0, 800));
  await expect.poll(() => scrollY(page)).toBe(800);
  return scrollY(page);
}

/** The id of the first tile that is fully inside the viewport. */
async function visibleTileId(page: Page): Promise<string> {
  const id = await page.locator('[data-testid="post-grid"] a').evaluateAll((links) => {
    const link = links.find((a) => {
      const r = a.getBoundingClientRect();
      return r.top > 60 && r.bottom < window.innerHeight;
    });
    return link?.getAttribute('href')?.replace('/p/', '') ?? null;
  });
  if (!id) throw new Error('画面に収まっているタイルがありません');
  return id;
}

async function expectBodyLocked(page: Page, locked: boolean) {
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
    .toBe(locked ? 'hidden' : 'visible');
}

test('グリッドの投稿をクリックすると モーダルで開き URL が /p/postId になる', async ({ page }) => {
  const { username } = await strangerWithPosts(page);
  const before = await openProfileScrolled(page, username);
  const id = await visibleTileId(page);

  await tile(page, id).click();

  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toHaveAttribute('aria-modal', 'true');
  await expect(page).toHaveURL(new RegExp(`/p/${id}$`));
  // The post detail (#28) is inside the dialog, and the profile stays behind it.
  await expect(dialog(page).getByText(/モーダル試験の投稿 \d+/)).toBeVisible();
  await expect(page.getByTestId('post-grid')).toBeAttached();
  await expect(page.getByRole('heading', { name: 'モーダルの人' })).toBeAttached();
  expect(await scrollY(page)).toBe(before);

  // The page behind does not scroll.
  await expectBodyLocked(page, true);
  const box = (await page.viewportSize())!;
  await page.mouse.move(2, box.height / 2);
  await page.mouse.wheel(0, 400);
  await page.keyboard.press('PageDown');
  expect(await scrollY(page)).toBe(before);
  expect(
    await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null),
  ).toBe(true);
});

test('Esc と閉じるボタンと戻るで閉じ スクロール位置とフォーカスが元に戻る', async ({ page }) => {
  const { username } = await strangerWithPosts(page);
  const before = await openProfileScrolled(page, username);
  const id = await visibleTileId(page);
  const opener = tile(page, id);

  const closers: Record<string, () => Promise<unknown>> = {
    Esc: () => page.keyboard.press('Escape'),
    閉じるボタン: () => dialog(page).getByRole('button', { name: '閉じる' }).click(),
    戻る: () => page.goBack(),
  };
  for (const [name, close] of Object.entries(closers)) {
    await opener.click();
    await expect(dialog(page), `${name}: 開く`).toBeVisible();
    await expect(dialog(page).getByRole('button', { name: '閉じる' })).toBeFocused();
    await close();
    await expect(dialog(page), `${name}: 閉じる`).toBeHidden();
    await expect(page, `${name}: URL`).toHaveURL(new RegExp(`/${username}$`));
    await expectBodyLocked(page, false);
    expect(Math.abs((await scrollY(page)) - before), `${name}: スクロール位置`).toBeLessThanOrEqual(
      1,
    );
    await expect(opener, `${name}: フォーカス`).toBeFocused();
  }
});

test('モーダルの URL を新しいタブや再読み込みで開くと 通常の投稿詳細になる', async ({
  page,
  context,
}) => {
  const { username, ids } = await strangerWithPosts(page, 6);
  await page.goto(`/${username}`);
  await waitForHydration(page);
  const id = ids[0]!;
  await tile(page, id).click();
  await expect(dialog(page)).toBeVisible();

  const expectNormalPage = async (target: Page) => {
    await expect(target).toHaveURL(new RegExp(`/p/${id}$`));
    await expect(target.getByRole('heading', { name: `@${username} の投稿` })).toBeAttached();
    await expect(target.getByText('モーダル試験の投稿 0')).toBeVisible();
    await expect(dialog(target)).toHaveCount(0);
    await expect(target.getByTestId('post-grid')).toHaveCount(0);
  };

  await page.reload();
  await expectNormalPage(page);

  const fresh = await context.newPage();
  await fresh.goto(`/p/${id}`);
  await expectNormalPage(fresh);
  await fresh.close();

  // Ctrl+click and the middle button leave the page as it is and open a normal page in a new tab.
  await page.goto(`/${username}`);
  await waitForHydration(page);
  for (const open of [
    () => tile(page, id).click({ modifiers: ['ControlOrMeta'] }),
    () => tile(page, id).click({ button: 'middle' }),
  ]) {
    const opened = context.waitForEvent('page');
    await open();
    const tab = await opened;
    await tab.waitForLoadState();
    await expectNormalPage(tab);
    await tab.close();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/${username}$`));
  }
});

test('フォーカスがモーダルの外に出ない', async ({ page }) => {
  const { username } = await strangerWithPosts(page, 6);
  await page.goto(`/${username}`);
  await waitForHydration(page);
  const id = (await visibleTileId(page)) ?? '';
  await tile(page, id).click();
  await expect(dialog(page)).toBeVisible();

  const insideDialog = () =>
    page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null);
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    expect(await insideDialog(), `Tab ${i + 1} 回目`).toBe(true);
  }
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await insideDialog(), `Shift+Tab ${i + 1} 回目`).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(tile(page, id)).toBeFocused();
});

test('モーダルから自分の投稿を削除すると グリッドから消える', async ({ page }) => {
  const me = await signUpViaUi(page);
  const { ids } = await postsFor(page, me.username, 3);
  await page.goto(`/${me.username}`);
  await waitForHydration(page);
  await page.evaluate(() => ((window as unknown as { __kept: number }).__kept = 1));
  const target = ids[1]!;
  await tile(page, target).click();
  await expect(dialog(page)).toBeVisible();

  await dialog(page).getByRole('button', { name: '削除', exact: true }).click();
  const confirm = page.getByRole('alertdialog', { name: 'この投稿を削除しますか？' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: '削除', exact: true }).click();

  await expect(dialog(page)).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/${me.username}$`));
  await expect(tile(page, target)).toHaveCount(0);
  await expect(page.locator('[data-testid="post-grid"] a')).toHaveCount(2);
  expect(postRowCount(target)).toBe(0);
  // No reload: a value set on the page before is still there.
  expect(await page.evaluate(() => (window as unknown as { __kept?: number }).__kept)).toBe(1);

  // Someone else's post has no "削除" in the modal.
  const other = await strangerWithPosts(page, 2);
  await page.goto(`/${other.username}`);
  await waitForHydration(page);
  await tile(page, other.ids[0]!).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByText(/モーダル試験の投稿 \d+/)).toBeVisible();
  await expect(dialog(page).getByRole('button', { name: '削除', exact: true })).toHaveCount(0);
});

test('開こうとした投稿が無いとき モーダルの中に見つからないと表示される', async ({ page }) => {
  const { username, ids } = await strangerWithPosts(page, 6);
  await page.goto(`/${username}`);
  await waitForHydration(page);
  const gone = ids[0]!;
  harness({ op: 'deletePost', postId: gone });

  await tile(page, gone).click();

  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByText('ページが見つかりません')).toBeVisible();
  await expect(page.getByTestId('post-grid')).toBeAttached();
  await dialog(page).getByRole('button', { name: '閉じる' }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/${username}$`));
  await expect(tile(page, ids[1]!)).toBeVisible();
});

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('要素が表示されていません');
  return box;
}

test('3 つの幅でモーダルが崩れず axe の重大な違反が無い', async ({ page }) => {
  const { username, ids } = await strangerWithPosts(page, 6);
  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`/${username}`);
    await waitForHydration(page);
    await tile(page, ids[0]!).click();
    await expect(dialog(page), `${width}px`).toBeVisible();

    const box = await boxOf(dialog(page));
    if (width === 375) {
      expect(box.width, '375px は画面いっぱい').toBeCloseTo(375, 0);
      expect(box.height).toBeCloseTo(800, 0);
    } else {
      expect(box.width).toBeLessThanOrEqual(900);
      expect(Math.abs(box.x + box.width / 2 - width / 2), '中央').toBeLessThan(1);
      if (width === 1280) expect(box.width).toBeCloseTo(900, 0);
    }
    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      dialog: (() => {
        const d = document.querySelector('[role="dialog"]')!;
        return d.scrollWidth - d.clientWidth;
      })(),
    }));
    expect(overflow, `${width}px 横スクロール`).toEqual({ page: 0, dialog: 0 });

    // Axe measures contrast: let the fade-in finish first.
    await dialog(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const serious = (await new AxeBuilder({ page }).analyze()).violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(
      serious.map((v) => `${v.id}: ${v.nodes[0]?.target}`),
      `${width}px axe`,
    ).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
  }

  const animationOf = () => dialog(page).evaluate((el) => getComputedStyle(el).animationName);
  await page.goto(`/${username}`);
  await waitForHydration(page);
  await tile(page, ids[0]!).click();
  await expect(dialog(page)).toBeVisible();
  expect(await animationOf(), '動きがあるとき').not.toBe('none');
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await tile(page, ids[0]!).click();
  await expect(dialog(page)).toBeVisible();
  expect(await animationOf(), '視差効果を減らす').toBe('none');
});

test('JS が読み込まれる前にグリッドの投稿を押すと 通常の投稿詳細のページに移る', async ({
  page,
}) => {
  const { username, ids } = await strangerWithPosts(page, 3);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/_next/static/chunks/**', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto(`/${username}`, { waitUntil: 'commit' });
  const link = tile(page, ids[0]!);
  await link.waitFor();
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/p/${ids[0]}$`));
  release();
  await expect(page.getByText('モーダル試験の投稿 0')).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
  expect(userRow(username)).toBeDefined();
});

test('モーダルの中でコメントを送ると 一覧にすぐ出て 件数のリンクが増える', async ({ page }) => {
  await signUpViaUi(page);
  const { username, ids } = await strangerWithPosts(page, 3);
  await page.goto(`/${username}`);
  await waitForHydration(page);
  await tile(page, ids[0]!).click();
  await expect(dialog(page)).toBeVisible();

  await dialog(page).getByLabel('コメントを追加').fill('モーダルからのコメント');
  await dialog(page).getByRole('button', { name: '投稿', exact: true }).click();

  await expect(
    dialog(page).getByRole('listitem').filter({ hasText: 'モーダルからのコメント' }),
  ).toBeVisible();
  await expect(dialog(page).getByRole('link', { name: 'コメント 1 件' })).toBeVisible();
});
