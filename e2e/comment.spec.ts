import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { signUpViaUi, type NewUser } from './support/auth';
import { commentRows, insertComments, postCommentCount } from './support/comments';
import { seedUser } from './support/db';
import { holdScripts, waitForHydration } from './support/hydration';
import { tabTo } from './support/keys';
import { insertPost, putPostFiles } from './support/posts';

/** `page` signed in as a new user, who is `me`. */
const signedIn = test.extend<{ me: NewUser }>({
  // `auto`: every test starts signed in, also those that never name `me`.
  me: [
    async ({ page }, use) => {
      await use(await signUpViaUi(page));
    },
    { auto: true },
  ],
});

const newName = (prefix: string) =>
  `e2e_${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** A user who is not signed in, with a post of their own that has real photo files. */
async function strangerPost(page: Page, username = newName('o')) {
  seedUser(username, `${username}@example.com`);
  const post = insertPost({ authorUsername: username, caption: '写真の説明', mediaCount: 1 });
  await putPostFiles(page, post);
  return { username, post };
}

const input = (page: Page) => page.getByLabel('コメントを追加');
const send = (page: Page) => page.getByRole('button', { name: '投稿', exact: true });
const item = (page: Page, text: string) => page.getByRole('listitem').filter({ hasText: text });
const xOf = async (page: Page, text: string) =>
  (await page.getByText(text, { exact: true }).boundingBox())!.x;

signedIn(
  'コメントと返信を送ると一覧の末尾にすぐ出て、返信は 1 階層だけ字下げされる',
  async ({ page, me }) => {
    const { post } = await strangerPost(page);
    await page.goto(`/p/${post.id}`);
    await waitForHydration(page);

    // 空のとき押せない。
    await expect(send(page)).toBeDisabled();
    await input(page).fill('こんにちは');
    await expect(send(page)).toBeEnabled();
    await send(page).click();

    // すぐ一覧に出て、入力欄は空になる。
    await expect(item(page, 'こんにちは')).toBeVisible();
    await expect(input(page)).toHaveValue('');
    await expect(send(page)).toBeDisabled();
    await expect(page.getByRole('link', { name: 'コメント 1 件' })).toBeVisible();

    // 返信する。「@名前 に返信中」と取り消しが出る。
    await item(page, 'こんにちは')
      .getByRole('button', { name: /に返信する/ })
      .click();
    await expect(page.getByText(`@${me.username} に返信中`)).toBeVisible();
    await page.getByRole('button', { name: '返信をやめる' }).click();
    await expect(page.getByText('に返信中')).toHaveCount(0);
    await item(page, 'こんにちは')
      .getByRole('button', { name: /に返信する/ })
      .click();
    await input(page).fill('ありがとう');
    await send(page).click();
    await expect(item(page, 'ありがとう')).toBeVisible();

    // 返信への返信は、同じ 1 階層に並ぶ。
    await item(page, 'ありがとう')
      .getByRole('button', { name: /に返信する/ })
      .click();
    await input(page).fill('どういたしまして');
    await send(page).click();
    await expect(item(page, 'どういたしまして')).toBeVisible();

    // Every row has been replaced by the server's row (a pending row is `aria-busy`).
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    const parentX = await xOf(page, 'こんにちは');
    const replyX = await xOf(page, 'ありがとう');
    expect(replyX).toBeGreaterThan(parentX + 20);
    expect(await xOf(page, 'どういたしまして')).toBeCloseTo(replyX, 0);
    await expect(page.getByRole('link', { name: 'コメント 3 件' })).toBeVisible();

    // 再読み込み後も残り、保存されたのは親 1 件と同じ親の返信 2 件。
    await page.reload();
    for (const body of ['こんにちは', 'ありがとう', 'どういたしまして']) {
      await expect(item(page, body)).toBeVisible();
    }
    const saved = commentRows(post.id);
    expect(saved).toHaveLength(3);
    expect(saved[1]!.parent_id).toBe(saved[0]!.id);
    expect(saved[2]!.parent_id).toBe(saved[0]!.id);
    expect(postCommentCount(post.id)).toBe(3);
  },
);

signedIn('21 件目以降と 4 件目以降の返信が追加読み込みで出る', async ({ page }) => {
  const { username, post } = await strangerPost(page);
  const parents = insertComments(
    Array.from({ length: 21 }, (_, i) => ({
      postId: post.id,
      authorUsername: username,
      body: `親コメント ${String(i + 1).padStart(2, '0')}`,
    })),
  );
  insertComments(
    Array.from({ length: 5 }, (_, i) => ({
      postId: post.id,
      authorUsername: username,
      parentId: parents[0],
      body: `返信 ${i + 1}`,
      createdAt: Date.now() - 60 * 60 * 1000 + i * 1000,
    })),
  );
  await page.goto(`/p/${post.id}`);
  await waitForHydration(page);

  await expect(page.getByText(/^親コメント \d\d$/)).toHaveCount(20);
  await expect(page.getByText('親コメント 21', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/^返信 \d$/)).toHaveCount(3);

  await page.getByRole('button', { name: 'コメントをさらに読み込む' }).click();
  await expect(page.getByText('親コメント 21', { exact: true })).toBeVisible();
  await expect(page.getByText(/^親コメント \d\d$/)).toHaveCount(21);
  await expect(page.getByRole('button', { name: 'コメントをさらに読み込む' })).toHaveCount(0);

  await page.getByRole('button', { name: '返信 2 件を見る' }).click();
  await expect(page.getByText(/^返信 \d$/)).toHaveCount(5);
  for (let i = 1; i <= 5; i += 1) {
    await expect(page.getByText(`返信 ${i}`, { exact: true })).toHaveCount(1);
  }
  await expect(page.getByRole('button', { name: /件を見る/ })).toHaveCount(0);
});

signedIn(
  '自分のコメントと自分の投稿の他人のコメントだけ削除でき、確認で取り消せる',
  async ({ page, me }) => {
    // 自分の投稿に、他人のコメントと自分のコメント。
    const other = newName('c');
    seedUser(other, `${other}@example.com`);
    const mine = insertPost({ authorUsername: me.username, mediaCount: 1 });
    await putPostFiles(page, mine);
    const [parent] = insertComments([
      { postId: mine.id, authorUsername: other, body: '他人の親コメント' },
      { postId: mine.id, authorUsername: other, body: '他人の二つ目' },
      { postId: mine.id, authorUsername: me.username, body: '自分のコメント' },
    ]);
    insertComments([
      { postId: mine.id, authorUsername: other, parentId: parent, body: '他人の返信' },
    ]);
    expect(postCommentCount(mine.id)).toBe(4);
    await page.goto(`/p/${mine.id}`);
    await waitForHydration(page);
    await expect(page.getByRole('link', { name: 'コメント 4 件' })).toBeVisible();

    // 投稿者には、他人のコメントにも「削除」が出る。取り消すと残る。
    const del = (text: string) =>
      item(page, text)
        .getByRole('button', { name: /のコメントを削除/ })
        .first();
    await del('他人の二つ目').click();
    const dialog = page.getByRole('alertdialog', { name: 'このコメントを削除しますか？' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'キャンセル' }).click();
    await expect(dialog).toBeHidden();
    await expect(item(page, '他人の二つ目')).toBeVisible();
    expect(commentRows(mine.id)).toHaveLength(4);

    // 承認すると行が消え、数も減る。
    await del('他人の二つ目').click();
    await dialog.getByRole('button', { name: '削除', exact: true }).click();
    await expect(item(page, '他人の二つ目')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'コメント 3 件' })).toBeVisible();
    expect(postCommentCount(mine.id)).toBe(3);

    // 親を消すと返信も消えて 2 減る。
    await del('他人の親コメント').click();
    await dialog.getByRole('button', { name: '削除', exact: true }).click();
    await expect(page.getByText('他人の親コメント')).toHaveCount(0);
    await expect(page.getByText('他人の返信')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'コメント 1 件' })).toBeVisible();
    expect(postCommentCount(mine.id)).toBe(1);
    expect(commentRows(mine.id)).toHaveLength(1);

    // 無関係な人の投稿では、他人のコメントに「削除」が出ず、自分のコメントには出る。
    const { username, post } = await strangerPost(page);
    const third = newName('d');
    seedUser(third, `${third}@example.com`);
    insertComments([
      { postId: post.id, authorUsername: third, body: '第三者のコメント' },
      { postId: post.id, authorUsername: me.username, body: '自分の別のコメント' },
    ]);
    await page.goto(`/p/${post.id}`);
    await waitForHydration(page);
    await expect(item(page, '自分の別のコメント')).toBeVisible();
    await expect(item(page, '第三者のコメント').getByRole('button', { name: /削除/ })).toHaveCount(
      0,
    );
    await expect(
      item(page, '自分の別のコメント').getByRole('button', { name: /のコメントを削除/ }),
    ).toHaveCount(1);
    expect(username).not.toBe(me.username);
  },
);

signedIn(
  'コメントの削除の通信が失敗しても フォーカスが確認のダイアログの中に残る',
  async ({ page, me }) => {
    const mine = insertPost({ authorUsername: me.username, mediaCount: 1 });
    await putPostFiles(page, mine);
    insertComments([{ postId: mine.id, authorUsername: me.username, body: '消せないコメント' }]);
    await page.goto(`/p/${mine.id}`);
    await waitForHydration(page);

    let posts = 0;
    let failing = true;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(
      (url) => url.pathname === `/p/${mine.id}`,
      async (route) => {
        // The unread-badge poll (a POST with body `[]`) is not a comment request.
        if (route.request().method() !== 'POST' || route.request().postData() === '[]')
          return route.continue();
        posts += 1;
        if (!failing) return route.continue();
        await gate;
        await route.abort();
      },
    );

    await item(page, '消せないコメント')
      .getByRole('button', { name: /のコメントを削除/ })
      .click();
    const dialog = page.getByRole('alertdialog', { name: 'このコメントを削除しますか？' });
    const confirm = dialog.getByRole('button', { name: '削除', exact: true });
    const cancel = dialog.getByRole('button', { name: 'キャンセル' });
    await tabTo(page, confirm);
    await page.keyboard.press('Enter');

    const inside = () => dialog.evaluate((d) => d.contains(document.activeElement));
    const busy = dialog.getByRole('button', { name: '削除中…' });
    await expect(busy).toBeVisible();
    expect(await inside()).toBe(true);
    await page.keyboard.press('Enter');
    await expect.poll(() => posts).toBe(1);
    expect(await inside()).toBe(true);
    await expect(busy).toBeFocused();
    await expect(busy).toHaveAttribute('aria-disabled', 'true');
    await expect(cancel).toHaveAttribute('aria-disabled', 'true');
    release();

    await expect(dialog.getByRole('alert')).toHaveText(
      'エラーが発生しました。しばらくしてからもう一度お試しください',
    );
    await page.keyboard.press('Tab');
    expect(await inside()).toBe(true);
    await expect(cancel).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(confirm).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(cancel).toBeFocused();

    failing = false;
    await page.keyboard.press('Tab');
    await expect(confirm).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(item(page, '消せないコメント')).toHaveCount(0);
    expect(commentRows(mine.id)).toHaveLength(0);
  },
);

signedIn('コメント欄をキーボードで操作でき、axe の重大な違反が 0 件', async ({ page, me }) => {
  const { username, post } = await strangerPost(page);
  insertComments([{ postId: post.id, authorUsername: username, body: '最初のコメント' }]);
  insertComments([{ postId: post.id, authorUsername: me.username, body: '自分のコメント' }]);
  await page.goto(`/p/${post.id}`);
  await waitForHydration(page);

  // ラベル・ボタンの名前・読み上げの領域。
  await expect(input(page)).toBeVisible();
  await expect(send(page)).toBeVisible();
  await expect(
    item(page, '最初のコメント').getByRole('button', { name: `@${username} に返信する` }),
  ).toBeVisible();
  await expect(
    page.locator('[aria-live="polite"]').filter({ hasText: '最初のコメント' }),
  ).toHaveCount(1);

  // 2,000 字で「n / 2,200」。
  await expect(page.getByText(/\/ 2,200/)).toHaveCount(0);
  await input(page).fill('あ'.repeat(2000));
  await expect(page.getByText('2000 / 2,200')).toBeVisible();
  await input(page).fill('');

  // 送信はキーボードだけでできる（Enter）。
  await input(page).focus();
  await page.keyboard.type('キーボードで送る');
  await page.keyboard.press('Enter');
  await expect(item(page, 'キーボードで送る')).toBeVisible();

  // 削除の確認は、フォーカスを閉じ込め、Esc で閉じて、押したボタンに戻る。
  const del = item(page, '自分のコメント').getByRole('button', { name: /のコメントを削除/ });
  await del.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('alertdialog', { name: 'このコメントを削除しますか？' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'キャンセル' })).toBeFocused();
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('Tab');
    await expect(dialog.locator(':focus')).toHaveCount(1);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(del).toBeFocused();

  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(serious.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

signedIn('JS が読み込まれる前でも コメントを送れる', async ({ page }) => {
  const { post } = await strangerPost(page);
  const release = await holdScripts(page);
  await page.goto(`/p/${post.id}`, { waitUntil: 'commit' });

  await input(page).waitFor();
  await expect(send(page)).toBeEnabled();
  await input(page).fill('スクリプトなしで送る');
  // Enter in the box submits the form the browser's own way (a click waits for a stable box, which
  // a page that is still loading may not give).
  await input(page).press('Enter');
  await expect(page.getByText('スクリプトなしで送る', { exact: true })).toBeVisible();
  release();
  expect(commentRows(post.id)).toHaveLength(1);
  expect(postCommentCount(post.id)).toBe(1);
});

signedIn('375px でも入力欄が下のナビと重ならず 画面の下に固定される', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  const { username, post } = await strangerPost(page);
  insertComments(
    Array.from({ length: 12 }, (_, i) => ({
      postId: post.id,
      authorUsername: username,
      body: `長い一覧 ${i + 1}`,
    })),
  );
  await page.goto(`/p/${post.id}`);
  await waitForHydration(page);
  const form = page.getByTestId('comment-form');
  const nav = page.locator('[data-nav="bottom"]');
  await expect(form).toBeVisible();
  const f = (await form.boundingBox())!;
  const n = (await nav.boundingBox())!;
  expect(f.y + f.height).toBeLessThanOrEqual(n.y + 1);
  expect(f.y + f.height).toBeGreaterThan(n.y - 20);
  // 画面の外まで一覧を送っても、入力欄は見える位置にある。
  await page.mouse.wheel(0, 3000);
  await expect(form).toBeInViewport();
});

signedIn(
  '送信が失敗すると 追加した行が消え 本文は欄に残り message が出て 再送すると成功する',
  async ({ page }) => {
    const { post } = await strangerPost(page);
    await page.goto(`/p/${post.id}`);
    await waitForHydration(page);

    // The Server Action's request is held (to see the row appear first), then cut.
    let failing = true;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(
      (url) => url.pathname === `/p/${post.id}`,
      async (route) => {
        if (route.request().method() !== 'POST' || !failing) return route.continue();
        await gate;
        await route.abort();
      },
    );
    const alert = page.getByTestId('comment-form').getByRole('alert');

    await input(page).fill('届かないコメント');
    await send(page).click();
    await expect(item(page, '届かないコメント')).toBeVisible();
    await expect(input(page)).toHaveValue('');
    release();

    await expect(item(page, '届かないコメント')).toHaveCount(0);
    await expect(input(page)).toHaveValue('届かないコメント');
    await expect(alert).toHaveText('エラーが発生しました。しばらくしてからもう一度お試しください');
    await expect(page.getByRole('link', { name: 'コメント 0 件' })).toBeVisible();
    expect(commentRows(post.id)).toHaveLength(0);

    // 本文が残っているので、そのまま送り直せる。
    failing = false;
    await send(page).click();
    await expect(item(page, '届かないコメント')).toBeVisible();
    await expect(input(page)).toHaveValue('');
    await expect(alert).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'コメント 1 件' })).toBeVisible();
    await expect.poll(() => commentRows(post.id).length).toBe(1);
  },
);
