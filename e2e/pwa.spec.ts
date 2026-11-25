import { expect, test, type Page } from '@playwright/test';
import { signInViaHarness, type NewUser } from './support/auth';
import { seedFollow, seedUser, userRow } from './support/db';
import { insertPost } from './support/posts';
import { expectNoSeriousViolations } from './support/axe';

const ICONS = [
  { src: '/icons/icon-192.png', size: 192 },
  { src: '/icons/icon-512.png', size: 512 },
  { src: '/icons/icon-maskable-512.png', size: 512 },
];

/** Width and height from the PNG header (IHDR). */
function pngSize(buffer: Buffer): { width: number; height: number } {
  expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/** Opens `/`, waits until the Service Worker controls the page (after one reload). */
async function controlled(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? ''))
    .toMatch(/\/sw\.js$/);
}

const signedIn = test.extend<{ me: NewUser }>({
  me: [
    async ({ page }, use) => {
      await use(await signInViaHarness(page));
    },
    { auto: true },
  ],
});

signedIn('manifest と 3 つのアイコンが取得でき、寸法が宣言と一致する', async ({ page }) => {
  const res = await page.request.get('/manifest.webmanifest');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toMatch(/^application\/manifest\+json/);
  const m = await res.json();
  expect(m).toMatchObject({
    name: 'Mado',
    short_name: 'Mado',
    start_url: '/',
    scope: '/',
    id: '/',
    display: 'standalone',
    lang: 'ja',
    theme_color: '#ffffff',
    background_color: '#ffffff',
  });
  expect(m.icons).toHaveLength(3);
  expect(m.icons.map((i: { purpose: string }) => i.purpose)).toEqual(['any', 'any', 'maskable']);
  for (const { src, size } of ICONS) {
    const declared = m.icons.find((i: { src: string }) => i.src === src);
    expect(declared.sizes).toBe(`${size}x${size}`);
    const icon = await page.request.get(src);
    expect(icon.status()).toBe(200);
    expect(icon.headers()['content-type']).toBe('image/png');
    expect(pngSize(await icon.body())).toEqual({ width: size, height: size });
  }
});

signedIn('Chrome のインストール可能の検査（installability）で問題が 0 件', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  const cdp = await page.context().newCDPSession(page);
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  expect(installabilityErrors).toEqual([]);
});

signedIn('Service Worker が登録され、再読み込み後にページを制御する', async ({ page }) => {
  await controlled(page);
  const reg = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return { scope: r?.scope, script: r?.active?.scriptURL };
  });
  expect(reg.scope).toMatch(/\/$/);
  expect(reg.script).toMatch(/\/sw\.js$/);
});

signedIn('オフラインで開くと独自の案内の画面が出て、復帰すると元に戻る', async ({ page }) => {
  await controlled(page);
  await page.context().setOffline(true);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'オフラインです' })).toBeVisible();
  await expect(page.getByText('インターネットに接続してからもう一度お試しください')).toBeVisible();
  await expect(
    page.getByText('学習目的の非公式プロジェクトです。Meta 社とは関係ありません。'),
  ).toBeVisible();
  await page.context().setOffline(false);
  await page.getByRole('button', { name: '再読み込み' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'オフラインです' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/\?*$/);
  await expect(page.getByRole('navigation').first()).toBeVisible();
});

signedIn('オフラインのとき、以前のログイン中の画面の内容は出ない', async ({ page, me }) => {
  const author = `e2e_a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  seedUser(author, `${author}@example.com`);
  seedFollow(userRow(me.username)!.id as string, userRow(author)!.id as string);
  insertPost({
    authorUsername: author,
    caption: 'オフラインの確認',
    createdAt: Date.now() - 60_000,
    altTexts: ['オフラインの確認の写真'],
  });
  await controlled(page);
  await expect(page.getByText(author).first()).toBeVisible();
  await page.context().setOffline(true);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'オフラインです' })).toBeVisible();
  await expect(page.getByText(author)).toHaveCount(0);
  const cached = await page.evaluate(async () => {
    const out: Record<string, string[]> = {};
    for (const name of await caches.keys()) {
      out[name] = (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname);
    }
    return out;
  });
  expect(cached).toEqual({ 'offline-v1': ['/assets/offline.html'] });
});

signedIn('コンソールに CSP の違反もエラーも出ない', async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as unknown as { __csp: string[] }).__csp.push(
        `${e.violatedDirective} ${e.blockedURI}`,
      ),
    );
  });
  await controlled(page);
  await page.waitForLoadState('networkidle');
  await page.context().setOffline(true);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'オフラインです' })).toBeVisible();
  const csp = await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
  expect(csp).toEqual([]);
  expect(problems).toEqual([]);
});

signedIn(
  'オフラインの案内の画面で axe の重大な違反が 0 件で、再読み込みは 44px 以上',
  async ({ page }) => {
    await controlled(page);
    await page.context().setOffline(true);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    expect(await page.locator('html').getAttribute('lang')).toBe('ja');
    await expectNoSeriousViolations(page, 'オフラインの案内の画面');
    const button = page.getByRole('button', { name: '再読み込み' });
    const box = await button.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
    await button.focus();
    await expect(button).toBeFocused();
    await page.context().setOffline(false);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'オフラインです' })).toHaveCount(0);
  },
);
