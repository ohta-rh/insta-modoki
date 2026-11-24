import type { Locator, Page } from '@playwright/test';
import { freshUser as test, expect, type NewUser } from './support/auth';
import { expectNoSeriousViolations } from './support/axe';
import { commentRows, insertComments } from './support/comments';
import { seedFollow, seedUser, userRow } from './support/db';
import { holdScripts, waitForHydration } from './support/hydration';
import { expectPx, rect, styles, VIEWPORTS } from './support/measure';
import { insertPost, type InsertedPost } from './support/posts';

const GRAY = 'rgb(115, 115, 115)';
const INDIGO = 'rgb(79, 70, 200)';
const DANGER = 'rgb(214, 45, 60)';
const LONG_CAPTION = 'とても長いキャプション。'.repeat(30);

type Shape = { caption: string; width: number; height: number; alt: string };

/** A user `me` follows, with the given posts (the last of the list is the newest). */
function followedPosts(me: NewUser, shapes: Shape[]) {
  const username = `e2e_v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  seedUser(username, `${username}@example.com`);
  seedFollow(userRow(me.username)!.id as string, userRow(username)!.id as string);
  const start = Date.now() - 3 * 3_600_000;
  const posts: InsertedPost[] = shapes.map((s, i) =>
    insertPost({
      authorUsername: username,
      caption: s.caption,
      width: s.width,
      height: s.height,
      altTexts: [s.alt],
      createdAt: start + i * 60_000,
    }),
  );
  return { username, posts };
}

const card = (page: Page, caption: string) =>
  page.getByRole('article').filter({ hasText: caption });
const home = async (page: Page, viewport: { width: number; height: number }) => {
  await page.setViewportSize(viewport);
  await page.goto('/');
  await waitForHydration(page);
};
const menuButton = (c: Locator) => c.getByRole('button', { name: 'その他の操作' });
const input = (c: Locator) => c.getByRole('textbox', { name: 'コメントを追加' });
const send = (c: Locator) => c.getByRole('button', { name: '投稿', exact: true });

const VIEWPORT_LIST = Object.values(VIEWPORTS);

test('フィードの列とカードは 470px で、写真は投稿の比率のまま', async ({ page, me }) => {
  followedPosts(me, [
    { caption: '正方形の投稿', width: 1080, height: 1080, alt: '正方形の写真' },
    { caption: '縦長の投稿', width: 1080, height: 1350, alt: '縦長の写真' },
  ]);
  for (const viewport of VIEWPORT_LIST) {
    await home(page, viewport);
    const wide = viewport.width >= 768;
    const column = wide ? 470 : viewport.width;
    const at = `${viewport.width}px`;
    const portrait = card(page, '縦長の投稿');
    const square = card(page, '正方形の投稿');
    expectPx(
      (await rect(page.locator('section[aria-label="フィード"]'))).width,
      column,
      `${at} フィードの列の幅`,
    );
    expectPx((await rect(portrait)).width, column, `${at} カードの幅`);
    const tall = await rect(portrait.getByRole('img', { name: '縦長の写真' }));
    expectPx(tall.width, column, `${at} 4:5 の写真の幅`);
    expectPx(tall.height, column * 1.25, `${at} 4:5 の写真の高さ`);
    const flat = await rect(square.getByRole('img', { name: '正方形の写真' }));
    expectPx(flat.width, column, `${at} 1:1 の写真の幅`);
    expectPx(flat.height, column, `${at} 1:1 の写真の高さ`);
  }
});

test('カードのヘッダーに名前・時刻・その他の操作が並ぶ', async ({ page, me }) => {
  const { username, posts } = followedPosts(me, [
    { caption: 'ヘッダーの投稿', width: 1080, height: 1350, alt: 'ヘッダーの写真' },
  ]);
  for (const viewport of VIEWPORT_LIST) {
    await home(page, viewport);
    const at = `${viewport.width}px`;
    const c = card(page, 'ヘッダーの投稿');
    const header = c.locator('header');
    expectPx((await rect(header)).height, 56, `${at} ヘッダーの高さ`);
    const avatar = await rect(header.locator('> :first-child'));
    expectPx(avatar.width, 32, `${at} アバターの幅`);
    expectPx(avatar.height, 32, `${at} アバターの高さ`);
    const name = header.getByRole('link', { name: username, exact: true });
    const nameStyle = await styles(name, ['font-size', 'font-weight']);
    expect(nameStyle['font-size'], `${at} 名前の大きさ`).toBe('14px');
    expect(nameStyle['font-weight'], `${at} 名前の太さ`).toBe('600');
    await expect(header.getByText('•', { exact: true })).toHaveCount(1);
    const when = header.locator(`> a[href="/p/${posts[0]!.id}"]`);
    await expect(when.locator('time')).toHaveCount(1);
    const whenStyle = await styles(when, ['font-size', 'color']);
    expect(whenStyle['font-size'], `${at} 時刻の大きさ`).toBe('14px');
    expect(whenStyle['color'], `${at} 時刻の色`).toBe(GRAY);
    const more = await rect(menuButton(c));
    expectPx(more.width, 44, `${at} その他の操作の幅`);
    expectPx(more.height, 44, `${at} その他の操作の高さ`);
    expect(more.x, `${at} その他の操作は時刻の右`).toBeGreaterThan((await rect(when)).x);
    await expect(c.locator('time'), `${at} カードの中の時刻は 1 つだけ`).toHaveCount(1);
  }
});

test('その他の操作から投稿へ移動とリンクのコピーができる', async ({ page, context, me }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { posts } = followedPosts(me, [
    { caption: 'メニューの投稿', width: 1080, height: 1350, alt: 'メニューの写真' },
  ]);
  const id = posts[0]!.id;
  for (const viewport of [VIEWPORTS.wide, VIEWPORTS.mobile]) {
    await home(page, viewport);
    const c = card(page, 'メニューの投稿');
    const trigger = menuButton(c);
    await trigger.click();
    const goto = page.getByRole('link', { name: '投稿へ移動' });
    await expect(goto).toBeVisible();
    await expect(goto).toHaveAttribute('href', `/p/${id}`);
    await expect(page.getByRole('button', { name: 'キャンセル' })).toBeVisible();

    await page.getByRole('button', { name: 'リンクをコピー' }).click();
    await expect(
      c.getByRole('status').filter({ hasText: 'リンクをコピーしました' }),
    ).toBeAttached();
    await expect(goto).toBeHidden();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      `${new URL(page.url()).origin}/p/${id}`,
    );

    await trigger.click();
    await expect(goto).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(goto).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page.getByRole('button', { name: 'キャンセル' }).click();
    await expect(goto).toBeHidden();
    await expect(trigger).toBeFocused();
  }
});

test('操作の列は 44px のボタンが間を空けずに並び、保存は右端', async ({ page, me }) => {
  followedPosts(me, [{ caption: '操作の列の投稿', width: 1080, height: 1350, alt: '操作の写真' }]);
  for (const viewport of [VIEWPORTS.mobile, VIEWPORTS.wide]) {
    await home(page, viewport);
    const at = `${viewport.width}px`;
    const c = card(page, '操作の列の投稿');
    const bar = await rect(c.locator('[data-slot="post-actions"]'));
    expectPx(bar.height, 44, `${at} 操作の列の高さ`);
    const like = await rect(c.getByRole('button', { name: 'いいね', exact: true }));
    const comment = await rect(c.getByRole('link', { name: /^コメント \d+ 件$/ }));
    const save = await rect(c.getByRole('button', { name: '保存' }));
    for (const [label, r] of [
      ['いいね', like],
      ['コメント', comment],
      ['保存', save],
    ] as const) {
      expectPx(r.width, 44, `${at} ${label}の幅`);
      expectPx(r.height, 44, `${at} ${label}の高さ`);
    }
    expectPx(comment.x - like.x, 44, `${at} いいねとコメントの左端の差`);
    const gap = bar.x + bar.width - (save.x + save.width);
    expect(gap, `${at} 保存の右端と列の右端の差: ${gap}px（参照 4px 以下）`).toBeLessThanOrEqual(4);
  }
});

test('いいねの数は操作の列の下の行に出る', async ({ page, me }) => {
  followedPosts(me, [{ caption: 'いいねの数の投稿', width: 1080, height: 1350, alt: '数の写真' }]);
  await home(page, VIEWPORTS.mobile);
  await card(page, 'いいねの数の投稿').getByRole('button', { name: 'いいね', exact: true }).click();
  for (const viewport of [VIEWPORTS.mobile, VIEWPORTS.wide]) {
    await home(page, viewport);
    const at = `${viewport.width}px`;
    const c = card(page, 'いいねの数の投稿');
    const count = c.getByRole('button', { name: '1 件のいいね' });
    await expect(count).toBeVisible();
    const bar = await rect(c.locator('[data-slot="post-actions"]'));
    const box = await rect(count);
    expect(
      box.y,
      `${at} 数の行の上端 ${box.y}px は操作の列の下端 ${bar.y + bar.height}px 以降`,
    ).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
    expectPx(box.x - (await rect(c)).x, 12, `${at} 数の左端とカードの左端の差`);
    const style = await styles(count, ['font-size', 'font-weight']);
    expect(style['font-size'], `${at} 数の大きさ`).toBe('14px');
    expect(style['font-weight'], `${at} 数の太さ`).toBe('600');
    await count.click();
    await expect(page.getByRole('dialog', { name: 'いいねした人' })).toBeVisible();
    await page.keyboard.press('Escape');
  }
});

test('長いキャプションは 2 行で切れ、続きを読むで全部出る', async ({ page, me }) => {
  const { username } = followedPosts(me, [
    { caption: 'みじかい', width: 1080, height: 1350, alt: '短い写真' },
    { caption: LONG_CAPTION, width: 1080, height: 1350, alt: '長い写真' },
  ]);
  for (const viewport of [VIEWPORTS.mobile, VIEWPORTS.wide]) {
    await home(page, viewport);
    const at = `${viewport.width}px`;
    const long = card(page, 'とても長いキャプション');
    const paragraph = long.locator('p', { hasText: 'とても長いキャプション' });
    const more = long.getByRole('link', { name: '続きを読む' });
    await expect(more).toBeVisible();
    expectPx((await rect(paragraph)).height, 36, `${at} 切れた段落の高さ`);
    const moreStyle = await styles(more, ['font-size', 'color']);
    expect(moreStyle['font-size'], `${at} 続きを読むの大きさ`).toBe('14px');
    expect(moreStyle['color'], `${at} 続きを読むの色`).toBe(GRAY);
    const nameInCaption = paragraph.getByRole('link', { name: username, exact: true });
    expect((await styles(nameInCaption, ['font-weight']))['font-weight']).toBe('600');

    if (viewport === VIEWPORTS.wide) {
      // Keyboard: Tab lands on the link, the outline surrounds the whole press area, Enter opens.
      await more.focus();
      await expect(more).toBeFocused();
      const outline = await styles(more, ['outline-style']);
      expect(outline['outline-style'], `${at} フォーカスの輪郭`).not.toBe('none');
      expect((await rect(more)).height, `${at} 輪郭が囲む範囲の高さ`).toBeGreaterThanOrEqual(44);
      await page.keyboard.press('Enter');
    } else {
      await more.click();
    }
    await expect(more).toHaveCount(0);
    await expect(paragraph).toBeFocused();
    expect((await rect(paragraph)).height, `${at} 開いた段落の高さ`).toBeGreaterThan(37);

    const short = card(page, 'みじかい');
    await expect(short.getByRole('link', { name: '続きを読む' })).toHaveCount(0);
  }
});

/** The box of the link's own text (the line), apart from the area that can be pressed. */
const textBox = (locator: Locator) =>
  locator.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const { y, height } = range.getBoundingClientRect();
    return { y, height };
  });

test('続きを読むは高さ 44px 以上で押せる', async ({ page, me }) => {
  followedPosts(me, [{ caption: LONG_CAPTION, width: 1080, height: 1350, alt: '長い写真' }]);
  for (const viewport of VIEWPORT_LIST) {
    await home(page, viewport);
    const more = card(page, 'とても長いキャプション').getByRole('link', { name: '続きを読む' });
    await expect(more).toBeVisible();
    const box = await rect(more);
    expect(box.height, `${viewport.width}px 続きを読むの高さ`).toBeGreaterThanOrEqual(44);
  }
});

test('続きを読むの押せる範囲を広げてもカードの縦の並びは変わらない', async ({ page, me }) => {
  followedPosts(me, [{ caption: LONG_CAPTION, width: 1080, height: 1350, alt: '長い写真' }]);
  for (const viewport of [VIEWPORTS.mobile, VIEWPORTS.wide]) {
    await home(page, viewport);
    const at = `${viewport.width}px`;
    const c = card(page, 'とても長いキャプション');
    const paragraph = await rect(c.locator('p', { hasText: 'とても長いキャプション' }));
    const text = await textBox(c.getByRole('link', { name: '続きを読む' }));
    const field = await rect(input(c));
    // Before the change: the text starts where the clamped caption ends, and the input follows the text's line.
    expectPx(text.y - (paragraph.y + paragraph.height), 0, `${at} 最後の行と続きを読むの文字の間`);
    expectPx(field.y - (text.y + text.height), 0, `${at} 続きを読むの文字とコメントの入力の間`);
  }
});

test('長いキャプションのカードに axe の重大な違反が無い', async ({ page, me }) => {
  followedPosts(me, [{ caption: LONG_CAPTION, width: 1080, height: 1350, alt: '長い写真' }]);
  for (const viewport of VIEWPORT_LIST) {
    await home(page, viewport);
    await expect(
      card(page, 'とても長いキャプション').getByRole('link', { name: '続きを読む' }),
    ).toBeVisible();
    await expectNoSeriousViolations(page, `${viewport.width}px / （長いキャプション）`);
  }
});

test('スクリプトの前の続きを読むは投稿の画面へのリンク', async ({ page, me }) => {
  const { posts } = followedPosts(me, [
    { caption: LONG_CAPTION, width: 1080, height: 1350, alt: '長い写真' },
  ]);
  const release = await holdScripts(page);
  await page.goto('/', { waitUntil: 'commit' });
  const more = page.getByRole('link', { name: '続きを読む' });
  await more.waitFor();
  // Enter follows the link without the click's wait for a stable box, which a loading page may not give.
  await more.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/p/${posts[0]!.id}$`));
  release();
});

test('カードの下に枠なしのコメントの入力がある', async ({ page, me }) => {
  followedPosts(me, [{ caption: '入力の投稿', width: 1080, height: 1350, alt: '入力の写真' }]);
  for (const viewport of [VIEWPORTS.mobile, VIEWPORTS.wide]) {
    await home(page, viewport);
    const at = `${viewport.width}px`;
    const c = card(page, '入力の投稿');
    const field = input(c);
    await expect(field).toBeVisible();
    const style = await styles(field, [
      'border-top-width',
      'border-right-width',
      'border-bottom-width',
      'border-left-width',
      'font-size',
    ]);
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(style[`border-${side}-width`], `${at} 入力の枠（${side}）`).toBe('0px');
    }
    expect(style['font-size'], `${at} 入力の文字の大きさ`).toBe(
      viewport.width < 768 ? '16px' : '14px',
    );
    expectPx((await rect(field)).height, 44, `${at} 入力の高さ`);
    await expect(send(c)).toBeDisabled();
    const button = await styles(send(c), ['color', 'font-weight', 'font-size']);
    expect(button['color'], `${at} 投稿の色`).toBe(INDIGO);
    expect(button['font-weight'], `${at} 投稿の太さ`).toBe('600');
  }
});

test('カードからコメントを書ける', async ({ page, me }) => {
  const { posts } = followedPosts(me, [
    { caption: 'コメントの投稿', width: 1080, height: 1350, alt: 'コメントの写真' },
  ]);
  const id = posts[0]!.id;
  await home(page, VIEWPORTS.wide);
  const c = card(page, 'コメントの投稿');
  await expect(c.getByRole('link', { name: /をすべて見る/ })).toHaveCount(0);
  await input(c).fill('いいね');
  await expect(send(c)).toBeEnabled();
  await send(c).click();
  await expect(input(c)).toHaveValue('');
  await expect(c.getByRole('status').filter({ hasText: 'コメントを投稿しました' })).toBeAttached();
  await expect(c.getByRole('link', { name: 'コメント 1 件をすべて見る' })).toBeVisible();
  const rows = commentRows(id);
  expect(rows).toHaveLength(1);
  expect(rows[0]!['body']).toBe('いいね');
  await expect(send(c)).toBeDisabled();
});

test('コメントの上限は 2,200 字で、超えると理由を出す', async ({ page, me }) => {
  const { posts } = followedPosts(me, [
    { caption: '上限の投稿', width: 1080, height: 1350, alt: '上限の写真' },
  ]);
  const id = posts[0]!.id;
  await home(page, VIEWPORTS.wide);
  const c = card(page, '上限の投稿');
  await input(c).fill('あ'.repeat(2201));
  await send(c).click();
  const alert = c.locator('[role="alert"]', { hasText: 'コメントは 2,200 字までです' });
  await expect(alert).toBeVisible();
  expect((await styles(alert, ['color']))['color']).toBe(DANGER);
  await expect(input(c)).toHaveValue('あ'.repeat(2201));
  expect(commentRows(id)).toHaveLength(0);

  await input(c).fill('あ'.repeat(2200));
  await send(c).click();
  await expect(input(c)).toHaveValue('');
  await expect(alert).toHaveCount(0);
  expect(commentRows(id)).toHaveLength(1);
});

test('スクリプトの前でもカードからコメントを送れる', async ({ page, me }) => {
  const { posts } = followedPosts(me, [
    { caption: '前の投稿', width: 1080, height: 1350, alt: '前の写真' },
  ]);
  const release = await holdScripts(page);
  await page.goto('/', { waitUntil: 'commit' });
  const field = input(page.getByRole('article'));
  await field.waitFor();
  await expect(send(page.getByRole('article'))).toBeEnabled();
  await field.fill('スクリプトなしのコメント');
  await field.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/p/${posts[0]!.id}$`));
  await expect(page.getByText('スクリプトなしのコメント', { exact: true })).toBeVisible();
  release();
  expect(commentRows(posts[0]!.id)).toHaveLength(1);
});

test('カードの間は 20px で、下に 1px の線がある', async ({ page, me }) => {
  followedPosts(me, [
    { caption: '三件目の投稿', width: 1080, height: 1350, alt: '三の写真' },
    { caption: '二件目の投稿', width: 1080, height: 1350, alt: '二の写真' },
    { caption: '一件目の投稿', width: 1080, height: 1350, alt: '一の写真' },
  ]);
  for (const viewport of [VIEWPORTS.mobile, VIEWPORTS.wide]) {
    await home(page, viewport);
    const at = `${viewport.width}px`;
    const first = card(page, '一件目の投稿');
    const second = card(page, '二件目の投稿');
    const a = await rect(first);
    const b = await rect(second);
    expectPx(b.y - (a.y + a.height), 20, `${at} 1 件目と 2 件目の間`);
    for (const c of [first, second]) {
      const line = await styles(c, [
        'border-bottom-width',
        'border-bottom-style',
        'border-bottom-color',
      ]);
      expect(line['border-bottom-width'], `${at} 線の太さ`).toBe('1px');
      expect(line['border-bottom-style'], `${at} 線の種類`).toBe('solid');
      expect(line['border-bottom-color'], `${at} 線の色`).toBe('rgb(219, 219, 219)');
    }
  }
});

test('フィードのカードに axe の重大な違反が無く、キーボードで順に辿れる', async ({ page, me }) => {
  const { username, posts } = followedPosts(me, [
    { caption: LONG_CAPTION, width: 1080, height: 1350, alt: '辿る写真' },
  ]);
  const other = `e2e_c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  seedUser(other, `${other}@example.com`);
  insertComments([{ postId: posts[0]!.id, authorUsername: other, body: 'ひとこと' }]);

  await home(page, VIEWPORTS.mobile);
  await card(page, 'とても長いキャプション')
    .getByRole('button', { name: 'いいね', exact: true })
    .click();

  for (const viewport of VIEWPORT_LIST) {
    await home(page, viewport);
    const at = `${viewport.width}px`;
    await expectNoSeriousViolations(page, `${at} /`);
    const c = card(page, 'とても長いキャプション');
    await menuButton(c).click();
    await expect(page.getByRole('link', { name: '投稿へ移動' })).toBeVisible();
    await expectNoSeriousViolations(page, `${at} / （その他の操作を開いた状態）`);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('link', { name: '投稿へ移動' })).toBeHidden();
  }

  await home(page, VIEWPORTS.wide);
  const c = card(page, 'とても長いキャプション');
  await input(c).fill('あ');
  await c.getByRole('link', { name: username, exact: true }).first().focus();
  const stops: string[] = [];
  const stop = () =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement & { labels?: NodeListOf<HTMLElement> };
      if (el.tagName === 'A' && el.querySelector('time')) return '時刻';
      return (
        el.getAttribute('aria-label') ??
        el.labels?.[0]?.textContent ??
        (el.textContent ?? '').trim()
      );
    });
  stops.push(await stop());
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Tab');
    stops.push(await stop());
  }
  expect(stops).toEqual([
    username,
    '時刻',
    'その他の操作',
    'いいね',
    'コメント 1 件',
    '保存',
    '1 件のいいね',
    '続きを読む',
    'コメント 1 件をすべて見る',
    'コメントを追加',
    '投稿',
  ]);
});
