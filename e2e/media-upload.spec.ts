import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { signUpViaUi } from './support/auth';
import { userRow } from './support/db';
import { hasExif, makeJpeg, padTo, webpSize, withGps } from './support/fixtures';
import { getObject, mediaUrl } from './support/storage';
import { holdScripts, waitForHydration } from './support/hydration';
import { tabTo } from './support/keys';

const PAGE_PATH = '/e2e-harness/upload';
const FAILED = 'アップロードに失敗しました。もう一度お試しください';
type Result = { key: string; width: number; height: number; thumbhash: string };

/** Signs up through the real screen and opens the harness page; returns the new user's username. */
async function start(page: Page): Promise<string> {
  const user = await signUpViaUi(page);
  await page.goto(PAGE_PATH);
  await page.waitForLoadState('networkidle');
  return user.username;
}

// Next.js has its own role=alert (the route announcer); these are the picker's.
const alerts = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');
const picker = (page: Page) => page.locator('input[type="file"]');
const upload = (page: Page) => page.getByRole('button', { name: 'アップロード' });
const results = async (page: Page): Promise<Result[]> =>
  JSON.parse(await page.getByTestId('result').innerText()) as Result[];

test('大きすぎる写真と許可外の形式は 送信前に理由つきで拒まれる', async ({ page }) => {
  await start(page);
  const jpeg = await makeJpeg(page, 64, 48);
  const sent: string[] = [];
  page.on('request', (r) => {
    if (r.method() !== 'GET' || new URL(r.url()).port === '3910')
      sent.push(`${r.method()} ${r.url()}`);
  });

  await picker(page).setInputFiles([
    { name: 'exact.jpg', mimeType: 'image/jpeg', buffer: padTo(jpeg, 10_485_760) },
    { name: 'over.jpg', mimeType: 'image/jpeg', buffer: padTo(jpeg, 10_485_761) },
    { name: 'anim.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') },
    { name: 'note.jpg', mimeType: 'text/plain', buffer: Buffer.from('hello') },
  ]);

  const items = alerts(page).getByRole('listitem');
  await expect(items).toHaveText([
    'over.jpg: ファイルが大きすぎます（1 枚 10MB まで）',
    'anim.gif: この形式は使えません（JPEG・PNG・WebP・HEIC）',
    'note.jpg: この形式は使えません（JPEG・PNG・WebP・HEIC）',
  ]);
  await expect(page.getByText('exact.jpg')).toBeVisible();
  expect(sent).toEqual([]);

  // Picking again clears the earlier rejections.
  await picker(page).setInputFiles([{ name: 'ok.jpg', mimeType: 'image/jpeg', buffer: jpeg }]);
  await expect(alerts(page)).toHaveCount(0);
  await expect(page.getByText('ok.jpg')).toBeVisible();
  expect(sent).toEqual([]);
});

test('位置情報つきの写真をアップロードしても 保存されたファイルに EXIF が残らない', async ({
  page,
}) => {
  await start(page);
  const jpeg = withGps(await makeJpeg(page, 640, 480));
  expect(hasExif(jpeg)).toBe(true);

  await picker(page).setInputFiles([{ name: 'gps.jpg', mimeType: 'image/jpeg', buffer: jpeg }]);
  await upload(page).click();
  await expect(page.getByTestId('result')).toContainText('"key"');

  const [r] = await results(page);
  for (const name of ['orig', 'w320', 'w640', 'w1080']) {
    const object = await getObject(`${r!.key}/${name}.webp`);
    expect(object, name).not.toBeNull();
    expect(hasExif(object!.bytes), name).toBe(false);
  }
});

test('アップロード後に 4 つのファイルと幅高さと ThumbHash が揃う', async ({ page }) => {
  const username = await start(page);
  const big = await makeJpeg(page, 4000, 3000);
  const small = await makeJpeg(page, 800, 600);
  await picker(page).setInputFiles([
    { name: 'big.jpg', mimeType: 'image/jpeg', buffer: big },
    { name: 'small.jpg', mimeType: 'image/jpeg', buffer: small },
  ]);
  await upload(page).click();
  await expect(page.getByTestId('result')).toContainText('"key"');

  const [a, b] = await results(page);
  const userId = userRow(username)!.id as string;
  const keyShape = new RegExp(`^media/${userId}/[0-9a-f-]{36}$`);
  expect(a!.key).toMatch(keyShape);
  expect(b!.key).toMatch(keyShape);
  expect([a!.width, a!.height]).toEqual([2048, 1536]);
  expect([b!.width, b!.height]).toEqual([800, 600]);
  for (const r of [a!, b!]) {
    const bytes = Buffer.from(r.thumbhash, 'base64');
    expect(bytes.length).toBeGreaterThan(0);
    expect(bytes.length).toBeLessThanOrEqual(25);
  }
  const expected: Record<string, [number, number][]> = {
    [a!.key]: [
      [2048, 1536],
      [320, 240],
      [640, 480],
      [1080, 810],
    ],
    [b!.key]: [
      [800, 600],
      [320, 240],
      [640, 480],
      [800, 600],
    ],
  };
  for (const [key, sizes] of Object.entries(expected)) {
    for (const [i, name] of ['orig', 'w320', 'w640', 'w1080'].entries()) {
      const object = await getObject(`${key}/${name}.webp`);
      expect(object, `${key} ${name}`).not.toBeNull();
      expect(object!.contentType).toBe('image/webp');
      const size = webpSize(object!.bytes);
      expect([size?.width, size?.height], `${key} ${name}`).toEqual(sizes[i]);
    }
  }
});

test('アップロードが失敗したら 理由が表示され やり直せる', async ({ page }) => {
  await start(page);
  const jpeg = await makeJpeg(page, 320, 240);
  const urlRequests: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.headers()['next-action']) urlRequests.push(r.url());
  });

  await page.route('**/media/**', (route) => route.abort());
  await picker(page).setInputFiles([{ name: 'retry.jpg', mimeType: 'image/jpeg', buffer: jpeg }]);
  await upload(page).click();
  await expect(alerts(page)).toHaveText(FAILED);
  await expect(page.getByText('retry.jpg')).toBeVisible();
  expect(urlRequests).toHaveLength(1);

  await page.unroute('**/media/**');
  await upload(page).click();
  await expect(page.getByTestId('result')).toContainText('"key"');
  await expect(alerts(page)).toHaveCount(0);
  expect(urlRequests).toHaveLength(2);
});

test('写真の選択部品をキーボードだけで操作でき axe の重大な違反が無い', async ({ page }) => {
  // Arm the chooser interception long before the key press: Playwright enables it asynchronously,
  // and a chooser that opens first is the browser's own and never reaches the test.
  const chooser = page.waitForEvent('filechooser');
  await start(page);
  const jpeg = await makeJpeg(page, 320, 240);

  await page.getByRole('link', { name: '本文へ移動' }).focus();
  await page.keyboard.press('Tab');
  const choose = page.getByRole('button', { name: '写真を選ぶ' });
  // Tab order starts at the skip link; walk until the picker's button has focus.
  for (
    let i = 0;
    i < 12 && !(await choose.evaluate((el) => el === document.activeElement));
    i += 1
  ) {
    await page.keyboard.press('Tab');
  }
  await expect(choose).toBeFocused();
  await page.keyboard.press('Enter');
  await (await chooser).setFiles([{ name: 'kb.jpg', mimeType: 'image/jpeg', buffer: jpeg }]);
  await expect(page.getByText('kb.jpg')).toBeVisible();

  await upload(page).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('progressbar', { name: /kb\.jpg/ })).toBeAttached();
  await expect(page.getByTestId('result')).toContainText('"key"');

  const found = await new AxeBuilder({ page }).analyze();
  expect(found.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')).toEqual(
    [],
  );
});

test('JS の読み込み前でも 写真を選ぶ をキーボードで押すと 選択ダイアログが開く', async ({
  page,
}) => {
  await signUpViaUi(page);
  // Armed before the key press (see the post-hydration test): interception is enabled asynchronously.
  const chooser = page.waitForEvent('filechooser');
  // Hold every script chunk back so the page stays un-hydrated while the key is pressed.
  const release = await holdScripts(page);
  await page.goto(PAGE_PATH, { waitUntil: 'commit' });

  const choose = page.getByRole('button', { name: '写真を選ぶ' });
  await choose.waitFor();
  await choose.focus();
  await expect(choose).toBeFocused();
  await page.keyboard.press('Enter');
  await chooser;
  release();
});

test('保存した写真が 公開の配信元（別 origin）から 実際のブラウザで表示される', async ({
  page,
}) => {
  await start(page);
  const jpeg = await makeJpeg(page, 640, 480);
  await picker(page).setInputFiles([{ name: 'show.jpg', mimeType: 'image/jpeg', buffer: jpeg }]);
  await upload(page).click();
  await expect(page.getByTestId('result')).toContainText('"key"');
  const [r] = await results(page);

  // No page.route stub: the request goes to the real media origin, under the page's CSP.
  const src = mediaUrl(`${r!.key}/w640.webp`);
  expect(new URL(src).origin).not.toBe(new URL(page.url()).origin);
  const loaded = await page.evaluate(
    (url) =>
      new Promise<{ ok: boolean; width: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ ok: true, width: img.naturalWidth });
        img.onerror = () => resolve({ ok: false, width: 0 });
        img.src = url;
        document.body.append(img);
      }),
    src,
  );
  expect(loaded).toEqual({ ok: true, width: 640 });
  await expect(page.locator(`img[src="${src}"]`)).toHaveJSProperty('naturalWidth', 640);
});

test('JS の読み込み前に選んだ写真が ハイドレーションの後に一覧に入り アップロードできる', async ({
  page,
}) => {
  await signUpViaUi(page);
  const jpeg = await makeJpeg(page, 320, 240);
  const chooser = page.waitForEvent('filechooser');
  chooser.catch(() => {});
  const release = await holdScripts(page);
  await page.goto(PAGE_PATH, { waitUntil: 'commit' });
  const choose = page.getByRole('button', { name: '写真を選ぶ' });
  await choose.waitFor();
  await tabTo(page, choose);
  await page.keyboard.press('Enter');
  expect(await page.locator('html[data-hydrated="1"]').count()).toBe(0);
  await (await chooser).setFiles([{ name: 'early.jpg', mimeType: 'image/jpeg', buffer: jpeg }]);
  release();
  await waitForHydration(page);

  await expect(page.getByText('early.jpg')).toHaveCount(1);
  await expect(upload(page)).toBeEnabled();
  await upload(page).click();
  await expect(page.getByTestId('result')).toContainText('"key"');
});
