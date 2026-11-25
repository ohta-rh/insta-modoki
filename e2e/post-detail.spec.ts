import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { holdScripts, nextFrames, waitForHydration } from './support/hydration';
import { signInViaHarness, type NewUser } from './support/auth';
import { seedUser } from './support/db';
import { getObject } from './support/storage';
import { delayMedia, insertPost, postRowCount, putPostFiles } from './support/posts';
import { tabTo } from './support/keys';

/** `page` signed in as a new user, who is `me`. */
const signedIn = test.extend<{ me: NewUser }>({
  me: async ({ page }, use) => {
    await use(await signInViaHarness(page));
  },
});

const carousel = (page: Page) => page.locator('[aria-roledescription="carousel"]');
const badge = (page: Page, text: string) => page.getByText(text, { exact: true });
const scrollLeftOf = (page: Page) => carousel(page).evaluate((el) => el.scrollLeft);
/** Waits until the strip has finished scrolling to slide `index`. */
const expectAtSlide = (page: Page, index: number) =>
  expect
    .poll(() =>
      carousel(page).evaluate((el, i) => Math.abs(el.scrollLeft - i * el.clientWidth), index),
    )
    .toBeLessThan(1);
const activeDot = async (page: Page) =>
  page
    .getByTestId('carousel-dot')
    .evaluateAll((dots) => dots.findIndex((d) => d.getAttribute('data-active') === 'true'));

/** A user nobody is signed in as, with a post of their own. */
function strangerPost(
  options: Parameters<typeof insertPost>[0] extends infer O ? Partial<O> : never,
) {
  const username = `e2e_o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  seedUser(username, `${username}@example.com`);
  return { username, post: insertPost({ ...options, authorUsername: username }) };
}

test('写真をスワイプと矢印キーで切り替えられ 枚数バッジとドットが位置を示す', async ({ page }) => {
  const { post } = strangerPost({ mediaCount: 3 });
  await putPostFiles(page, post);
  await page.goto(`/p/${post.id}`);

  await expect(carousel(page)).toBeVisible();
  await waitForHydration(page);
  await expect(badge(page, '1/3')).toBeVisible();
  await expect(page.getByTestId('carousel-dot')).toHaveCount(3);
  expect(await activeDot(page)).toBe(0);
  await expect(page.locator('[aria-roledescription="slide"]')).toHaveCount(3);
  await expect(page.locator('[aria-roledescription="slide"]').nth(1)).toHaveAttribute(
    'aria-label',
    '2 / 3',
  );

  // A swipe is the browser's own scroll of the snap strip, so the strip is scrolled the way a swipe
  // leaves it: one photo to the left. (CDP `Input.synthesizeScrollGesture` is a compositor gesture
  // whose result depends on frame timing; in headless CI it once left the strip at the first photo.)
  // The badge and dots must follow the scroll position, and stay where a photo is only half-way.
  await carousel(page).evaluate((el) =>
    el.scrollTo({ left: el.clientWidth * 0.4, behavior: 'instant' }),
  );
  await expectAtSlide(page, 0);
  await expect(badge(page, '1/3')).toBeVisible();
  await carousel(page).evaluate((el) => el.scrollTo({ left: el.clientWidth, behavior: 'instant' }));
  await expectAtSlide(page, 1);
  await expect(badge(page, '2/3')).toBeVisible();
  expect(await activeDot(page)).toBe(1);

  // Arrow keys on the focused photos: right, right (end), then left back to the start.
  await waitForHydration(page);
  await carousel(page).focus();
  await page.keyboard.press('ArrowRight');
  await expect(badge(page, '3/3')).toBeVisible();
  // At the last photo ArrowRight changes nothing: the strip stays where it is.
  await expectAtSlide(page, 2);
  const lastLeft = await scrollLeftOf(page);
  await page.keyboard.press('ArrowRight');
  await nextFrames(page);
  expect(await scrollLeftOf(page)).toBe(lastLeft);
  await expect(badge(page, '3/3')).toBeVisible();
  expect(await activeDot(page)).toBe(2);
  await page.keyboard.press('ArrowLeft');
  await expect(badge(page, '2/3')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(badge(page, '1/3')).toBeVisible();
  await expectAtSlide(page, 0);
  await page.keyboard.press('ArrowLeft');
  await nextFrames(page);
  expect(await scrollLeftOf(page)).toBe(0);
  await expect(badge(page, '1/3')).toBeVisible();
  expect(await activeDot(page)).toBe(0);
});

test('写真が 1 枚の投稿にはバッジとドットが出ない', async ({ page }) => {
  const { post } = strangerPost({ mediaCount: 1 });
  await putPostFiles(page, post);
  await page.goto(`/p/${post.id}`);

  await expect(page.locator('main img').first()).toBeVisible();
  await expect(badge(page, '1/1')).toHaveCount(0);
  await expect(page.getByTestId('carousel-dot')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '次の写真' })).toHaveCount(0);
});

test('画像の読み込みが遅くても CLS が 0.1 以下で プレースホルダーが出る', async ({ page }) => {
  const { post } = strangerPost({ mediaCount: 3, width: 1200, height: 900 });
  await putPostFiles(page, post);
  await delayMedia(page, 1000);
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[]) {
        if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(`/p/${post.id}`, { waitUntil: 'domcontentloaded' });

  const first = page.locator('[aria-roledescription="carousel"] img').first();
  await expect(first).toBeVisible();
  // Before the photo arrives: its box already has the photo's shape and a blurred background.
  expect(await first.evaluate((img) => (img as HTMLImageElement).complete)).toBe(false);
  const shape = (await first.boundingBox())!;
  expect(shape.width / shape.height).toBeCloseTo(1200 / 900, 1);
  expect(await first.evaluate((img) => getComputedStyle(img).backgroundImage)).toMatch(
    /^url\("data:image\/png;base64,/,
  );

  await expect
    .poll(() => first.evaluate((img) => (img as HTMLImageElement).naturalWidth), {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);
  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  expect(cls).toBeLessThanOrEqual(0.1);

  const imgs = page.locator('[aria-roledescription="carousel"] img');
  await expect(imgs.nth(0)).not.toHaveAttribute('loading', 'lazy');
  await expect(imgs.nth(1)).toHaveAttribute('loading', 'lazy');
  await expect(imgs.nth(2)).toHaveAttribute('loading', 'lazy');
});

test('投稿詳細の HTML に OGP のタグが入る', async ({ page, request }) => {
  const caption = `"引用" <b>太字</b> & ${'あ'.repeat(200)}`;
  const { username, post } = strangerPost({ mediaCount: 2, caption, width: 1600, height: 900 });
  const response = await request.get(`/p/${post.id}`);
  expect(response.status()).toBe(200);
  const html = await response.text();
  // The caption is text in the tag, never markup.
  expect(html).not.toContain('<b>太字</b>');
  expect(html).toContain('&lt;b&gt;');

  await page.goto(`/p/${post.id}`);
  const meta = (property: string) =>
    page
      .locator(`meta[property="${property}"], meta[name="${property}"]`)
      .first()
      .getAttribute('content');
  expect(await meta('og:title')).toBe(`@${username} の投稿`);
  expect(await meta('og:description')).toBe(Array.from(caption).slice(0, 160).join(''));
  const image = (await meta('og:image'))!;
  expect(image).toMatch(/^https?:\/\/.+\/media\/.+\/w1080\.webp$/);
  expect(image).toContain(post.storageKeys[0]);
  expect(await meta('og:image:width')).toBe('1080');
  expect(await meta('og:image:height')).toBe('608');
  expect(await meta('og:url')).toBe(new URL(`/p/${post.id}`, page.url()).href);
  expect(await meta('twitter:card')).toBe('summary_large_image');
  await expect(page).toHaveTitle(`@${username} の投稿`);

  // No caption: the description counts the photos.
  const bare = strangerPost({ mediaCount: 2 });
  await page.goto(`/p/${bare.post.id}`);
  expect(await meta('og:description')).toBe(`@${bare.username} の写真 2 枚`);
});

test('存在しない投稿は 404 の画面が出る', async ({ page }) => {
  for (const id of [crypto.randomUUID(), 'not-a-uuid']) {
    const response = await page.goto(`/p/${id}`);
    expect(response!.status()).toBe(404);
    await expect(page.getByText('ページが見つかりません')).toBeVisible();
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(0);
  }
});

signedIn('自分の投稿を確認ダイアログのあとで削除できる', async ({ page, me }) => {
  const username = me.username;
  const post = insertPost({ authorUsername: username, mediaCount: 3, caption: '消す投稿' });
  const files = await putPostFiles(page, post);
  await page.goto(`/p/${post.id}`);
  await waitForHydration(page);
  const dialog = page.getByRole('alertdialog', { name: 'この投稿を削除しますか？' });

  // Cancel and Escape leave everything in place and hand the focus back to the button.
  await pressDelete(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'キャンセル' }).click();
  await expect(dialog).toBeHidden();
  await expect(moreButton(page)).toBeFocused();
  await pressDelete(page);
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(moreButton(page)).toBeFocused();
  expect(postRowCount(post.id)).toBe(1);
  expect(await getObject(files[0]!)).not.toBeNull();

  await pressDelete(page);
  await dialog.getByRole('button', { name: '削除', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/${username}$`));
  expect(postRowCount(post.id)).toBe(0);
  for (const key of files) expect(await getObject(key), key).toBeNull();

  const gone = await page.goto(`/p/${post.id}`);
  expect(gone!.status()).toBe(404);
});

const moreButton = (page: Page) => page.getByRole('button', { name: 'その他の操作' });
const deleteRow = (page: Page) =>
  page
    .getByRole('dialog', { name: 'その他の操作' })
    .getByRole('button', { name: '削除', exact: true });
/** Opens the post's "…" menu and presses its "削除" row (the author's delete lives there, #94). */
async function pressDelete(page: Page) {
  await moreButton(page).click();
  await deleteRow(page).click();
}

const FAILED = 'エラーが発生しました。しばらくしてからもう一度お試しください';

/** Holds every Server Action POST of the post page until `release()`, then aborts or lets it through. */
async function holdPosts(page: Page, postId: string) {
  const state = { posts: 0, fail: true };
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    (url) => url.pathname === `/p/${postId}`,
    async (route) => {
      // The unread-badge poll (a POST with body `[]`) is not a request of this test.
      if (route.request().method() !== 'POST' || route.request().postData() === '[]')
        return route.continue();
      state.posts += 1;
      if (!state.fail) return route.continue();
      await gate;
      await route.abort();
    },
  );
  return { state, release };
}

const inDialog = (dialog: Locator) => dialog.evaluate((d) => d.contains(document.activeElement));

signedIn(
  '削除の通信が失敗しても フォーカスが確認のダイアログの中に残り Tab で中を回る',
  async ({ page, me }) => {
    const post = insertPost({
      authorUsername: me.username,
      mediaCount: 1,
      caption: '消せない投稿',
    });
    await putPostFiles(page, post);
    await page.goto(`/p/${post.id}`);
    await waitForHydration(page);
    const { state, release } = await holdPosts(page, post.id);
    const dialog = page.getByRole('alertdialog', { name: 'この投稿を削除しますか？' });
    await tabTo(page, moreButton(page));
    await page.keyboard.press('Enter');
    // The menu opens with the focus on its first row, "削除"; Enter presses it.
    await expect(deleteRow(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    const confirm = dialog.getByRole('button', { name: '削除', exact: true });
    const cancel = dialog.getByRole('button', { name: 'キャンセル' });
    await tabTo(page, confirm);
    await page.keyboard.press('Enter');

    // AC-1: in flight, the focus stays in the dialog and a second Enter sends nothing more.
    const busy = dialog.getByRole('button', { name: '削除中…' });
    await expect(busy).toBeVisible();
    expect(await inDialog(dialog)).toBe(true);
    await page.keyboard.press('Enter');
    await expect.poll(() => state.posts).toBe(1);
    expect(await inDialog(dialog)).toBe(true);
    // The attributes are read now and judged after the behavioural checks below.
    const ariaInFlight = await Promise.all([
      busy.getAttribute('aria-disabled'),
      cancel.getAttribute('aria-disabled'),
    ]);
    release();

    // AC-2: after the failure, Tab never leaves the dialog (r3: the first Tab landed on body).
    await expect(dialog.getByRole('alert')).toHaveText(FAILED);
    await page.keyboard.press('Tab');
    expect(await inDialog(dialog)).toBe(true);
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Tab');
    expect(await inDialog(dialog)).toBe(true);
    await expect(confirm).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    expect(await inDialog(dialog)).toBe(true);
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(confirm).toBeFocused();
    await expect(confirm).not.toHaveAttribute('aria-disabled', /.*/);
    expect(
      (await new AxeBuilder({ page }).analyze()).violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      ),
    ).toEqual([]);
    await page.keyboard.press('Tab');
    await expect(cancel).toBeFocused();
    expect(ariaInFlight).toEqual(['true', 'true']);

    // AC-3: with the network back, "削除" removes the post and goes to the author's page.
    state.fail = false;
    await page.keyboard.press('Tab');
    await expect(confirm).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/${me.username}$`));
    expect(postRowCount(post.id)).toBe(0);
  },
);

signedIn(
  '削除の通信が失敗した後の Esc は ダイアログを閉じて 削除を開いたボタンに戻る',
  async ({ page, me }) => {
    const post = insertPost({ authorUsername: me.username, mediaCount: 1 });
    await putPostFiles(page, post);
    await page.goto(`/p/${post.id}`);
    await waitForHydration(page);
    const { release } = await holdPosts(page, post.id);
    const dialog = page.getByRole('alertdialog', { name: 'この投稿を削除しますか？' });
    await pressDelete(page);
    await dialog.getByRole('button', { name: '削除', exact: true }).click();
    release();
    await expect(dialog.getByRole('alert')).toHaveText(FAILED);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(moreButton(page)).toBeFocused();
    expect(postRowCount(post.id)).toBe(1);
  },
);

signedIn('削除の通信の最中は キャンセルと Esc でダイアログが閉じない', async ({ page, me }) => {
  const post = insertPost({ authorUsername: me.username, mediaCount: 1 });
  await putPostFiles(page, post);
  await page.goto(`/p/${post.id}`);
  await waitForHydration(page);
  const { release } = await holdPosts(page, post.id);
  const dialog = page.getByRole('alertdialog', { name: 'この投稿を削除しますか？' });
  await pressDelete(page);
  await dialog.getByRole('button', { name: '削除', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '削除中…' })).toBeVisible();

  // Playwright treats aria-disabled as not actionable, so the click is forced.
  await dialog.getByRole('button', { name: 'キャンセル' }).click({ force: true });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  expect(postRowCount(post.id)).toBe(1);
  release();
  await expect(dialog.getByRole('alert')).toHaveText(FAILED);
  await expect(dialog).toBeVisible();
});

signedIn(
  '削除を押すと確認のダイアログが 1 度だけ開き コンソールに警告が出ない',
  async ({ page, me }) => {
    const post = insertPost({ authorUsername: me.username, mediaCount: 1, caption: '警告の確認' });
    await putPostFiles(page, post);
    const logs: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'warning' || m.type() === 'error') logs.push(m.text());
    });
    page.on('pageerror', (e) => logs.push(e.message));
    await page.goto(`/p/${post.id}`);
    await waitForHydration(page);

    await pressDelete(page);
    await expect(page.getByRole('alertdialog', { name: 'この投稿を削除しますか？' })).toBeVisible();
    expect(logs).toEqual([]);
  },
);

signedIn(
  'JS が読み込まれる前でも 削除の確認ダイアログが開き Esc で閉じる',
  async ({ page, me }) => {
    const post = insertPost({ authorUsername: me.username, mediaCount: 1 });
    await putPostFiles(page, post);
    const release = await holdScripts(page);
    await page.goto(`/p/${post.id}`, { waitUntil: 'commit' });
    await moreButton(page).waitFor();
    await moreButton(page).focus();
    await expect(moreButton(page)).toBeFocused();
    // Before the scripts load the menu still opens (popovertarget) and its row opens the dialog.
    await page.keyboard.press('Enter');
    await expect(deleteRow(page)).toBeVisible();
    await deleteRow(page).focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('alertdialog', { name: 'この投稿を削除しますか？' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    // Before hydration the menu stays open and the browser hands the focus back to the row that
    // opened the dialog.
    await expect(deleteRow(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    // The dialog puts the focus on its first control, "キャンセル".
    await expect(dialog.getByRole('button', { name: 'キャンセル' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    release();
  },
);

signedIn('他人の投稿には削除が出ない', async ({ page }) => {
  const { post } = strangerPost({ mediaCount: 1 });
  await putPostFiles(page, post);
  await page.goto(`/p/${post.id}`);
  await expect(page.locator('main img').first()).toBeVisible();
  // Open the menu too: the row must not be there either.
  await waitForHydration(page);
  await moreButton(page).click();
  await expect(page.getByRole('dialog', { name: 'その他の操作' })).toBeVisible();
  await expect(page.getByRole('button', { name: '削除' })).toHaveCount(0);
});

signedIn('キーボードだけで操作でき axe の重大な違反が無い', async ({ page, me }) => {
  const username = me.username;
  const post = insertPost({
    authorUsername: username,
    mediaCount: 3,
    caption: 'キーボードで見る',
    altTexts: ['猫', '', ''],
  });
  await putPostFiles(page, post);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`/p/${post.id}`);
  await expect(page.locator('[aria-roledescription="carousel"] img').first()).toBeVisible();

  const serious = async () =>
    (await new AxeBuilder({ page }).analyze()).violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
  expect(await serious()).toEqual([]);

  // Photos carry text alternatives: the given one, else "<username> が投稿した写真（<位置> / <枚数>）".
  const alts = await page
    .locator('[aria-roledescription="carousel"] img')
    .evaluateAll((imgs) => imgs.map((i) => i.getAttribute('alt')));
  expect(alts).toEqual([
    '猫',
    `${username} が投稿した写真（2 / 3）`,
    `${username} が投稿した写真（3 / 3）`,
  ]);

  // Tab reaches the carousel, then its buttons, then the delete button.
  const carouselEl = carousel(page);
  const next = page.getByRole('button', { name: '次の写真' });
  const prev = page.getByRole('button', { name: '前の写真' });
  for (const button of [prev, next]) {
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await waitForHydration(page);
  await tabTo(page, carouselEl);
  await page.keyboard.press('ArrowRight');
  await expect(badge(page, '2/3')).toBeVisible();
  await tabTo(page, next);
  // Reduced motion: the photo changes at once, with no smooth scrolling in between.
  const after = await next.evaluate((button) => {
    (button as HTMLButtonElement).click();
    const strip = document.querySelector('[aria-roledescription="carousel"]')!;
    return { left: strip.scrollLeft, width: strip.clientWidth };
  });
  expect(after.left).toBeCloseTo(after.width * 2, 0);
  await expect(badge(page, '3/3')).toBeVisible();
  await tabTo(page, moreButton(page));
  await page.keyboard.press('Enter');
  await expect(deleteRow(page)).toBeFocused();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('alertdialog', { name: 'この投稿を削除しますか？' });
  await expect(dialog).toBeVisible();
  expect(await serious()).toEqual([]);
  // The focus stays inside the dialog however many times Tab is pressed.
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(moreButton(page)).toBeFocused();
});
