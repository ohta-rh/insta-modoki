import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { signUpViaUi } from './support/auth';
import { mediaRows, postRows, setPostCount, userRow } from './support/db';
import { makeJpeg } from './support/fixtures';

const POST_URL = /\/p\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FAILED = 'アップロードに失敗しました。もう一度お試しください';
const RATE_LIMITED = '操作が多すぎます。しばらくしてからもう一度お試しください';

// Next.js has its own role=alert (the route announcer); these are the screen's.
const alerts = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');
const submit = (page: Page) => page.getByRole('button', { name: '投稿', exact: true });
const chooser = (page: Page) => page.locator('input[type="file"]');
const caption = (page: Page) => page.getByLabel('キャプション');
const alt = (page: Page, n: number) => page.getByLabel(`写真 ${n} の代替テキスト`);
const frame = (page: Page, n: number) => page.getByRole('group', { name: `写真 ${n} の切り抜き` });

/** Signs a new user up through the real screen and opens /create; returns the user's id. */
async function start(page: Page): Promise<{ userId: string; username: string }> {
  const user = await signUpViaUi(page);
  await page.goto('/create');
  await page.waitForLoadState('networkidle');
  return { userId: userRow(user.username)!.id as string, username: user.username };
}

const file = (name: string, buffer: Buffer) => ({ name, mimeType: 'image/jpeg', buffer });

async function pick(page: Page, names: string[], jpeg: Buffer) {
  await chooser(page).setInputFiles(names.map((n) => file(n, jpeg)));
  await expect(page.getByRole('listitem', { name: /^写真 \d+$/ })).toHaveCount(
    Math.min(names.length, 10),
  );
}

test('3 枚を切り抜いて代替テキストとキャプションを付けて投稿すると 投稿詳細に移る', async ({
  page,
}) => {
  const { userId } = await start(page);
  const jpeg = await makeJpeg(page, 800, 600);
  await pick(page, ['a.jpg', 'b.jpg', 'c.jpg'], jpeg);

  await page.getByRole('radio', { name: '4:5' }).check();
  // 800x600 photo in a 4:5 frame: the 480x600 window starts centered.
  await expect(frame(page, 1)).toHaveAttribute('data-crop', '160,0,480,600');
  // Dragging the photo to the left shows more of its right side.
  const box = (await frame(page, 1).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 30, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(frame(page, 1)).not.toHaveAttribute('data-crop', '160,0,480,600');

  for (const n of [1, 2, 3]) await alt(page, n).fill(`代替 ${n}`);
  await caption(page).fill('夕暮れの散歩 😀');
  await submit(page).click();

  await expect(page).toHaveURL(POST_URL);
  const [post] = postRows(userId);
  expect(post!.caption).toBe('夕暮れの散歩 😀');
  expect(page.url().endsWith(`/p/${post!.id as string}`)).toBe(true);
  const rows = mediaRows(post!.id as string);
  expect(rows.map((r) => r.position)).toEqual([0, 1, 2]);
  expect(rows.map((r) => r.alt_text)).toEqual(['代替 1', '代替 2', '代替 3']);
  for (const r of rows) {
    expect((r.width as number) / (r.height as number)).toBe(0.8);
    expect(r.storage_key).toMatch(new RegExp(`^media/${userId}/`));
    expect(typeof r.thumbhash).toBe('string');
  }
});

test('11 枚目は選べず 10 枚までは投稿できる', async ({ page }) => {
  const { userId } = await start(page);
  const jpeg = await makeJpeg(page, 200, 200);

  // With no photo the button is disabled and says why.
  await expect(submit(page)).toBeDisabled();
  await expect(page.getByText('写真を 1 枚以上選んでください')).toBeVisible();

  await pick(
    page,
    Array.from({ length: 10 }, (_, i) => `p${i}.jpg`),
    jpeg,
  );
  await expect(alerts(page)).toHaveCount(0);
  await expect(submit(page)).toBeEnabled();

  await chooser(page).setInputFiles([file('eleventh.jpg', jpeg)]);
  await expect(alerts(page)).toHaveText('写真は 10 枚までです');
  await expect(page.getByRole('listitem', { name: /^写真 \d+$/ })).toHaveCount(10);

  await submit(page).click();
  await expect(page).toHaveURL(POST_URL);
  const [post] = postRows(userId);
  expect(mediaRows(post!.id as string)).toHaveLength(10);
});

test('2201 字のキャプションは送れない', async ({ page }) => {
  await start(page);
  const jpeg = await makeJpeg(page, 200, 200);
  await pick(page, ['a.jpg'], jpeg);

  await caption(page).fill('あ'.repeat(2201));
  await expect(page.getByText('2,201 / 2,200')).toBeVisible();
  await expect(alerts(page)).toHaveText('キャプションは 2,200 字までです');
  await expect(submit(page)).toBeDisabled();

  // An emoji counts once, so 2,200 of them are allowed.
  await caption(page).fill('😀'.repeat(2200));
  await expect(page.getByText('2,200 / 2,200')).toBeVisible();
  await expect(alerts(page)).toHaveCount(0);
  await expect(submit(page)).toBeEnabled();

  await alt(page, 1).fill('あ'.repeat(501));
  await expect(alerts(page)).toHaveText('代替テキストは 500 字までです');
  await expect(submit(page)).toBeDisabled();
  await alt(page, 1).fill('あ'.repeat(500));
  await expect(alerts(page)).toHaveCount(0);
  await expect(submit(page)).toBeEnabled();
});

test('送信に失敗しても 入力が残り やり直せる', async ({ page }) => {
  const { userId } = await start(page);
  const jpeg = await makeJpeg(page, 320, 240);
  const puts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'PUT') puts.push(r.url());
  });
  await pick(page, ['keep.jpg'], jpeg);
  await alt(page, 1).fill('残る代替テキスト');
  await caption(page).fill('残るキャプション');
  await page.getByRole('radio', { name: '4:5' }).check();

  const kept = async () => {
    await expect(alt(page, 1)).toHaveValue('残る代替テキスト');
    await expect(caption(page)).toHaveValue('残るキャプション');
    await expect(page.getByRole('radio', { name: '4:5' })).toBeChecked();
    await expect(page.getByRole('listitem', { name: '写真 1' })).toBeVisible();
    await expect(submit(page)).toBeEnabled();
  };

  // 1. The upload fails (network).
  await page.route('**/media/**', (route) => route.abort());
  await submit(page).click();
  await expect(alerts(page)).toHaveText(FAILED);
  await kept();
  expect(postRows(userId)).toHaveLength(0);

  // 2. The upload works, createPost refuses (over the hourly limit); its message is shown as is.
  await page.unroute('**/media/**');
  setPostCount(userId, 30);
  await submit(page).click();
  await expect(alerts(page)).toHaveText(RATE_LIMITED);
  await kept();
  expect(postRows(userId)).toHaveLength(0);
  const putsAfterSecond = puts.length;

  // 3. Pressing again posts, and the photo that is already stored is not sent again.
  setPostCount(userId, 0);
  await submit(page).click();
  await expect(page).toHaveURL(POST_URL);
  expect(puts.length).toBe(putsAfterSecond);
  expect(postRows(userId)).toHaveLength(1);
});

test('写真の順番を入れ替え 1 枚外して投稿すると その順で保存される', async ({ page }) => {
  const { userId } = await start(page);
  const jpeg = await makeJpeg(page, 300, 300);
  await pick(page, ['a.jpg', 'b.jpg', 'c.jpg'], jpeg);
  for (const [n, text] of [
    [1, 'A'],
    [2, 'B'],
    [3, 'C'],
  ] as const) {
    await alt(page, n).fill(text);
  }

  await page.getByRole('button', { name: '後ろへ（写真 1）' }).click();
  await expect(alt(page, 1)).toHaveValue('B');
  await expect(alt(page, 2)).toHaveValue('A');
  await page.getByRole('button', { name: '前へ（写真 3）' }).click();
  await expect(alt(page, 2)).toHaveValue('C');
  await expect(alt(page, 3)).toHaveValue('A');
  await page.getByRole('button', { name: 'この写真を外す（写真 2）' }).click();
  await expect(page.getByRole('listitem', { name: /^写真 \d+$/ })).toHaveCount(2);
  await expect(alt(page, 1)).toHaveValue('B');
  await expect(alt(page, 2)).toHaveValue('A');

  await submit(page).click();
  await expect(page).toHaveURL(POST_URL);
  const [post] = postRows(userId);
  const rows = mediaRows(post!.id as string);
  expect(rows.map((r) => r.position)).toEqual([0, 1]);
  expect(rows.map((r) => r.alt_text)).toEqual(['B', 'A']);
});

test('キーボードだけで投稿でき axe の重大な違反が無い', async ({ page }) => {
  // Arm the chooser interception long before the key press: Playwright enables it asynchronously,
  // and a chooser that opens first is the browser's own and never reaches the test.
  const fileChooser = page.waitForEvent('filechooser');
  fileChooser.catch(() => {});
  const { userId } = await start(page);
  const jpeg = await makeJpeg(page, 800, 600);

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

  await tabTo(page.getByRole('button', { name: '写真を選ぶ' }));
  await page.keyboard.press('Enter');
  await (await fileChooser).setFiles([file('k1.jpg', jpeg), file('k2.jpg', jpeg)]);
  await expect(page.getByRole('listitem', { name: /^写真 \d+$/ })).toHaveCount(2);

  // The ratio: arrow keys move between the two options.
  await tabTo(page.getByRole('radio', { name: '1:1' }));
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: '4:5' })).toBeChecked();

  // The crop position: arrow keys move the window by 10px on screen.
  await tabTo(frame(page, 1));
  const before = await frame(page, 1).getAttribute('data-crop');
  await page.keyboard.press('ArrowRight');
  await expect(frame(page, 1)).not.toHaveAttribute('data-crop', before!);
  const after = await frame(page, 1).getAttribute('data-crop');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(frame(page, 1)).not.toHaveAttribute('data-crop', after!);

  await tabTo(page.getByRole('button', { name: '後ろへ（写真 1）' }));
  await page.keyboard.press('Enter');
  // Focus follows the moved photo: its "後ろへ" button is now photo 2's.
  await expect(page.getByRole('button', { name: '後ろへ（写真 2）' })).toBeFocused();

  await tabTo(alt(page, 1));
  await page.keyboard.type('一枚目');
  await tabTo(alt(page, 2));
  await page.keyboard.type('二枚目');
  await tabTo(caption(page));
  await page.keyboard.type('キーボードで投稿');

  const found = await new AxeBuilder({ page }).analyze();
  expect(found.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual(
    [],
  );

  await tabTo(submit(page));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(POST_URL);
  const [post] = postRows(userId);
  expect(post!.caption).toBe('キーボードで投稿');
  const rows = mediaRows(post!.id as string);
  expect(rows).toHaveLength(2);
  expect(rows.map((r) => r.alt_text)).toEqual(['一枚目', '二枚目']);
  for (const r of rows) expect((r.width as number) / (r.height as number)).toBe(0.8);
});

test('未ログインで /create を開くと ログイン画面に移る', async ({ page }) => {
  await page.goto('/create');
  await expect(page).toHaveURL(/\/accounts\/login$/);
});

test('JS の読み込み前でも 写真を選ぶ をキーボードで押すと 選択ダイアログが開く', async ({
  page,
}) => {
  // Arm the chooser interception before the key press: Playwright enables it asynchronously,
  // and a chooser that opens first is the browser's own and never reaches the test.
  const fileChooser = page.waitForEvent('filechooser');
  fileChooser.catch(() => {});
  await signUpViaUi(page);
  // Hold every script chunk back so the page stays un-hydrated while the key is pressed.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/_next/static/chunks/**', async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto('/create', { waitUntil: 'commit' });

  const choose = page.getByRole('button', { name: '写真を選ぶ' });
  await choose.waitFor();
  await choose.focus();
  await expect(choose).toBeFocused();
  await page.keyboard.press('Enter');
  await fileChooser;
  release();
});
