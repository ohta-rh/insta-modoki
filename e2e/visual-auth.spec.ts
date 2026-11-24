import { randomInt } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { inviteOnlyHeaders } from './support/admin';
import { signInViaHarness } from './support/auth';
import { waitForHydration } from './support/hydration';
import { expectPx, rect, styles, VIEWPORTS } from './support/measure';

// The log-in and sign-up screens against docs/research/web-ui-reference.md §2.8 (#96).

const INDIGO = 'rgb(79, 70, 200)';
const DANGER = 'rgb(214, 45, 60)';
const INPUT_BORDER = 'rgb(142, 142, 142)';

async function open(page: Page, viewport: { width: number; height: number }, path: string) {
  await page.setViewportSize(viewport);
  await page.goto(path);
  await waitForHydration(page);
}

const hero = (page: Page) => page.locator('[data-auth="hero"]');
const pane = (page: Page) => page.locator('[data-auth="pane"]');
const form = (page: Page) => page.locator('main form');

test('1280px のログインは左右 2 分で、フォームは 536px', async ({ page }) => {
  await open(page, VIEWPORTS.wide, '/accounts/login');
  const left = await rect(hero(page));
  const right = await rect(pane(page));
  expect(Math.abs(left.width - 638) <= 2, `左の区画の幅: ${left.width}px（参照 638px ±2）`).toBe(
    true,
  );
  expect(Math.abs(right.width - 640) <= 2, `右の区画の幅: ${right.width}px（参照 640px ±2）`).toBe(
    true,
  );
  await expect(hero(page)).toHaveAttribute('aria-hidden', 'true');
  expect((await styles(hero(page), ['border-right-width']))['border-right-width']).toBe('2px');
  expectPx((await rect(hero(page).locator('svg').first())).width, 60, '印の幅');
  const tagline = await styles(hero(page).locator('p'), ['font-size', 'font-weight']);
  expect(tagline['font-size']).toBe('35.84px');
  expect(tagline['font-weight']).toBe('400');

  expectPx((await rect(form(page))).width, 536, 'フォームの幅');
  const h1 = pane(page).getByRole('heading', { name: 'ログイン', level: 1 });
  const h = await styles(h1, ['font-size', 'font-weight', 'line-height']);
  expect([h['font-size'], h['font-weight'], h['line-height']]).toEqual(['17px', '600', '22px']);
});

test('1024px は 2 分、375px は 271px の 1 列', async ({ page }) => {
  await open(page, VIEWPORTS.narrow, '/accounts/login');
  const right = await rect(pane(page));
  expectPx(right.width, 512, '右の区画の幅（画面の半分）');
  expectPx((await rect(form(page))).width, right.width - 104, 'フォームの幅（区画 − 104px）');
  await expect(hero(page)).toBeVisible();

  await open(page, VIEWPORTS.mobile, '/accounts/login');
  await expect(hero(page)).toBeHidden();
  expectPx((await rect(form(page))).width, 271, '375px のフォームの幅');
});

test('入力は 60px・角丸 16px で、ラベルは枠の中から上に動く', async ({ page }) => {
  await open(page, VIEWPORTS.wide, '/accounts/login');
  const email = page.getByLabel('メールアドレス');
  const password = page.getByLabel('パスワード');
  const e = await rect(email);
  const p = await rect(password);
  expectPx(e.height, 60, 'メールアドレスの入力の高さ');
  expectPx(p.height, 60, 'パスワードの入力の高さ');
  expectPx(p.y - (e.y + e.height), 12, '入力の間');
  const s = await styles(email, [
    'border-top-left-radius',
    'border-top-width',
    'border-top-color',
    'font-size',
    'font-weight',
  ]);
  expect(s['border-top-left-radius']).toBe('16px');
  expect(s['border-top-width']).toBe('1px');
  expect(s['border-top-color']).toBe(INPUT_BORDER);
  expect(s['font-size']).toBe('15px');
  expect(s['font-weight']).toBe('500');

  // The label sits inside the border, 15px while the field is empty and unfocused.
  const label = page.locator('label[for="email"]');
  const l = await rect(label);
  expect(l.y >= e.y && l.y + l.height <= e.y + e.height, 'ラベルが入力の枠の中にある').toBe(true);
  expect((await styles(label, ['font-size']))['font-size']).toBe('15px');
  // Focus lifts it to 12px, and it stays up with a value after the focus leaves.
  await email.focus();
  await expect.poll(async () => (await styles(label, ['font-size']))['font-size']).toBe('12px');
  await email.fill('a@example.com');
  await password.focus();
  await expect.poll(async () => (await styles(label, ['font-size']))['font-size']).toBe('12px');
  await email.fill('');
  await email.blur();
  await expect.poll(async () => (await styles(label, ['font-size']))['font-size']).toBe('15px');

  await open(page, VIEWPORTS.mobile, '/accounts/login');
  expect((await styles(page.getByLabel('メールアドレス'), ['font-size']))['font-size']).toBe(
    '16px',
  );
});

test('ラベルは視差効果を減らす設定では動かずに切り替わる', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, VIEWPORTS.wide, '/accounts/login');
  const label = page.locator('label[for="email"]');
  const field = await rect(page.getByLabel('メールアドレス'));
  const l = await rect(label);
  expect(l.y >= field.y && l.y + l.height <= field.y + field.height, 'ラベルが入力の枠の中').toBe(
    true,
  );
  expect((await styles(label, ['transition-duration']))['transition-duration']).toBe('0s');
  // With no motion the label is at its final place the moment the field takes the focus.
  await page.getByLabel('メールアドレス').focus();
  expect((await styles(label, ['font-size']))['font-size']).toBe('12px');
});

test('ログインと新しいアカウントを作成は丸い端の 44px のボタン', async ({ page }) => {
  await open(page, VIEWPORTS.wide, '/accounts/login');
  const password = await rect(page.getByLabel('パスワード'));
  const login = page.getByRole('button', { name: 'ログイン', exact: true });
  const b = await rect(login);
  expectPx(b.height, 44, 'ログインの高さ');
  expectPx(b.y - (password.y + password.height), 24, '最後の入力からの間');
  const s = await styles(login, [
    'border-top-left-radius',
    'background-color',
    'color',
    'font-size',
    'font-weight',
  ]);
  expect(s).toEqual({
    'border-top-left-radius': '22px',
    'background-color': INDIGO,
    color: 'rgb(255, 255, 255)',
    'font-size': '15px',
    'font-weight': '500',
  });

  const create = page.getByRole('link', { name: '新しいアカウントを作成' });
  await expect(create).toHaveAttribute('href', '/accounts/signup');
  expectPx((await rect(create)).height, 44, '新しいアカウントを作成の高さ');
  const c = await styles(create, [
    'border-top-left-radius',
    'border-top-width',
    'border-top-color',
    'color',
  ]);
  expect(c).toEqual({
    'border-top-left-radius': '22px',
    'border-top-width': '1px',
    'border-top-color': INDIGO,
    color: INDIGO,
  });
});

test('ログインの失敗は赤い文と枠で出て、入力が残る', async ({ page }) => {
  const user = await signInViaHarness(page);
  await page.context().clearCookies();
  await page.context().setExtraHTTPHeaders({
    'cf-connecting-ip': `10.${randomInt(256)}.${randomInt(256)}.${1 + randomInt(254)}`,
  });
  await open(page, VIEWPORTS.wide, '/accounts/login');
  await page.getByLabel('メールアドレス').fill(user.email);
  await page.getByLabel('パスワード').fill('wrong-password');
  await page.getByRole('button', { name: 'ログイン', exact: true }).click();
  const alert = page
    .getByRole('alert')
    .filter({ hasText: 'メールアドレスまたはパスワードが違います' });
  await expect(alert).toBeVisible();
  expect((await styles(alert, ['color']))['color']).toBe(DANGER);
  for (const label of ['メールアドレス', 'パスワード']) {
    const field = page.getByLabel(label);
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    expect((await styles(field, ['border-top-color']))['border-top-color'], label).toBe(DANGER);
  }
  await expect(page.getByLabel('メールアドレス')).toHaveValue(user.email);
});

/** The five inputs of the sign-up screen (the invite code appears in an invite-only environment). */
const SIGNUP_LABELS = ['メールアドレス', 'ユーザー名', '表示名', 'パスワード', '招待コード'];

async function expectFloatingShape(page: Page, labels: string[], fontSize: string) {
  let previous: Awaited<ReturnType<typeof rect>> | undefined;
  for (const label of labels) {
    const field = page.getByLabel(label);
    const r = await rect(field);
    expectPx(r.height, 60, `${label}の入力の高さ`);
    if (previous) expectPx(r.y - (previous.y + previous.height), 12, `${label}の上の間`);
    previous = r;
    const s = await styles(field, ['border-top-left-radius', 'border-top-color', 'font-size']);
    expect(s['border-top-left-radius'], label).toBe('16px');
    expect(s['border-top-color'], label).toBe(INPUT_BORDER);
    expect(s['font-size'], label).toBe(fontSize);
  }
}

test('登録は 560px の 1 列で、入力とボタンがログインと同じ形', async ({ page }) => {
  await page.context().setExtraHTTPHeaders(inviteOnlyHeaders());
  await open(page, VIEWPORTS.wide, '/accounts/signup');
  expectPx((await rect(form(page))).width, 560, '中身の幅');
  const back = page.getByRole('link', { name: 'ログイン画面に戻る' });
  await expect(back).toHaveAttribute('href', '/accounts/login');
  const b = await rect(back);
  expectPx(b.width, 44, '戻るの幅');
  expectPx(b.height, 44, '戻るの高さ');
  const radius = (await styles(back, ['border-top-left-radius']))['border-top-left-radius'];
  expect(parseFloat(radius) >= 22, `戻るは丸い: ${radius}`).toBe(true);
  expect((await rect(back)).y < (await rect(page.getByRole('heading', { level: 1 }))).y).toBe(true);

  const h1 = page.getByRole('heading', { name: 'アカウントを作成', level: 1 });
  const h = await styles(h1, ['font-size', 'font-weight', 'line-height']);
  expect([h['font-size'], h['font-weight'], h['line-height']]).toEqual(['24px', '600', '28px']);
  expect((await styles(page.locator('main p').first(), ['font-size']))['font-size']).toBe('15px');

  await expectFloatingShape(page, SIGNUP_LABELS, '15px');

  const submit = page.getByRole('button', { name: 'サインアップ', exact: true });
  const last = await rect(page.getByLabel('招待コード'));
  const sr = await rect(submit);
  expectPx(sr.height, 44, '送信の高さ');
  expectPx(sr.y - (last.y + last.height), 24, '最後の入力からの間');
  const ss = await styles(submit, ['border-top-left-radius', 'background-color', 'color']);
  expect(ss).toEqual({
    'border-top-left-radius': '22px',
    'background-color': INDIGO,
    color: 'rgb(255, 255, 255)',
  });
  const other = page.getByRole('link', { name: 'アカウントをお持ちの場合' });
  await expect(other).toHaveAttribute('href', '/accounts/login');
  expectPx((await rect(other)).height, 44, 'アカウントをお持ちの場合の高さ');
  const os = await styles(other, ['border-top-left-radius', 'background-color']);
  expect(os).toEqual({
    'border-top-left-radius': '22px',
    'background-color': 'rgb(239, 239, 239)',
  });

  // 375px: the content is the screen minus 16px each side, and the text is 16px.
  await open(page, VIEWPORTS.mobile, '/accounts/signup');
  expectPx((await rect(form(page))).width, 343, '375px の中身の幅');
  await expectFloatingShape(page, SIGNUP_LABELS, '16px');
});
