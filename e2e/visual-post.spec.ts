import type { Locator, Page } from '@playwright/test';
import { freshUser as test, expect, type NewUser } from './support/auth';
import { expectNoSeriousViolations } from './support/axe';
import { insertComments } from './support/comments';
import { seedUser } from './support/db';
import { waitForHydration } from './support/hydration';
import { expectPx, rect, styles, VIEWPORTS } from './support/measure';
import { insertPost, postRowCount, putPostFiles } from './support/posts';

const GRAY = 'rgb(115, 115, 115)';
const BORDER = 'rgb(219, 219, 219)';
const HIGHLIGHT = 'rgb(239, 239, 239)';
const INDIGO = 'rgb(79, 70, 200)';
const DANGER = 'rgb(214, 45, 60)';

type Shape = { width: number; height: number };
const PORTRAIT: Shape = { width: 1080, height: 1350 };
const SQUARE: Shape = { width: 1080, height: 1080 };

const unique = (prefix: string) =>
  `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** A post with its photo files, by `me` or by a stranger; `liked` presses the heart once as `me`. */
async function seedPost(
  page: Page,
  me: NewUser,
  options: { own: boolean; shape?: Shape; caption?: string; mediaCount?: number },
) {
  let author = me.username;
  if (!options.own) {
    author = unique('e2e_p');
    seedUser(author, `${author}@example.com`);
  }
  const post = insertPost({
    authorUsername: author,
    caption: options.caption ?? '投稿の画面の試験',
    mediaCount: options.mediaCount ?? 1,
    ...(options.shape ?? PORTRAIT),
  });
  await putPostFiles(page, post);
  return { author, post };
}

const detail = (page: Page) => page.locator('article[data-post-detail]');
const photo = (page: Page) => detail(page).locator('[data-post-media]');
const comments = (page: Page) => detail(page).locator('section[aria-label="コメント"]');
const meta = (page: Page) => detail(page).locator('[data-post-meta]');
const menuButton = (page: Page) => detail(page).getByRole('button', { name: 'その他の操作' });

async function openPost(page: Page, id: string, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto(`/p/${id}`);
  await waitForHydration(page);
  await expect(detail(page)).toBeVisible();
}

async function like(page: Page) {
  await detail(page).getByRole('button', { name: 'いいね', exact: true }).click();
  await expect(detail(page).getByRole('button', { name: '1 件のいいね' })).toBeVisible();
}

test('広い画面の投稿は写真と 335px のコメントの列の 2 列', async ({ page, me }) => {
  const portrait = await seedPost(page, me, { own: false, shape: PORTRAIT });
  const square = await seedPost(page, me, { own: false, shape: SQUARE });
  for (const viewport of [VIEWPORTS.wide, VIEWPORTS.narrow]) {
    const at = `${viewport.width}px`;
    // AC-1: 4:5 → the photo column is 480x600 and the box is 817 wide.
    await openPost(page, portrait.post.id, viewport);
    const box = await styles(detail(page), ['border-top-width', 'border-top-color']);
    expect(box['border-top-width'], `${at} 箱の枠の太さ`).toBe('1px');
    expect(box['border-top-color'], `${at} 箱の枠の色`).toBe(BORDER);
    expectPx((await rect(detail(page))).width, 817, `${at} 4:5 の箱の幅`);
    const column = await rect(photo(page));
    expectPx(column.width, 480, `${at} 4:5 の写真の列の幅`);
    expectPx(column.height, 600, `${at} 4:5 の写真の列の高さ`);
    const style = await styles(photo(page), ['background-color', 'border-right-width']);
    expect(style['background-color'], `${at} 写真の列の背景`).toBe('rgb(0, 0, 0)');
    expect(style['border-right-width'], `${at} 写真の列の右の線`).toBe('1px');
    const header = await rect(detail(page).locator('header'));
    expectPx(header.width, 335, `${at} 右の列の幅`);
    const form = await rect(detail(page).getByTestId('comment-form'));
    expectPx(form.y + form.height - header.y, 600, `${at} 右の列の高さ`);

    // AC-2: 1:1 → 600x600 and 937 wide.
    await openPost(page, square.post.id, viewport);
    const flat = await rect(photo(page));
    expectPx(flat.width, 600, `${at} 1:1 の写真の列の幅`);
    expectPx(flat.height, 600, `${at} 1:1 の写真の列の高さ`);
    expectPx((await rect(detail(page))).width, 937, `${at} 1:1 の箱の幅`);
  }
});

test('右の列はヘッダー・コメント・操作・入力の順で、コメントは中でスクロールする', async ({
  page,
  me,
}) => {
  const { post } = await seedPost(page, me, { own: false, caption: '右の列のキャプション' });
  await openPost(page, post.id, VIEWPORTS.wide);
  await like(page);
  const before = await rect(detail(page));

  const header = detail(page).locator('header');
  const head = await rect(header);
  expectPx(head.height, 60, 'ヘッダーの高さ');
  const avatar = await rect(header.locator('> :first-child'));
  expectPx(avatar.width, 32, 'アバターの幅');
  expectPx(avatar.height, 32, 'アバターの高さ');
  const name = await styles(header.getByRole('link', { name: /^e2e_p/ }), [
    'font-size',
    'font-weight',
  ]);
  expect(name['font-size'], '名前の大きさ').toBe('14px');
  expect(name['font-weight'], '名前の太さ').toBe('600');
  const more = await rect(menuButton(page));
  expectPx(more.width, 44, 'その他の操作の幅');
  expectPx(more.height, 44, 'その他の操作の高さ');
  expectPx(
    more.x + more.width,
    head.x + head.width - 12,
    'その他の操作は右端（ヘッダーの余白 12px の内側）',
  );
  const line = await styles(header, ['border-bottom-width', 'border-bottom-color']);
  expect(line['border-bottom-width'], 'ヘッダーの下の線').toBe('1px');
  expect(line['border-bottom-color'], 'ヘッダーの下の線の色').toBe(BORDER);

  const list = comments(page);
  expect((await styles(list, ['overflow-y']))['overflow-y'], 'コメントの領域').toBe('auto');
  const actions = meta(page);
  const top = await styles(actions, ['border-top-width', 'border-top-color']);
  expect(top['border-top-width'], '操作の領域の上の線').toBe('1px');
  expect(top['border-top-color'], '操作の領域の上の線の色').toBe(HIGHLIGHT);
  await expect(actions.getByRole('button', { name: 'いいね', exact: true })).toBeVisible();
  await expect(actions.getByRole('link', { name: /^コメント \d+ 件$/ })).toBeVisible();
  await expect(actions.getByRole('button', { name: '保存' })).toBeVisible();
  const count = await styles(actions.getByRole('button', { name: '1 件のいいね' }), [
    'font-size',
    'font-weight',
  ]);
  expect(count['font-size'], 'いいねの数の大きさ').toBe('14px');
  expect(count['font-weight'], 'いいねの数の太さ').toBe('600');
  const when = await styles(actions.locator('time'), ['font-size', 'color']);
  expect(when['font-size'], '時刻の大きさ').toBe('12px');
  expect(when['color'], '時刻の色').toBe(GRAY);

  const form = await rect(detail(page).getByTestId('comment-form'));
  const listBox = await rect(list);
  const actionsBox = await rect(actions);
  expect(head.y + head.height, 'ヘッダーの下にコメント').toBeLessThanOrEqual(listBox.y + 1);
  expect(listBox.y + listBox.height, 'コメントの下に操作').toBeLessThanOrEqual(actionsBox.y + 1);
  expect(actionsBox.y + actionsBox.height, '操作の下に入力').toBeLessThanOrEqual(form.y + 1);

  insertComments(
    Array.from({ length: 30 }, (_, i) => ({
      postId: post.id,
      authorUsername: me.username,
      body: `長い一覧のコメント ${i}`,
    })),
  );
  await openPost(page, post.id, VIEWPORTS.wide);
  const after = await rect(detail(page));
  expectPx(after.height, before.height, '30 件あっても箱の高さは変わらない');
  expectPx(after.height, 602, '箱の高さ（内側 600px と枠 1px ずつ）');
  const scroll = await list.evaluate((el) => ({ all: el.scrollHeight, shown: el.clientHeight }));
  expect(
    scroll.all,
    `コメントの領域の中がスクロールする（${scroll.all} > ${scroll.shown}）`,
  ).toBeGreaterThan(scroll.shown + 100);
  await list.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(list.locator('li').last()).toBeInViewport();
  expectPx((await rect(detail(page))).height, before.height, 'スクロールしても箱は動かない');
});

test('狭い画面の投稿は 1 列', async ({ page, me }) => {
  const { post } = await seedPost(page, me, { own: false, caption: '狭い画面のキャプション' });
  insertComments([{ postId: post.id, authorUsername: me.username, body: '狭い画面のコメント' }]);
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 1023, height: 800 },
  ]) {
    const at = `${viewport.width}px`;
    await openPost(page, post.id, viewport);
    if (viewport.width === 375) await like(page);
    const box = await styles(detail(page), ['border-top-width']);
    expect(box['border-top-width'], `${at} 箱に枠が無い`).toBe('0px');
    const img = await rect(photo(page).getByRole('img'));
    expectPx(img.width, Math.min(viewport.width, 470), `${at} 写真の幅`);
    const ys = {
      header: (await rect(detail(page).locator('header'))).y,
      photo: img.y,
      bar: (await rect(meta(page).locator('[data-slot="post-actions"]'))).y,
      likes: (await rect(meta(page).getByRole('button', { name: '1 件のいいね' }))).y,
      comments: (await rect(comments(page))).y,
    };
    const order = Object.values(ys);
    expect(order, `${at} 縦の並び ${JSON.stringify(ys)}`).toEqual([...order].sort((a, b) => a - b));
    // The box is `sticky` on a narrow screen, so its position is judged by the document order.
    expect(
      await comments(page).evaluate(
        (el) =>
          !!(
            el.compareDocumentPosition(document.querySelector('[data-testid="comment-form"]')!) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ),
      ),
      `${at} 入力はコメントの後`,
    ).toBe(true);
    expect(new Set(order).size, `${at} 全て別の高さ`).toBe(order.length);
    const caption = await rect(comments(page).getByText('狭い画面のキャプション'));
    expect(caption.y, `${at} キャプションはコメントの前`).toBeLessThan(
      (await rect(comments(page).getByText('狭い画面のコメント'))).y,
    );
  }
});

test('コメントは名前の横に時刻、下に返信の文字', async ({ page, me }) => {
  const { post } = await seedPost(page, me, { own: false, caption: 'コメントの形のキャプション' });
  insertComments([{ postId: post.id, authorUsername: me.username, body: 'コメントの形の本文' }]);
  for (const viewport of [VIEWPORTS.wide, VIEWPORTS.mobile]) {
    const at = `${viewport.width}px`;
    await openPost(page, post.id, viewport);
    const row = comments(page).locator('li').filter({ hasText: 'コメントの形の本文' });
    const name = row.getByRole('link', { name: me.username });
    const nameStyle = await styles(name, ['font-size', 'font-weight']);
    expect(nameStyle['font-size'], `${at} 名前の大きさ`).toBe('14px');
    expect(nameStyle['font-weight'], `${at} 名前の太さ`).toBe('600');
    const time = row.locator('time');
    const timeStyle = await styles(time, ['font-size', 'color']);
    expect(timeStyle['font-size'], `${at} 時刻の大きさ`).toBe('14px');
    expect(timeStyle['color'], `${at} 時刻の色`).toBe(GRAY);
    const nameBox = await rect(name);
    const timeBox = await rect(time);
    expect(timeBox.x, `${at} 時刻は名前の右`).toBeGreaterThan(nameBox.x + nameBox.width - 1);
    expectPx(timeBox.y + timeBox.height / 2, nameBox.y + nameBox.height / 2, `${at} 同じ行`);
    const body = row.getByText('コメントの形の本文', { exact: true });
    const bodyStyle = await styles(body, ['font-size', 'line-height']);
    expect(bodyStyle['font-size'], `${at} 本文の大きさ`).toBe('14px');
    expect(bodyStyle['line-height'], `${at} 本文の行の高さ`).toBe('18px');
    expect((await rect(body)).y, `${at} 本文は 2 行目`).toBeGreaterThan(nameBox.y + 10);
    for (const label of ['返信する', '削除']) {
      const button = row.getByRole('button', { name: new RegExp(label) });
      const text = await styles(button, ['font-size', 'font-weight', 'color']);
      expect(text['font-size'], `${at} ${label} の大きさ`).toBe('12px');
      expect(text['font-weight'], `${at} ${label} の太さ`).toBe('600');
      expect(text['color'], `${at} ${label} の色`).toBe(GRAY);
      const box = await rect(button);
      expect(box.width, `${at} ${label} の幅`).toBeGreaterThanOrEqual(43.5);
      expect(box.height, `${at} ${label} の高さ`).toBeGreaterThanOrEqual(43.5);
      expect(box.y, `${at} ${label} は 3 行目`).toBeGreaterThan((await rect(body)).y);
    }
    // The caption is the first row, of the same shape.
    const caption = comments(page).locator('[data-caption]');
    await expect(caption).toContainText('コメントの形のキャプション');
    const captionName = await styles(caption.getByRole('link'), ['font-weight']);
    expect(captionName['font-weight'], `${at} キャプションの名前の太さ`).toBe('600');
    await expect(caption.locator('time')).toHaveCount(1);
  }
});

test('コメントとキャプションの頭の名前は 44×44px 以上で押せる', async ({ page, me }) => {
  const { post } = await seedPost(page, me, {
    own: false,
    caption: '名前の押せる範囲のキャプション',
  });
  insertComments([
    { postId: post.id, authorUsername: me.username, body: '名前の押せる範囲の本文' },
  ]);
  for (const viewport of Object.values(VIEWPORTS)) {
    await openPost(page, post.id, viewport);
    const links = [
      comments(page).locator('[data-caption]').getByRole('link', { name: /./ }).first(),
      comments(page)
        .locator('li')
        .filter({ hasText: '名前の押せる範囲の本文' })
        .getByRole('link', { name: me.username }),
    ];
    for (const [i, link] of links.entries()) {
      await expect(link).toBeVisible();
      const box = await rect(link);
      const at = `${viewport.width}px ${i === 0 ? 'キャプション' : 'コメント'}`;
      expect(box.height, `${at} 名前の高さ`).toBeGreaterThanOrEqual(43.5);
      expect(box.width, `${at} 名前の幅`).toBeGreaterThanOrEqual(43.5);
    }
  }
});

/** A public post opened by a visitor who is not signed in. */
async function openAsVisitor(page: Page, id: string, viewport: { width: number; height: number }) {
  await page.context().clearCookies();
  await openPost(page, id, viewport);
  const row = comments(page).locator('xpath=following-sibling::p[.//a[@href="/accounts/login"]]');
  return { row, link: row.getByRole('link', { name: 'ログイン' }) };
}

test('ログインしていない人のログインのリンクは 44×44px 以上で押せる', async ({ page, me }) => {
  const { post } = await seedPost(page, me, { own: false });
  for (const viewport of Object.values(VIEWPORTS)) {
    const { link } = await openAsVisitor(page, post.id, viewport);
    await expect(link).toBeVisible();
    const box = await rect(link);
    const at = `${viewport.width}px`;
    expect(box.height, `${at} ログインの高さ`).toBeGreaterThanOrEqual(43.5);
    expect(box.width, `${at} ログインの幅`).toBeGreaterThanOrEqual(43.5);
  }
});

test('ログインのリンクの押せる範囲を広げても行は動かない', async ({ page, me }) => {
  const { post } = await seedPost(page, me, { own: false });
  for (const viewport of Object.values(VIEWPORTS)) {
    const { row, link } = await openAsVisitor(page, post.id, viewport);
    await expect(link).toBeVisible();
    const at = `${viewport.width}px`;
    // The row is its line plus the 16px padding above and below; the link adds nothing to it.
    const own = await row.evaluate((el) => {
      const c = getComputedStyle(el);
      return parseFloat(c.lineHeight) + parseFloat(c.paddingTop) + parseFloat(c.paddingBottom);
    });
    expectPx((await rect(row)).height, own, `${at} 行の高さ`);
    // The text after the link sits on the row's own line, as it did with a plain link.
    const after = await row.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el.lastChild as Node);
      const { top, height } = range.getBoundingClientRect();
      const c = getComputedStyle(el);
      return { top: top - el.getBoundingClientRect().top - parseFloat(c.paddingTop), height };
    });
    expectPx(after.top, 0, `${at} 文の上の位置`);
  }
});

test('コメントの入力は枠なしで、送信は文字のボタン', async ({ page, me }) => {
  const { post } = await seedPost(page, me, { own: false });
  for (const viewport of [VIEWPORTS.wide, VIEWPORTS.mobile]) {
    const at = `${viewport.width}px`;
    await openPost(page, post.id, viewport);
    const input = detail(page).getByRole('textbox', { name: 'コメントを追加' });
    const send = detail(page).getByRole('button', { name: '投稿', exact: true });
    expect((await styles(input, ['border-top-width']))['border-top-width'], `${at} 枠`).toBe('0px');
    expectPx((await rect(input)).height, 44, `${at} 入力の高さ`);
    await expect(send).toBeDisabled();
    const style = await styles(send, ['color', 'font-weight']);
    expect(style['font-weight'], `${at} 送信の太さ`).toBe('600');
    await input.fill(`枠なしから送るコメント ${viewport.width}`);
    await expect(send).toBeEnabled();
    expect((await styles(send, ['color']))['color'], `${at} 送信の色`).toBe(INDIGO);
    await send.click();
    await expect(input).toHaveValue('');
    const rows = comments(page).locator('li');
    await expect(rows.last()).toContainText(`枠なしから送るコメント ${viewport.width}`);
  }
});

test('削除はその他の操作のメニューにあり、自分の投稿だけ', async ({ page, me }) => {
  const mine = await seedPost(page, me, { own: true });
  const theirs = await seedPost(page, me, { own: false });
  for (const viewport of [VIEWPORTS.wide, VIEWPORTS.mobile]) {
    await openPost(page, mine.post.id, viewport);
    const sheet = page.getByRole('dialog', { name: 'その他の操作' });
    await expect(page.getByRole('button', { name: '削除', exact: true })).toBeHidden();
    await menuButton(page).click();
    await expect(sheet).toBeVisible();
    const remove = sheet.getByRole('button', { name: '削除', exact: true });
    await expect(remove).toBeVisible();
    expect((await styles(remove, ['color']))['color'], '削除の色').toBe(DANGER);
    await expect(sheet.getByRole('link', { name: '投稿へ移動' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'リンクをコピー' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'キャンセル' })).toBeVisible();
    // The focus moved into the menu, onto its first row.
    await expect(remove).toBeFocused();

    const confirmation = page.getByRole('alertdialog', { name: 'この投稿を削除しますか？' });
    await remove.click();
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: 'キャンセル' }).click();
    await expect(confirmation).toBeHidden();
    await expect(menuButton(page)).toBeFocused();
    await expect(sheet).toBeHidden();
    expect(postRowCount(mine.post.id)).toBe(1);

    await openPost(page, theirs.post.id, viewport);
    await menuButton(page).click();
    await expect(page.getByRole('dialog', { name: 'その他の操作' })).toBeVisible();
    await expect(page.getByRole('button', { name: '削除', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: '投稿へ移動' })).toBeFocused();
  }
  await openPost(page, mine.post.id, VIEWPORTS.wide);
  await menuButton(page).click();
  await page.getByRole('button', { name: '削除', exact: true }).click();
  await page
    .getByRole('alertdialog', { name: 'この投稿を削除しますか？' })
    .getByRole('button', { name: '削除', exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/${me.username}$`));
  expect(postRowCount(mine.post.id)).toBe(0);
});

test('メニューから Tab で出ると閉じる', async ({ page, me }) => {
  const { post } = await seedPost(page, me, { own: true });
  await openPost(page, post.id, VIEWPORTS.wide);
  await menuButton(page).click();
  const sheet = page.getByRole('dialog', { name: 'その他の操作' });
  await expect(sheet).toBeVisible();
  // The focus moves into the menu (async, on its toggle); Tab only after it is on the first row.
  await expect(sheet.getByRole('button', { name: '削除', exact: true })).toBeFocused();
  for (let i = 0; i < 6; i += 1) await page.keyboard.press('Tab');
  await expect(sheet).toBeHidden();
  expect(
    await page.evaluate(() => document.activeElement?.closest('[popover]') === null),
    'フォーカスはメニューの外',
  ).toBe(true);
});

/** A stranger's post with a tile on their profile, opened as a modal by `me`. */
async function openModal(
  page: Page,
  me: NewUser,
  viewport: { width: number; height: number },
  shape: Shape = PORTRAIT,
) {
  const { author, post } = await seedPost(page, me, { own: false, shape });
  await page.setViewportSize(viewport);
  await page.goto(`/${author}`);
  await waitForHydration(page);
  await page.locator(`[data-testid="post-grid"] a[href="/p/${post.id}"]`).click();
  const modal = page.getByRole('dialog', { name: '投稿', exact: true });
  await expect(modal).toBeVisible();
  await expect(modal.locator('article[data-post-detail]')).toBeVisible();
  // Measure after the fade-in has finished (it moves the box 8px).
  await modal.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
  return { author, post, modal };
}

test('モーダルは暗い背景の上の 2 列で、閉じるは外の右上の ×', async ({ page, me }) => {
  const { modal } = await openModal(page, me, VIEWPORTS.wide);
  const backdrop = modal.locator('xpath=..');
  // black at 65%: Tailwind's color-mix comes back from the browser as oklab(0 0 0 / 0.65)
  expect((await styles(backdrop, ['background-color']))['background-color'], '背景').toMatch(
    /^(rgba\(0, 0, 0, 0\.65\)|oklab\(0 0 0 \/ 0\.65\))$/,
  );
  const column = await rect(modal.locator('[data-post-media]'));
  expectPx(column.height, 720, '写真の列の高さ（画面の高さ − 80px）');
  expectPx(column.width, 576, '写真の列の幅（高さ × 4/5）');
  const article = await rect(modal.locator('article[data-post-detail]'));
  const close = modal.getByRole('button', { name: '閉じる' });
  const button = await rect(close);
  expectPx(button.width, 44, '閉じるの幅');
  expectPx(button.height, 44, '閉じるの高さ');
  expect(button.x, '閉じるは箱の外の右').toBeGreaterThanOrEqual(article.x + article.width - 1);
  expect(button.y, '閉じるは上').toBeLessThan(article.y + 44);
  expect((await styles(close, ['color']))['color'], '閉じるの色').toBe('rgb(255, 255, 255)');
  await expect(close.locator('svg')).toBeVisible();
});

test('狭い画面のモーダルは全画面の 1 列', async ({ page, me }) => {
  const { modal } = await openModal(page, me, VIEWPORTS.mobile);
  const box = await rect(modal);
  expectPx(box.width, 375, 'モーダルの幅');
  expectPx(box.height, 812, 'モーダルの高さ');
  const backdrop = modal.locator('xpath=..');
  expect((await styles(backdrop, ['background-color']))['background-color'], '背景').toBe(
    'rgb(255, 255, 255)',
  );
  const close = await rect(modal.getByRole('button', { name: '閉じる' }));
  expectPx(close.width, 44, '閉じるの幅');
  expectPx(close.height, 44, '閉じるの高さ');
  expectPx(close.x + close.width, 375, '閉じるは右端');
  expect(close.y, '閉じるは上').toBeLessThan(48);
  expect(
    (await styles(modal.locator('article[data-post-detail]'), ['border-top-width']))[
      'border-top-width'
    ],
  ).toBe('0px');
  const header = await rect(modal.locator('header'));
  const media = await rect(modal.locator('[data-post-media]'));
  expect(media.y, '写真はヘッダーの下').toBeGreaterThanOrEqual(header.y + header.height - 1);
});

test('投稿の画面とモーダルに axe の重大な違反が無く、キーボードで順に辿れる', async ({
  page,
  me,
}) => {
  const { post } = await seedPost(page, me, {
    own: false,
    caption: 'キーボードの順のキャプション',
  });
  insertComments([{ postId: post.id, authorUsername: me.username, body: 'キーボードの順の本文' }]);
  const focusOrder = async (scope: Locator) => {
    const seen: string[] = [];
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Tab');
      const label = await page.evaluate(
        () =>
          document.activeElement?.getAttribute('aria-label') ??
          document.activeElement?.getAttribute('placeholder') ??
          document.activeElement?.textContent?.trim() ??
          '',
      );
      const inside = await scope.evaluate((el) => el.contains(document.activeElement));
      if (!inside) break;
      seen.push(label);
    }
    return seen;
  };
  const expectInOrder = (seen: string[], wanted: Array<string | RegExp>, at: string) => {
    let from = 0;
    for (const want of wanted) {
      const index = seen.findIndex(
        (s, i) => i >= from && (typeof want === 'string' ? s === want : want.test(s)),
      );
      expect(
        index,
        `${at} ${String(want)} の位置（${JSON.stringify(seen)}）`,
      ).toBeGreaterThanOrEqual(from);
      from = index + 1;
    }
  };
  const small = async (scope: Locator, at: string) => {
    const bad = await scope
      .locator('a[href], button, input:not([type="hidden"])')
      .evaluateAll((els) =>
        els
          .filter(
            (el) =>
              (el as HTMLElement).offsetParent !== null ||
              getComputedStyle(el).position === 'fixed',
          )
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(
            ({ el, r }) =>
              r.width > 0 &&
              (r.width < 43.5 || r.height < 43.5) &&
              !el.closest('[popover]:not(:popover-open)') &&
              // A link inside a line of text (a name in a comment) is exempt (WCAG 2.5.8, inline).
              !el.closest('p') &&
              !(el as HTMLElement).classList.contains('sr-only'),
          )
          .map(
            ({ el, r }) =>
              `${el.tagName} ${el.getAttribute('aria-label') ?? el.textContent} ${r.width}x${r.height}`,
          ),
      );
    expect(bad, `${at} 44px に満たない操作`).toEqual([]);
  };

  const WIDTHS = [375, 1024, 1280];
  for (const width of WIDTHS) {
    const at = `${width}px 投稿の画面`;
    await openPost(page, post.id, { width, height: 800 });
    if (width === WIDTHS[0]) await like(page);
    await menuButton(page).click();
    await expect(page.getByRole('dialog', { name: 'その他の操作' })).toBeVisible();
    await expectNoSeriousViolations(page, `${at}（メニューを開いた状態）`);
    await page.keyboard.press('Escape');
    await expectNoSeriousViolations(page, at);
    await small(detail(page), at);
    await page.locator('html').click({ position: { x: 1, y: 1 } });
    await menuButton(page).focus();
    await page.keyboard.press('Shift+Tab');
    const seen = await focusOrder(detail(page));
    expectInOrder(
      seen,
      [
        'その他の操作',
        'いいね',
        /^コメント \d+ 件$/,
        '保存',
        '1 件のいいね',
        /返信する/,
        'コメントを追加…',
      ],
      at,
    );
  }
  for (const width of WIDTHS) {
    const at = `${width}px モーダル`;
    const { modal } = await openModal(page, me, { width, height: 800 }, SQUARE);
    await menuButton(page).click();
    await expect(page.getByRole('dialog', { name: 'その他の操作' })).toBeVisible();
    await expectNoSeriousViolations(page, `${at}（メニューを開いた状態）`);
    await page.keyboard.press('Escape');
    await expectNoSeriousViolations(page, at);
    await small(modal, at);
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  }
});
