import { expect, test as base, type Page } from '@playwright/test';
import { signedIn } from './support/auth';
import { expectNoSeriousViolations } from './support/axe';
import { seedUser } from './support/db';
import { holdScripts, waitForHydration } from './support/hydration';

const test = signedIn;
// Next.js has its own role=alert (the route announcer); these are the screen's.
const alerts = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');
const box = (page: Page) => page.getByRole('combobox', { name: 'ユーザーを検索' });
const options = (page: Page) => page.getByRole('listbox', { name: '候補' }).getByRole('option');

/** A random lower-case prefix, so a run only sees the users it made itself. */
const prefix = () => `e2es${Math.random().toString(36).slice(2, 7)}`;

/** Users named `<p>_<suffix>` with the given display names; returns the usernames. */
function seed(p: string, rows: Array<[string, string]>): string[] {
  return rows.map(([suffix, displayName]) => {
    const username = `${p}_${suffix}`;
    seedUser(username, `${username}@example.com`, { displayName });
    return username;
  });
}

async function open(page: Page) {
  await page.goto('/explore/search');
  await waitForHydration(page);
  await expect(box(page)).toBeVisible();
}

base('未ログインで検索を開くとログインへ移る', async ({ page }) => {
  await page.goto('/explore/search');
  await expect(page).toHaveURL(/\/accounts\/login/);
});

test('入力すると候補が出て、選ぶとプロフィールに移る', async ({ page }) => {
  const p = prefix();
  const [hana, other] = seed(p, [
    ['hana', 'Hana'],
    ['mio', `${p} Haruka`],
  ]);
  await open(page);
  await box(page).fill(`${p}_ha`);
  await expect(options(page)).toHaveCount(1);
  const first = options(page).first();
  await expect(first).toContainText(hana!);
  await expect(first).toContainText('Hana');
  expect(other).toBeTruthy();
  await first.click();
  await expect(page).toHaveURL(new RegExp(`/${hana}$`));
});

test('JS が読み込まれる前でも Enter で結果のページが出る', async ({ page }) => {
  const p = prefix();
  const [hana, hiro] = seed(p, [
    ['hana', 'Hana'],
    ['hiro', 'Hiro'],
  ]);
  const release = await holdScripts(page);
  await page.goto('/explore/search', { waitUntil: 'commit' });
  await expect(page.locator('input[name="q"]')).toBeVisible();
  await page.locator('input[name="q"]').fill(`${p}_h`);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/explore/search\\?q=${p}_h$`));
  const links = page.getByRole('main').getByRole('link');
  await expect(links.filter({ hasText: hana! })).toHaveAttribute('href', `/${hana}`);
  await expect(links.filter({ hasText: hiro! })).toHaveAttribute('href', `/${hiro}`);
  release();
});

test('一致が無いときの文言', async ({ page }) => {
  const q = `<i>x${Math.random().toString(36).slice(2, 8)}</i>`;
  await open(page);
  await box(page).fill(q);
  const message = `「${q}」に一致するユーザーはいません`;
  await expect(page.getByText(message).first()).toBeVisible();
  await expect(page.locator('main i')).toHaveCount(0);

  // The server-rendered page says the same.
  await page.goto(`/explore/search?q=${encodeURIComponent(q)}`);
  await expect(page.getByText(message)).toBeVisible();
  await expect(page.locator('main i')).toHaveCount(0);
});

test('検索が失敗したときの警告', async ({ page }) => {
  await open(page);
  await page.route('**/explore/search', (route) =>
    route.request().method() === 'POST' ? route.abort() : route.continue(),
  );
  await box(page).fill('abc');
  await expect(alerts(page)).toHaveText('検索できませんでした。もう一度お試しください');
  await expect(box(page)).toHaveValue('abc');
});

test('キーボードだけで検索でき、axe の重大な違反が 0 件', async ({ page }) => {
  const p = prefix();
  const [a, b] = seed(p, [
    ['aa', 'First'],
    ['ab', 'Second'],
  ]);
  await open(page);
  await expect(box(page)).toHaveAttribute('aria-autocomplete', 'list');
  await expect(box(page)).toHaveAttribute('aria-expanded', 'false');

  await box(page).focus();
  await page.keyboard.type(`${p}_a`);
  await expect(options(page)).toHaveCount(2);
  await expect(box(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: '2 件の候補' })).toHaveCount(
    1,
  );
  const list = page.getByRole('listbox', { name: '候補' });
  await expect(box(page)).toHaveAttribute('aria-controls', (await list.getAttribute('id'))!);

  await page.keyboard.press('ArrowDown');
  await expect(options(page).nth(0)).toHaveAttribute('aria-selected', 'true');
  await expect(box(page)).toHaveAttribute(
    'aria-activedescendant',
    (await options(page).nth(0).getAttribute('id'))!,
  );
  await page.keyboard.press('ArrowDown');
  await expect(options(page).nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowDown'); // stops at the end
  await expect(options(page).nth(1)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowUp');
  await expect(options(page).nth(0)).toHaveAttribute('aria-selected', 'true');

  for (const width of [375, 768, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await expectNoSeriousViolations(page, `/explore/search ${width}px`);
    const h = (await options(page).nth(0).boundingBox())!.height;
    expect(h).toBeGreaterThanOrEqual(44);
  }

  await page.keyboard.press('Escape');
  await expect(box(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(box(page)).toHaveValue(`${p}_a`);
  await expect(options(page)).toHaveCount(0);

  await page.keyboard.press('ArrowDown');
  await expect(options(page)).toHaveCount(2);
  await expect(options(page).nth(0)).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/${a}$`));
  expect(b).toBeTruthy();
});
