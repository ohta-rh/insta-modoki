import { randomInt } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { fillSignUpKeys, tabTo } from './support/keys';
import { makeJpeg } from './support/fixtures';
import { newScreenPage, openSettled, SCREENS, test as withWorld } from './support/screens';

const POST_URL = /\/p\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;

test('サインアップから投稿・いいね・コメントまでを、キーボードだけで完了できる', async ({
  page,
}) => {
  // Armed long before the key press: Playwright enables the interception asynchronously.
  const fileChooser = page.waitForEvent('filechooser');
  fileChooser.catch(() => {});
  // Each worker's sign-ups share one local IP; a private-range IP of its own keeps the counters apart.
  await page.context().setExtraHTTPHeaders({
    'cf-connecting-ip': `10.${randomInt(256)}.${randomInt(256)}.${1 + randomInt(254)}`,
  });
  await page.goto('/accounts/signup');
  await fillSignUpKeys(page);
  await tabTo(page, page.getByRole('button', { name: 'サインアップ' }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/$/);
  await page.context().setExtraHTTPHeaders({});

  await tabTo(page, page.getByRole('link', { name: '投稿', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/create$/);
  const modal = page.getByRole('dialog', { name: '新規投稿を作成' });
  await expect(modal).toBeVisible();
  // While the modal is open the focus never leaves it.
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(
      await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') != null),
      `Tab ${i + 1} 回目`,
    ).toBe(true);
  }

  const jpeg = await makeJpeg(page, 800, 600);
  await tabTo(page, modal.getByRole('button', { name: 'コンピューターから選択' }));
  await page.keyboard.press('Enter');
  await (await fileChooser).setFiles([{ name: 'k.jpg', mimeType: 'image/jpeg', buffer: jpeg }]);
  await expect(modal.getByRole('heading', { name: '切り取る' })).toBeVisible();
  await tabTo(page, modal.getByRole('button', { name: '次へ', exact: true }));
  await page.keyboard.press('Enter');
  await expect(modal.getByRole('listitem', { name: /^写真 \d+$/ })).toHaveCount(1);
  await tabTo(page, modal.getByLabel('キャプション'));
  await page.keyboard.type('キーボードだけの投稿');
  await tabTo(page, modal.getByRole('button', { name: 'シェア', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(POST_URL);

  const heart = page.getByRole('button', { name: 'いいね', exact: true });
  await tabTo(page, heart);
  await page.keyboard.press('Enter');
  await expect(heart).toHaveAttribute('aria-pressed', 'true');

  await tabTo(page, page.getByLabel('コメントを追加'));
  await page.keyboard.type('キーボードでのコメント');
  await tabTo(page, page.getByRole('button', { name: '投稿', exact: true }));
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('listitem').filter({ hasText: 'キーボードでのコメント' }),
  ).toBeVisible();
});

/** The outline of the focused element: its width and style, and the outline-offset. */
const outlineOfFocused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    return {
      name: `<${el.tagName.toLowerCase()}> ${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)}`,
      width: Number.parseFloat(cs.outlineWidth),
      style: cs.outlineStyle,
      visible: box.width > 0 && box.height > 0,
    };
  });

withWorld('フォーカスされた要素の輪郭が 2px 以上', async ({ browser, world }) => {
  for (const screen of SCREENS) {
    const page = await newScreenPage(browser, { world, loggedIn: screen.loggedIn, width: 1280 });
    await openSettled(page, screen.path(world));
    const seen = new Set<string>();
    const thin: string[] = [];
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press('Tab');
      const outline = await outlineOfFocused(page);
      if (!outline) break;
      if (!outline.visible) continue;
      const key = `${i}:${outline.name}`;
      seen.add(key);
      if (outline.style === 'none' || outline.width < 2) {
        thin.push(`${outline.name} (${outline.style} ${outline.width}px)`);
      }
    }
    expect(seen.size, `${screen.name}: Tab で届いた要素`).toBeGreaterThan(3);
    expect(thin, `${screen.name}: 輪郭が 2px に満たない要素`).toEqual([]);
    await page.context().close();
  }
});

const dialog = (page: Page) => page.getByRole('dialog', { name: '投稿', exact: true });

async function openModalByEnter(page: Page, author: string, postId: string): Promise<void> {
  await openSettled(page, `/${author}`);
  const tile = page.locator(`[data-testid="post-grid"] a[href="/p/${postId}"]`);
  await tabTo(page, tile);
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole('button', { name: '閉じる' })).toBeFocused();
}

withWorld('モーダルの中でフォーカスが閉じ込められる', async ({ browser, world }) => {
  const page = await newScreenPage(browser, { world, loggedIn: true, width: 1280 });
  await openModalByEnter(page, world.author, world.detailPostId);
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(
      () => document.activeElement?.closest('[role="dialog"]') != null,
    );
    expect(inside, `Tab ${i + 1} 回目`).toBe(true);
  }
  await page.context().close();
});

withWorld('Esc で閉じて開いた要素にフォーカスが戻る', async ({ browser, world }) => {
  const page = await newScreenPage(browser, { world, loggedIn: true, width: 1280 });
  await openModalByEnter(page, world.author, world.detailPostId);
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(
    page.locator(`[data-testid="post-grid"] a[href="/p/${world.detailPostId}"]`),
  ).toBeFocused();
  await page.context().close();
});
