import { expect, test, type Page } from '@playwright/test';
import { signedIn } from './support/auth';
import { seedUser, userRow } from './support/db';
import { makeJpeg } from './support/fixtures';
import { waitForHydration } from './support/hydration';
import { tabTo } from './support/keys';
import { expectNoSeriousViolations } from './support/axe';
import { insertPost, putPostFiles, tagPost } from './support/posts';

const POST_URL = /\/p\/([0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12})$/;

const unique = () => Math.random().toString(36).slice(2, 8);
const grid = (page: Page) => page.getByTestId('post-grid');

/** Posts through the real /create screen with `caption` and lands on the post's page. */
async function createWithCaption(page: Page, caption: string): Promise<string> {
  await page.goto('/create');
  await page.waitForLoadState('networkidle');
  const jpeg = await makeJpeg(page, 400, 300);
  await page
    .locator('input[type="file"]')
    .setInputFiles([{ name: 'a.jpg', mimeType: 'image/jpeg', buffer: jpeg }]);
  await expect(page.getByRole('listitem', { name: '写真 1' })).toHaveCount(1);
  await page.getByLabel('キャプション').fill(caption);
  await page.getByRole('button', { name: '投稿', exact: true }).click();
  await expect(page).toHaveURL(POST_URL);
  return POST_URL.exec(page.url())![1]!;
}

test('未ログインでタグのページを開くとログインへ移る', async ({ page }) => {
  await page.goto('/explore/tags/tokyo');
  await expect(page).toHaveURL(/\/accounts\/login/);
});

signedIn('キャプションのタグから一覧に移り、日本語のタグも開ける', async ({ page }) => {
  const n = unique();
  const tag = `e2e${n}`;
  const jp = `東京${n}`;
  const postId = await createWithCaption(page, `朝 #${tag} #${jp}`);
  await waitForHydration(page);

  // The detail page: the tag is a link, reached with Tab, opened with Enter.
  const link = page.getByRole('link', { name: `#${tag}`, exact: true });
  await tabTo(page, link);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/explore/tags/${tag}$`));
  await expect(page.getByRole('heading', { level: 1, name: `#${tag}` })).toBeVisible();
  await expect(page.getByText('投稿 1 件')).toBeVisible();
  const tile = grid(page).getByRole('link');
  await expect(tile).toHaveCount(1);
  await expect(tile).toHaveAttribute('href', `/p/${postId}`);
  await expect
    .poll(() =>
      grid(page).evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length),
    )
    .toBe(3);

  // The Japanese tag opens the same post's list.
  await page.goBack();
  await page.getByRole('link', { name: `#${jp}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/explore/tags/${encodeURIComponent(jp)}$`));
  await expect(page.getByRole('heading', { level: 1, name: `#${jp}` })).toBeVisible();
  await expect(grid(page).getByRole('link')).toHaveAttribute('href', `/p/${postId}`);
});

signedIn('投稿の無いタグは空の文言、知らないタグは 404', async ({ page }) => {
  const tag = `e2e${unique()}`;
  await createWithCaption(page, `これは消す #${tag}`);
  await waitForHydration(page);
  await page.getByRole('button', { name: '削除', exact: true }).click();
  await page
    .getByRole('alertdialog', { name: 'この投稿を削除しますか？' })
    .getByRole('button', { name: '削除', exact: true })
    .click();
  await expect(page).not.toHaveURL(POST_URL);

  await page.goto(`/explore/tags/${tag}`);
  await expect(page.getByRole('heading', { level: 1, name: `#${tag}` })).toBeVisible();
  await expect(page.getByText('投稿 0 件')).toBeVisible();
  await expect(page.getByText('まだ投稿がありません')).toBeVisible();

  const missing = await page.goto(`/explore/tags/nobody${unique()}`);
  expect(missing!.status()).toBe(404);
  await expect(page.getByText('ページが見つかりません')).toBeVisible();
});

signedIn('キーボードだけでタグのページを操作でき、axe の重大な違反が 0 件', async ({ page }) => {
  const tag = `e2ek${unique()}`;
  const username = `e2e_h${Date.now().toString(36)}${unique()}`;
  seedUser(username, `${username}@example.com`);
  const authorId = userRow(username)!.id as string;
  expect(authorId).toBeTruthy();
  // Tabbing scrolls the end marker into view and would load the next page by itself; with no
  // observer only the "さらに表示" button can (the scroll path has its own unit test).
  await page.addInitScript(() => {
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  });
  const base = Date.now() - 3 * 60 * 60 * 1000;
  for (let i = 0; i < 13; i++) {
    const createdAt = base + i * 60_000;
    const post = insertPost({
      authorUsername: username,
      createdAt,
      mediaCount: i === 12 ? 2 : 1,
      altTexts: i === 11 ? ['猫'] : undefined,
    });
    if (i >= 11) await putPostFiles(page, post);
    tagPost(post.id, [tag], createdAt);
  }

  await page.goto(`/explore/tags/${tag}`);
  await waitForHydration(page);
  await expect(page.getByText('投稿 13 件')).toBeVisible();
  const links = grid(page).getByRole('link');
  await expect(links).toHaveCount(12);
  // Newest first: the two-photo post, then the one with its own alt text.
  await expect(links.first()).toHaveAccessibleName(
    new RegExp(`${username} が投稿した写真（1 / 2）.*2 枚の写真`),
  );
  await expect(links.nth(1)).toHaveAccessibleName(/猫/);

  for (let i = 0; i < 12; i++) await tabTo(page, links.nth(i));
  const more = page.getByRole('button', { name: 'さらに表示' });
  await tabTo(page, more);
  const height = (await more.boundingBox())!.height;
  expect(height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Enter');
  await expect(links).toHaveCount(13);
  const hrefs = await links.evaluateAll((els) => els.map((e) => e.getAttribute('href')));
  expect(new Set(hrefs).size).toBe(13);
  await expect(more).toHaveCount(0);

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(links.first()).toBeVisible();
    const box = (await links.first().boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await expectNoSeriousViolations(page, `/explore/tags/${tag} at ${width}px`);
  }
});
