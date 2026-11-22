import { expect, test, type Page, type Request } from '@playwright/test';
import { signUpViaUi } from './support/auth';
import { expectNoSeriousViolations } from './support/axe';
import { makeJpeg } from './support/fixtures';
import { holdScripts, nextFrames, waitForHydration } from './support/hydration';
import { tabTo } from './support/keys';
import { fixtureVideo, storyRows } from './support/stories';

// Next.js has its own role=alert (the route announcer); these are the screen's.
const alerts = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');
const submit = (page: Page) => page.getByRole('button', { name: '投稿', exact: true });
const chooser = (page: Page) => page.locator('input[type="file"]');
const alt = (page: Page) => page.getByLabel('代替テキスト');
const TOO_LONG = '動画は 15 秒までです';

/** Signs a new user up through the real screen and opens /stories/create. */
async function start(page: Page): Promise<{ username: string }> {
  const user = await signUpViaUi(page);
  await page.goto('/stories/create');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'ストーリーを作成' })).toBeVisible();
  return { username: user.username };
}

test('写真を選んで投稿するとホームに移る', async ({ page }) => {
  const { username } = await start(page);
  const jpeg = await makeJpeg(page, 1200, 2000);
  await chooser(page).setInputFiles({ name: 's.jpg', mimeType: 'image/jpeg', buffer: jpeg });
  await expect(page.getByRole('img', { name: '選んだ写真のプレビュー' })).toBeVisible();
  await alt(page).fill('夕焼けの空');
  await expect(submit(page)).toBeEnabled();
  await submit(page).click();

  await expect(page).toHaveURL(/\/$/);
  const rows = storyRows(username);
  expect(rows).toHaveLength(1);
  const [row] = rows;
  expect(row).toMatchObject({ type: 'image', alt_text: '夕焼けの空', duration_ms: null });
  expect(row!.storage_key).toMatch(/^stories\/[^/]+\/[0-9a-f-]{36}$/);
  // 1200x2000 is shrunk to 2048 on its long edge at most; the short edge keeps the ratio.
  expect((row!.width as number) / (row!.height as number)).toBeCloseTo(0.6, 1);
  expect((row!.expires_at as number) - (row!.created_at as number)).toBe(86_400_000);
});

test('15 秒ちょうどの動画を投稿できる', async ({ page }) => {
  const { username } = await start(page);
  await chooser(page).setInputFiles(fixtureVideo(15));
  await expect(page.getByText('story-15s.mp4（0:15）')).toBeVisible();
  await alt(page).fill('動画の説明');
  await submit(page).click();

  await expect(page).toHaveURL(/\/$/);
  const [row] = storyRows(username);
  expect(row).toMatchObject({
    type: 'video',
    duration_ms: 15_000,
    width: 320,
    height: 568,
    alt_text: '動画の説明',
  });
});

test('16 秒の動画は選んだ時点で通信せずに拒まれる', async ({ page }) => {
  const { username } = await start(page);
  const sent: Request[] = [];
  page.on('request', (r) => {
    // Not the unread-badge poll (a Server Action POST with no arguments, body `[]`).
    if (r.method() !== 'GET' && r.method() !== 'HEAD' && r.postData() !== '[]') sent.push(r);
  });

  await chooser(page).setInputFiles(fixtureVideo(16));
  await expect(alerts(page)).toHaveText(TOO_LONG);
  await expect(submit(page)).toBeDisabled();
  // Nothing was posted: no Server Action and no request to the storage.
  await page.waitForLoadState('networkidle');
  expect(sent.map((r) => `${r.method()} ${r.url()}`)).toEqual([]);
  expect(storyRows(username)).toHaveLength(0);

  // Choosing a valid file afterwards clears the message and enables the button.
  await chooser(page).setInputFiles(fixtureVideo(5));
  await expect(alerts(page)).toHaveCount(0);
  await expect(submit(page)).toBeEnabled();
});

test('キーボードだけで投稿でき、axe の重大な違反が 0 件', async ({ page }) => {
  const { username } = await start(page);
  await expectNoSeriousViolations(page, '/stories/create の最初の状態');

  // Armed long before the key press: Playwright enables the interception asynchronously.
  const fileChooser = page.waitForEvent('filechooser');
  fileChooser.catch(() => {});
  const picker = page.getByRole('button', { name: '写真または動画を選ぶ' });
  await tabTo(page, picker);
  await page.keyboard.press('Enter');
  const jpeg = await makeJpeg(page, 600, 1000);
  await (await fileChooser).setFiles([{ name: 'k.jpg', mimeType: 'image/jpeg', buffer: jpeg }]);
  await expect(page.getByRole('img', { name: '選んだ写真のプレビュー' })).toBeVisible();

  // The next stops are the alternative text, then 投稿.
  await page.keyboard.press('Tab');
  await expect(alt(page)).toBeFocused();
  await page.keyboard.type('キーボードだけ');
  await expectNoSeriousViolations(page, '/stories/create の写真を選んだ状態');
  await page.keyboard.press('Tab');
  await expect(submit(page)).toBeFocused();
  await page.keyboard.press('Space');

  await expect(page).toHaveURL(/\/$/);
  expect(storyRows(username)).toHaveLength(1);
});

test('エラーは代替テキストと結ばれ 画面は axe の重大な違反が 0 件', async ({ page }) => {
  await start(page);
  await chooser(page).setInputFiles(fixtureVideo(16));
  await expect(alerts(page)).toHaveText(TOO_LONG);
  const id = await alerts(page).getAttribute('id');
  expect(id).toBeTruthy();
  await expect(alt(page)).toHaveAttribute('aria-describedby', id!);
  await expect(page.getByLabel('代替テキスト')).toBeVisible(); // a visible label
  await expectNoSeriousViolations(page, '/stories/create の動画を拒んだ状態');

  // A format the screen does not take is explained too.
  await chooser(page).setInputFiles({
    name: 'a.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from('GIF89a'),
  });
  await expect(alerts(page)).toHaveText('この形式は使えません（JPEG・PNG・WebP・HEIC・MP4）');
  await expect(submit(page)).toBeDisabled();
});

/**
 * Opens /stories/create with every script held back, chooses `file` from the picker with the
 * keyboard while the page is still un-hydrated, then lets the scripts load and waits for hydration.
 */
async function pickBeforeHydration(
  page: Page,
  file: string | { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  const fileChooser = page.waitForEvent('filechooser');
  fileChooser.catch(() => {});
  const release = await holdScripts(page);
  await page.goto('/stories/create', { waitUntil: 'commit' });
  const picker = page.getByRole('button', { name: '写真または動画を選ぶ' });
  await picker.waitFor();
  await tabTo(page, picker);
  await page.keyboard.press('Enter');
  expect(await page.locator('html[data-hydrated="1"]').count()).toBe(0);
  await (await fileChooser).setFiles(file);
  release();
  await waitForHydration(page);
}

const preview = (page: Page) => page.getByRole('img', { name: '選んだ写真のプレビュー' });

test('JS の読み込み前に選んだ写真が ハイドレーションの後にプレビューに入り 投稿できる', async ({
  page,
}) => {
  const { username } = await signUpViaUi(page);
  const jpeg = await makeJpeg(page, 600, 800);
  await pickBeforeHydration(page, { name: 'early.jpg', mimeType: 'image/jpeg', buffer: jpeg });

  await expect(preview(page)).toHaveCount(1);
  await expect(submit(page)).toBeEnabled();
  await submit(page).click();
  await expect(page).toHaveURL(/\/$/);
  expect(storyRows(username)).toHaveLength(1);
});

test('JS の読み込み前に選んだ 16 秒の動画は ハイドレーションの後に理由が出て送られない', async ({
  page,
}) => {
  const { username } = await signUpViaUi(page);
  const sent: Request[] = [];
  page.on('request', (r) => {
    if (r.method() !== 'GET' && r.method() !== 'HEAD') sent.push(r);
  });
  await pickBeforeHydration(page, fixtureVideo(16));

  await expect(alerts(page)).toHaveText(TOO_LONG);
  await expect(submit(page)).toBeDisabled();
  await nextFrames(page);
  expect(sent.map((r) => `${r.method()} ${r.url()}`)).toEqual([]);
  expect(storyRows(username)).toHaveLength(0);
});

test('JS の読み込み前に選んだ写真の後 同じ写真を選び直しても 1 つのまま', async ({ page }) => {
  await signUpViaUi(page);
  const jpeg = await makeJpeg(page, 600, 800);
  const same = { name: 'same.jpg', mimeType: 'image/jpeg', buffer: jpeg };
  await pickBeforeHydration(page, same);
  await expect(preview(page)).toHaveCount(1);

  const fileChooser = page.waitForEvent('filechooser');
  fileChooser.catch(() => {});
  const picker = page.getByRole('button', { name: '写真または動画を選ぶ' });
  await tabTo(page, picker);
  await page.keyboard.press('Enter');
  await (await fileChooser).setFiles([same]);
  await nextFrames(page);
  await expect(preview(page)).toHaveCount(1);
  await expect(submit(page)).toBeEnabled();
});
