import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { signUpViaUi } from './support/auth';
import { seedUser, setUploadCount, userRow } from './support/db';
import { makeJpeg, padTo, webpSize } from './support/fixtures';
import { holdScripts, waitForHydration } from './support/hydration';
import { tabTo as tabToTarget } from './support/keys';
import { startInFreshWindow } from './support/rate-window';
import { getObject } from './support/storage';

const NAME_MESSAGE = '表示名は 1〜30 字で入力してください';
const BIO_MESSAGE = '自己紹介は 150 字までです';
const TOO_LARGE = 'ファイルが大きすぎます（1 枚 10MB まで）';
const FAILED = 'アップロードに失敗しました。もう一度お試しください';
const RATE_LIMITED = '操作が多すぎます。しばらくしてからもう一度お試しください';

// Next.js has its own role=alert (the route announcer); these are the screen's.
const alerts = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');
const nameField = (page: Page) => page.getByLabel('表示名');
const bioField = (page: Page) => page.getByLabel('自己紹介');
const chooser = (page: Page) => page.locator('input[type="file"]');
const save = (page: Page) => page.getByRole('button', { name: '保存', exact: true });
const preview = (page: Page) => page.getByTestId('avatar-preview');
const jpeg = (name: string, buffer: Buffer) => ({ name, mimeType: 'image/jpeg', buffer });

/** Signs a new user up and opens /accounts/edit with the page hydrated. */
async function start(page: Page): Promise<{ userId: string; username: string }> {
  const user = await signUpViaUi(page);
  await page.goto('/accounts/edit');
  await waitForHydration(page);
  return { userId: userRow(user.username)!.id as string, username: user.username };
}

/** A user nobody is signed in as. */
function otherUser() {
  const username = `e2e_o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  seedUser(username, `${username}@example.com`, { displayName: '他人', bio: '他人の自己紹介' });
  return username;
}

test('表示名と自己紹介とアイコンを変えて保存すると 自分と他人のプロフィールに反映される', async ({
  page,
  browser,
}) => {
  const user = await signUpViaUi(page);
  await page.goto(`/${user.username}`);
  await page.getByRole('link', { name: 'プロフィールを編集' }).click();
  await expect(page).toHaveURL(/\/accounts\/edit$/);
  await waitForHydration(page);
  await expect(nameField(page)).toHaveValue('E2E 利用者');

  await nameField(page).fill('新しい名前 😀');
  await bioField(page).fill('新しい自己紹介\n二行目');
  await chooser(page).setInputFiles(jpeg('icon.jpg', await makeJpeg(page, 800, 600)));
  await expect(preview(page)).toBeVisible();
  await save(page).click();

  await expect(page).toHaveURL(new RegExp(`/${user.username}$`));
  await expect(page.getByRole('heading', { level: 1, name: '新しい名前 😀' })).toBeVisible();
  await expect(page.getByText('新しい自己紹介')).toBeVisible();
  await expect(page.getByText('二行目')).toBeVisible();
  const row = userRow(user.username)!;
  const key = row.avatar_key as string;
  expect(key).toMatch(new RegExp(`^media/${row.id as string}/`));
  const stored = await getObject(`${key}/w320.webp`);
  expect(stored).not.toBeNull();
  expect(webpSize(stored!.bytes)).toEqual({ width: 320, height: 320 });

  const avatar = page.locator('header img');
  await expect(avatar).toHaveAttribute('src', new RegExp(`${key}/w320\\.webp$`));
  await expect
    .poll(() => avatar.evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);

  // Someone else's browser sees the same values with a plain reload.
  const context = await browser.newContext();
  try {
    const viewer = await context.newPage();
    await viewer.goto(`/${user.username}`);
    await viewer.reload();
    await expect(viewer.getByRole('heading', { level: 1, name: '新しい名前 😀' })).toBeVisible();
    await expect(viewer.getByText('新しい自己紹介')).toBeVisible();
    await expect(viewer.locator('header img')).toHaveAttribute(
      'src',
      new RegExp(`${key}/w320\\.webp$`),
    );
    await expect(viewer.getByRole('link', { name: 'プロフィールを編集' })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('アイコンを選ぶと 正方形のプレビューが出て 大きすぎる写真は拒まれる', async ({ page }) => {
  const { username } = await start(page);
  const posts: string[] = [];
  page.on('request', (r) => {
    // Not the unread-badge poll (a Server Action POST with no arguments, body `[]`).
    if ((r.method() === 'POST' && r.postData() !== '[]') || r.method() === 'PUT')
      posts.push(r.url());
  });

  // A portrait photo: the preview is the square in its middle.
  await chooser(page).setInputFiles(jpeg('tall.jpg', await makeJpeg(page, 300, 500)));
  await expect(preview(page)).toHaveAttribute('data-crop', '0,100,300,300');
  const box = (await preview(page).boundingBox())!;
  expect(Math.round(box.width)).toBe(Math.round(box.height));
  await expect(alerts(page)).toHaveCount(0);

  // A landscape one replaces it.
  await chooser(page).setInputFiles(jpeg('wide.jpg', await makeJpeg(page, 600, 400)));
  await expect(preview(page)).toHaveAttribute('data-crop', '100,0,400,400');

  // Too large: refused with #27's words, the earlier preview stays, nothing is sent.
  const big = padTo(await makeJpeg(page, 200, 200), 10_485_761);
  await chooser(page).setInputFiles(jpeg('big.jpg', big));
  await expect(alerts(page)).toHaveText(TOO_LARGE);
  await expect(preview(page)).toHaveAttribute('data-crop', '100,0,400,400');
  await chooser(page).setInputFiles({
    name: 'a.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from('GIF89a'),
  });
  await expect(alerts(page)).toHaveText('この形式は使えません（JPEG・PNG・WebP・HEIC）');
  expect(posts).toEqual([]);
  expect(userRow(username)!.avatar_key).toBeNull();
});

test('字数の境界が表示され 表示名は 1〜30 字 自己紹介は 150 字まで保存できる', async ({ page }) => {
  const { username } = await start(page);

  await bioField(page).fill('あ'.repeat(151));
  await expect(page.getByText('151 / 150')).toBeVisible();
  await expect(alerts(page)).toHaveText(BIO_MESSAGE);
  await expect(save(page)).toBeDisabled();
  await bioField(page).fill('😀'.repeat(150));
  await expect(page.getByText('150 / 150')).toBeVisible();
  await expect(alerts(page)).toHaveCount(0);

  for (const bad of ['', '   ', 'あ'.repeat(31)]) {
    await nameField(page).fill(bad);
    await expect(alerts(page)).toHaveText(NAME_MESSAGE);
    await expect(save(page)).toBeDisabled();
  }
  await nameField(page).fill('あ'.repeat(30));
  await expect(page.getByText('30 / 30')).toBeVisible();
  await expect(save(page)).toBeEnabled();
  await save(page).click();

  await expect(page).toHaveURL(new RegExp(`/${username}$`));
  const row = userRow(username)!;
  expect(row.display_name).toBe('あ'.repeat(30));
  expect(Array.from(row.bio as string)).toHaveLength(150);
});

test('保存に失敗しても 入力が残り やり直せる', async ({ page }) => {
  test.setTimeout(90_000); // may wait up to 30 s for a fresh hourly window
  const { userId, username } = await start(page);
  await nameField(page).fill('残る名前');
  await bioField(page).fill('残る自己紹介');
  await chooser(page).setInputFiles(jpeg('keep.jpg', await makeJpeg(page, 320, 240)));
  await expect(preview(page)).toBeVisible();

  const kept = async () => {
    await expect(nameField(page)).toHaveValue('残る名前');
    await expect(bioField(page)).toHaveValue('残る自己紹介');
    await expect(preview(page)).toBeVisible();
    await expect(save(page)).toBeEnabled();
  };

  // 1. The upload fails (network).
  await page.route('**/media/**', (route) => route.abort());
  await save(page).click();
  await expect(alerts(page)).toHaveText(FAILED);
  await kept();
  expect(userRow(username)!.display_name).toBe('E2E 利用者');

  // 2. The server refuses (over the hourly upload limit); its message is shown as is.
  await page.unroute('**/media/**');
  await startInFreshWindow(3600, 30);
  setUploadCount(userId, 300);
  await save(page).click();
  await expect(alerts(page)).toHaveText(RATE_LIMITED);
  await kept();
  expect(userRow(username)!.display_name).toBe('E2E 利用者');

  // 3. Pressing again saves.
  setUploadCount(userId, 0);
  await save(page).click();
  await expect(page).toHaveURL(new RegExp(`/${username}$`));
  const row = userRow(username)!;
  expect(row.display_name).toBe('残る名前');
  expect(row.bio).toBe('残る自己紹介');
  expect(row.avatar_key).not.toBeNull();
});

test('他人のプロフィールには編集ボタンが出ない', async ({ page }) => {
  const other = otherUser();
  // Not signed in: the edit screen is a login-only screen.
  await page.goto('/accounts/edit');
  await expect(page).toHaveURL(/\/accounts\/login$/);

  const me = await signUpViaUi(page);
  await page.goto(`/${other}`);
  await expect(page.getByRole('heading', { level: 1, name: '他人' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'プロフィールを編集' })).toHaveCount(0);

  await page.goto(`/${me.username}`);
  await expect(page.getByRole('link', { name: 'プロフィールを編集' })).toHaveAttribute(
    'href',
    '/accounts/edit',
  );
});

test('編集の画面からログアウトの確認に移れる', async ({ page }) => {
  await start(page);
  await page.getByRole('link', { name: 'ログアウト' }).click();
  await expect(page).toHaveURL(/\/accounts\/logout$/);
  await expect(page.getByRole('heading', { name: 'ログアウトしますか？' })).toBeVisible();
});

test('キーボードだけで編集でき axe の重大な違反が無い', async ({ page }) => {
  // Arm the chooser interception long before the key press (see post-create.spec.ts).
  const fileChooser = page.waitForEvent('filechooser');
  fileChooser.catch(() => {});
  const { username } = await start(page);
  const photo = await makeJpeg(page, 640, 480);

  /** Presses Tab until `target` has focus (at most 60 presses). */
  const tabTo = async (target: ReturnType<Page['locator']>) => {
    await page.getByRole('link', { name: '本文へ移動' }).focus();
    for (
      let i = 0;
      i < 60 && !(await target.evaluate((el) => el === document.activeElement));
      i += 1
    ) {
      await page.keyboard.press('Tab');
    }
    await expect(target).toBeFocused();
  };

  await tabTo(nameField(page));
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('キーボードの名前');
  await tabTo(bioField(page));
  await page.keyboard.type('キーボードで書いた');
  await tabTo(page.getByRole('button', { name: 'アイコンを変更' }));
  await page.keyboard.press('Enter');
  await (await fileChooser).setFiles([jpeg('k.jpg', photo)]);
  await expect(preview(page)).toBeVisible();

  // Every field has a label and a count.
  await expect(page.getByText('8 / 30')).toBeVisible();
  await expect(page.getByText('9 / 150')).toBeVisible();
  const found = await new AxeBuilder({ page }).analyze();
  expect(found.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual(
    [],
  );
  // An error is announced as an alert and the page is still free of serious violations.
  await bioField(page).fill('あ'.repeat(151));
  await expect(alerts(page)).toHaveText(BIO_MESSAGE);
  const withError = await new AxeBuilder({ page }).analyze();
  expect(
    withError.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious'),
  ).toEqual([]);
  await bioField(page).fill('キーボードで書いた');

  await tabTo(save(page));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/${username}$`));
  const row = userRow(username)!;
  expect(row.display_name).toBe('キーボードの名前');
  expect(row.bio).toBe('キーボードで書いた');
  expect(row.avatar_key).not.toBeNull();
});

/** Opens /accounts/edit with every script chunk held back, so the page stays un-hydrated. */
async function openWithoutJs(page: Page): Promise<() => void> {
  const release = await holdScripts(page);
  await page.goto('/accounts/edit', { waitUntil: 'commit' });
  await nameField(page).waitFor();
  return release;
}

/** Presses 保存 with the keyboard: the held-back stylesheet stops the page painting, so a click would wait for a frame. */
async function pressSave(page: Page) {
  await save(page).focus();
  await page.keyboard.press('Enter');
}

test('JS が読み込まれる前でも 保存を押すと 保存されてプロフィールに移る', async ({ page }) => {
  const user = await signUpViaUi(page);
  const release = await openWithoutJs(page);
  try {
    await nameField(page).fill('JS なしの名前');
    await bioField(page).fill('JS なしの自己紹介');
    await pressSave(page);

    await expect(page).toHaveURL(new RegExp(`/${user.username}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'JS なしの名前' })).toBeVisible();
    await expect(page.getByText('JS なしの自己紹介')).toBeVisible();
    const row = userRow(user.username)!;
    expect(row.display_name).toBe('JS なしの名前');
    expect(row.bio).toBe('JS なしの自己紹介');
  } finally {
    release();
  }
});

test('JS が読み込まれる前でも 不正な値は欄の下に理由が出て 入力が残る', async ({ page }) => {
  const user = await signUpViaUi(page);
  const release = await openWithoutJs(page);
  try {
    await nameField(page).fill('   ');
    await bioField(page).fill('あ'.repeat(151));
    await pressSave(page);

    await expect(alerts(page).filter({ hasText: NAME_MESSAGE })).toHaveCount(1);
    await expect(page).toHaveURL(/\/accounts\/edit$/);
    await expect(nameField(page)).toHaveValue('   ');
    await expect(bioField(page)).toHaveValue('あ'.repeat(151));
    const row = userRow(user.username)!;
    expect(row.display_name).toBe('E2E 利用者');
    expect(row.bio).toBe('');

    // A bio over the limit alone is refused with its own message and the name is kept.
    await nameField(page).fill('名前だけ');
    await pressSave(page);
    await expect(alerts(page).filter({ hasText: BIO_MESSAGE })).toHaveCount(1);
    await expect(nameField(page)).toHaveValue('名前だけ');
    expect(userRow(user.username)!.display_name).toBe('E2E 利用者');
  } finally {
    release();
  }
});

/** Opens /accounts/edit with every script held back and chooses `file` from アイコンを変更 by keyboard. */
async function pickIconBeforeHydration(page: Page, file: ReturnType<typeof jpeg>): Promise<void> {
  const fileChooser = page.waitForEvent('filechooser');
  fileChooser.catch(() => {});
  const release = await holdScripts(page);
  await page.goto('/accounts/edit', { waitUntil: 'commit' });
  const choose = page.getByRole('button', { name: 'アイコンを変更' });
  await choose.waitFor();
  await tabToTarget(page, choose);
  await page.keyboard.press('Enter');
  expect(await page.locator('html[data-hydrated="1"]').count()).toBe(0);
  await (await fileChooser).setFiles([file]);
  release();
  await waitForHydration(page);
}

test('JS の読み込み前に選んだアイコンが ハイドレーションの後にプレビューに出て 保存できる', async ({
  page,
}) => {
  const user = await signUpViaUi(page);
  const image = await makeJpeg(page, 800, 600);
  await pickIconBeforeHydration(page, jpeg('early.jpg', image));

  await expect(preview(page)).toBeVisible();
  await expect(preview(page)).toHaveAttribute('alt', '新しいアイコンのプレビュー');
  await save(page).click();
  await expect(page).toHaveURL(new RegExp(`/${user.username}$`));
  expect(userRow(user.username)!.avatar_key).not.toBeNull();
});

test('JS の読み込み前に選んだ 10MB を超えるアイコンは ハイドレーションの後に理由が出る', async ({
  page,
}) => {
  await signUpViaUi(page);
  const big = padTo(await makeJpeg(page, 200, 200), 10_485_761);
  await pickIconBeforeHydration(page, jpeg('big.jpg', big));

  await expect(alerts(page)).toHaveText(TOO_LARGE);
  await expect(preview(page)).toHaveCount(0);
  await expect(page.getByRole('img', { name: '現在のアイコン' })).toBeVisible();
});
