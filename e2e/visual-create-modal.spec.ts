import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';
import { test } from './support/auth';
import { expectNoSeriousViolations } from './support/axe';
import { mediaRows, postRows, userRow } from './support/db';
import { makeJpeg } from './support/fixtures';
import { holdScripts, waitForHydration } from './support/hydration';
import { expectPx, rect, styles, VIEWPORTS } from './support/measure';

const POST_URL = /\/p\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FAILED = 'アップロードに失敗しました。もう一度お試しください';

const modal = (page: Page) => page.getByRole('dialog', { name: '新規投稿を作成' });
const title = (page: Page, text: string) => modal(page).getByRole('heading', { name: text });
const nav = (page: Page) => page.getByRole('link', { name: '投稿', exact: true }).first();
const chooser = (page: Page) => modal(page).locator('input[type="file"]');
const next = (page: Page) => modal(page).getByRole('button', { name: '次へ', exact: true });
const back = (page: Page) => modal(page).getByRole('button', { name: '戻る', exact: true });
const share = (page: Page) => modal(page).getByRole('button', { name: 'シェア', exact: true });
const ratioButton = (page: Page) => modal(page).getByRole('button', { name: '比率を選ぶ' });
const frame = (page: Page, n: number) =>
  modal(page).getByRole('group', { name: `写真 ${n} の切り抜き` });
const discard = (page: Page) => page.getByRole('alertdialog', { name: '投稿を破棄しますか？' });
const alerts = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

const file = (name: string, buffer: Buffer) => ({ name, mimeType: 'image/jpeg', buffer });

/** Opens the home screen (hydrated) and returns the signed-in user's name. */
async function openHome(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('main').waitFor();
  await waitForHydration(page);
  const href = await page.getByRole('link', { name: 'プロフィール' }).first().getAttribute('href');
  return href!.slice(1);
}

/** Presses the navigation's 投稿 (the side nav, or the bottom tab on a narrow screen). */
async function openModal(page: Page): Promise<void> {
  await nav(page).click();
  await expect(page).toHaveURL(/\/create$/);
  await expect(modal(page)).toBeVisible();
  // Measure and scan once the opening motion is over.
  await expect(modal(page).getByTestId('create-box')).toHaveCSS('opacity', '1');
}

async function pickPhotos(page: Page, count: number, jpeg: Buffer): Promise<void> {
  await chooser(page).setInputFiles(
    Array.from({ length: count }, (_, i) => file(`m${i + 1}.jpg`, jpeg)),
  );
  await expect(title(page, '切り取る')).toBeVisible();
}

async function toCaption(page: Page): Promise<void> {
  await next(page).click();
  await expect(title(page, '新規投稿を作成')).toBeVisible();
}

test('ナビの投稿でホームの上に作成のモーダルが開く', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.wide);
  await openHome(page);
  await openModal(page);

  const box = modal(page);
  await expect(box).toHaveAttribute('aria-modal', 'true');
  // The home screen stays behind it.
  await expect(page.getByRole('main')).toBeAttached();
  const backdrop = await styles(box.locator('xpath=ancestor::*[contains(@class,"fixed")][1]'), [
    'background-color',
  ]);
  expect(backdrop['background-color']).toBe('rgba(0, 0, 0, 0.65)');
  const inner = box.getByTestId('create-box');
  expect((await styles(inner, ['border-top-left-radius']))['border-top-left-radius']).toBe('12px');
  expectPx((await rect(box.locator('header'))).height, 44, 'ヘッダーの高さ');
  const surface = await rect(box.getByTestId('create-surface'));
  expectPx(surface.width, 680, '作業面の幅');
  expectPx(surface.height, 680, '作業面の高さ');
  const primary = box.locator('label', { hasText: 'コンピューターから選択' });
  await expect(primary).toBeVisible();
  expect((await styles(primary, ['background-color']))['background-color']).not.toBe(
    'rgba(0, 0, 0, 0)',
  );
});

test('プロフィールの上でも作成のモーダルが開く', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.wide);
  const me = await openHome(page);
  await page.goto(`/${me}`);
  await page.getByRole('main').waitFor();
  await waitForHydration(page);
  await openModal(page);
  await expect(page.getByRole('heading', { name: '投稿を作成', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: me, exact: true })).toBeAttached();
});

test('写真を選ぶと切り取りの段に進む', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.wide);
  await openHome(page);
  await openModal(page);
  const jpeg = await makeJpeg(page, 800, 600);
  await pickPhotos(page, 2, jpeg);

  await expect(frame(page, 1)).toBeVisible();
  const ratio = ratioButton(page);
  const r = await rect(ratio);
  expectPx(r.width, 44, '比率ボタンの幅');
  expectPx(r.height, 44, '比率ボタンの高さ');
  const surface = await rect(modal(page).getByTestId('create-surface'));
  expect(r.x - surface.x).toBeLessThan(40);
  expect(surface.y + surface.height - (r.y + r.height)).toBeLessThan(40);
  await expect(back(page)).toBeVisible();
  const nextColor = await styles(next(page), ['color', 'font-weight']);
  expect(nextColor['font-weight']).toBe('600');
  expect(nextColor.color).toBe('rgb(79, 70, 200)');
  await expect(frame(page, 1)).toHaveAttribute('data-crop', '100,0,600,600');

  await modal(page).getByRole('button', { name: '次の写真' }).click();
  await expect(frame(page, 2)).toBeVisible();
  await modal(page).getByRole('button', { name: '前の写真' }).click();
  await expect(frame(page, 1)).toBeVisible();
});

test('比率は左下のボタンで切り替え、段を行き来しても残る', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.wide);
  await openHome(page);
  await openModal(page);
  const jpeg = await makeJpeg(page, 800, 600);
  await pickPhotos(page, 1, jpeg);

  await ratioButton(page).click();
  await modal(page).getByRole('radiogroup').getByRole('radio', { name: '4:5' }).click();
  await expect(frame(page, 1)).toHaveAttribute('data-crop', '160,0,480,600');
  const surface = await rect(modal(page).getByTestId('create-surface'));
  const fr = await rect(frame(page, 1));
  expectPx(fr.height, surface.height, '枠の高さ');
  expectPx(fr.width / fr.height, 0.8, '枠の比');

  const box = (await frame(page, 1).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 30, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  const moved = await frame(page, 1).getAttribute('data-crop');
  expect(moved).not.toBe('160,0,480,600');

  await toCaption(page);
  await back(page).click();
  await expect(title(page, '切り取る')).toBeVisible();
  await expect(frame(page, 1)).toHaveAttribute('data-crop', moved!);
});

test('次へでキャプションの段になり、右に 340px の列が足される', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.wide);
  await openHome(page);
  await openModal(page);
  const jpeg = await makeJpeg(page, 800, 600);
  await pickPhotos(page, 2, jpeg);
  await toCaption(page);

  const m = modal(page);
  expectPx((await rect(m.getByTestId('create-box'))).width, 1020, '箱の幅');
  expectPx((await rect(m.getByTestId('create-side'))).width, 340, '右の列の幅');
  await expect(m.getByTestId('create-side').getByText('e2e_', { exact: false })).toBeVisible();
  await expect(m.getByLabel('キャプション')).toBeVisible();
  await expect(m.getByLabel('写真 1 の代替テキスト')).toBeVisible();
  await expect(m.getByLabel('写真 2 の代替テキスト')).toBeVisible();
  await expect(m.getByRole('button', { name: /^後ろへ（写真 1）$/ })).toBeVisible();
  await expect(m.getByRole('button', { name: /^この写真を外す（写真 2）$/ })).toBeVisible();
  await expect(share(page)).toBeVisible();
  await expect(next(page)).toHaveCount(0);
});

test('シェアすると投稿され、投稿の画面に移る', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.wide);
  const me = await openHome(page);
  await openModal(page);
  const jpeg = await makeJpeg(page, 800, 600);
  await pickPhotos(page, 2, jpeg);
  await toCaption(page);
  await modal(page).getByLabel('キャプション').fill('はじめての投稿');
  await share(page).click();
  await expect(share(page)).toBeDisabled();
  await expect(modal(page).getByRole('status')).toHaveText('シェアしています');

  await expect(page).toHaveURL(POST_URL);
  await expect(page.getByText('はじめての投稿')).toBeVisible();
  const rows = postRows(userRow(me)!.id as string);
  expect(rows).toHaveLength(1);
  expect(mediaRows(rows[0]!.id as string)).toHaveLength(2);
  await expect(page.locator('img[src*="media"]')).toHaveCount(2);
});

test('シェアに失敗してもモーダルに入力が残る', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.wide);
  const me = await openHome(page);
  await openModal(page);
  const jpeg = await makeJpeg(page, 800, 600);
  await pickPhotos(page, 2, jpeg);
  await toCaption(page);
  await modal(page).getByLabel('キャプション').fill('やり直す投稿');

  await page.route('**/media/**', (route) => route.fulfill({ status: 500, body: '' }));
  await share(page).click();
  await expect(alerts(page)).toContainText(FAILED);
  await expect(modal(page)).toBeVisible();
  await expect(modal(page).getByLabel('キャプション')).toHaveValue('やり直す投稿');
  await expect(modal(page).getByLabel('写真 2 の代替テキスト')).toBeVisible();
  await expect(share(page)).toBeEnabled();

  await page.unroute('**/media/**');
  await share(page).click();
  await expect(page).toHaveURL(POST_URL);
  expect(postRows(userRow(me)!.id as string)).toHaveLength(1);
});

test('キャプションの上限は 2,200 字', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.wide);
  await openHome(page);
  await openModal(page);
  const jpeg = await makeJpeg(page, 200, 200);
  await pickPhotos(page, 1, jpeg);
  await toCaption(page);
  const caption = modal(page).getByLabel('キャプション');
  await caption.fill('あ'.repeat(2200));
  await expect(share(page)).toBeEnabled();
  await caption.fill('あ'.repeat(2201));
  await expect(share(page)).toBeDisabled();
  await expect(alerts(page)).toContainText('キャプションは 2,200 字までです');
  await caption.fill('あ'.repeat(2200));
  await expect(share(page)).toBeEnabled();
});

test('写真を選んだ後に閉じると破棄を確かめる', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.wide);
  await openHome(page);

  // Before a photo is picked nothing is asked.
  await openModal(page);
  await modal(page).getByRole('button', { name: '閉じる' }).click();
  await expect(modal(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expect(nav(page)).toBeFocused();

  await openModal(page);
  const jpeg = await makeJpeg(page, 400, 400);
  await pickPhotos(page, 1, jpeg);
  for (const close of [
    () => modal(page).getByRole('button', { name: '閉じる' }).click(),
    () => page.keyboard.press('Escape'),
    () => page.mouse.click(8, 8),
  ]) {
    await close();
    await expect(discard(page)).toBeVisible();
    await discard(page).getByRole('button', { name: 'キャンセル' }).click();
    await expect(discard(page)).toHaveCount(0);
    await expect(modal(page)).toBeVisible();
    await expect(title(page, '切り取る')).toBeVisible();
  }
  await modal(page).getByRole('button', { name: '閉じる' }).click();
  await discard(page).getByRole('button', { name: '破棄' }).click();
  await expect(modal(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  await expect(nav(page)).toBeFocused();
});

test('直接開いたときとスクリプトの前は 1 ページのフォームのまま', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.wide);
  await page.goto('/create');
  await page.getByRole('main').waitFor();
  await expect(page.getByRole('heading', { name: '投稿を作成', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: '投稿を作成', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // The scripts held back: the link is a plain navigation to the page.
  const release = await holdScripts(page);
  await page.goto('/', { waitUntil: 'commit' });
  await nav(page).waitFor();
  expect(await page.locator('html[data-hydrated="1"]').count()).toBe(0);
  // The stylesheet is held back too, so press the key instead of clicking.
  await nav(page).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByRole('heading', { name: '投稿を作成', exact: true })).toBeVisible();
  release();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('狭い画面では全画面の段の流れになる', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  await openHome(page);
  await openModal(page);
  const box = modal(page).getByTestId('create-box');
  const r = await rect(box);
  expectPx(r.width, 375, '幅');
  expectPx(r.height, 812, '高さ');
  expect((await styles(box, ['border-top-left-radius']))['border-top-left-radius']).toBe('0px');
  const backdrop = await styles(
    modal(page).locator('xpath=ancestor::*[contains(@class,"fixed")][1]'),
    ['background-color'],
  );
  expect(backdrop['background-color']).not.toBe('rgba(0, 0, 0, 0.65)');

  const jpeg = await makeJpeg(page, 800, 600);
  await pickPhotos(page, 1, jpeg);
  await toCaption(page);
  await modal(page).getByLabel('キャプション').fill('スマホの投稿');
  await share(page).click();
  await expect(page).toHaveURL(POST_URL);
});

test('作成のモーダルは視差効果を減らす設定で動かない', async ({ page }) => {
  const durationOf = async () => {
    await openModal(page);
    const d = await styles(modal(page).getByTestId('create-box'), ['transition-duration']);
    return d['transition-duration']!;
  };
  await page.setViewportSize(VIEWPORTS.wide);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openHome(page);
  expect(await durationOf()).not.toBe('0s');
  await page.goBack();
  await expect(modal(page)).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await durationOf()).toBe('0s');
  const jpeg = await makeJpeg(page, 200, 200);
  await pickPhotos(page, 1, jpeg);
  await toCaption(page);
  const all = await modal(page).evaluate((el) =>
    Array.from(el.querySelectorAll('*')).map((n) => getComputedStyle(n).transitionDuration),
  );
  expect(all.filter((d) => d.split(',').some((x) => x.trim() !== '0s'))).toEqual([]);
});

async function tooSmall(scope: Locator): Promise<string[]> {
  return scope.evaluate((root) => {
    const small: string[] = [];
    const found = root.querySelectorAll<HTMLElement>(
      'button, a[href], textarea, label:has(input[type="file"]), input:not([type="file"])',
    );
    for (const el of found) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.width < 43.5 || r.height < 43.5) {
        small.push(
          `${el.tagName} ${(el.getAttribute('aria-label') ?? el.textContent ?? '').slice(0, 20)} ${r.width}x${r.height}`,
        );
      }
    }
    return small;
  });
}

test('作成のモーダルの各段に axe の重大な違反が無い', async ({ page }) => {
  const jpeg = await makeJpeg(page, 800, 600);
  for (const viewport of [VIEWPORTS.mobile, VIEWPORTS.narrow, VIEWPORTS.wide]) {
    await page.setViewportSize(viewport);
    await openHome(page);
    await openModal(page);
    const at = (step: string) => `${viewport.width}px ${step}`;
    await expectNoSeriousViolations(page, at('選ぶ'));
    expect(await tooSmall(modal(page)), at('選ぶ')).toEqual([]);
    await pickPhotos(page, 2, jpeg);
    await ratioButton(page).click();
    await expect(modal(page).getByRole('radiogroup')).toBeVisible();
    await expectNoSeriousViolations(page, at('切り取る'));
    expect(await tooSmall(modal(page)), at('切り取る')).toEqual([]);
    await modal(page).getByRole('radio', { name: '1:1' }).click();
    await toCaption(page);
    await expectNoSeriousViolations(page, at('キャプション'));
    expect(await tooSmall(modal(page)), at('キャプション')).toEqual([]);
    await page.goto('/');
  }
});

test('シェアの最中に閉じる操作をしても何も起きず、終わると投稿の画面に移る', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.wide);
  await openHome(page);
  await openModal(page);
  const jpeg = await makeJpeg(page, 400, 400);
  await pickPhotos(page, 1, jpeg);
  await toCaption(page);

  // Hold every server action (the upload request, then createPost) until released.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/create', async (route) => {
    if (route.request().method() === 'POST' && route.request().headers()['next-action']) {
      await gate;
    }
    await route.continue();
  });
  await share(page).click();
  await expect(modal(page).getByRole('status')).toHaveText('シェアしています');

  await page.keyboard.press('Escape');
  await page.mouse.click(8, 8);
  await expect(discard(page)).toHaveCount(0);
  await expect(modal(page)).toBeVisible();
  await expect(page).toHaveURL(/\/create$/);

  release();
  await expect(page).toHaveURL(POST_URL, { timeout: 15_000 });
});

test('存在しない深い URL は 404 の画面になる', async ({ page }) => {
  const response = await page.goto('/a/b/c');
  expect(response!.status()).toBe(404);
  await expect(modal(page)).toHaveCount(0);
});

const PDF = { name: 'memo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') };

/** The error list for an unusable file: opens the picker in the modal or on the `/create` page. */
async function openWithBadFile(page: Page, where: 'modal' | 'page'): Promise<Locator> {
  if (where === 'modal') {
    await openHome(page);
    await openModal(page);
    await chooser(page).setInputFiles(PDF);
  } else {
    await page.goto('/create');
    await page.getByRole('main').waitFor();
    await waitForHydration(page);
    await page.locator('input[type="file"]').setInputFiles(PDF);
  }
  const alert = alerts(page).filter({ has: page.getByRole('listitem') });
  await expect(alert).toHaveCount(1);
  return alert;
}

test('使えないファイルの誤りの一覧に axe の違反が無い', async ({ page }) => {
  for (const viewport of [VIEWPORTS.mobile, VIEWPORTS.narrow, VIEWPORTS.wide]) {
    for (const where of ['modal', 'page'] as const) {
      await page.setViewportSize(viewport);
      const alert = await openWithBadFile(page, where);
      const label = `${viewport.width}px ${where}`;
      expect(await alert.evaluate((el) => el.tagName), label).toBe('DIV');
      expect(await alert.locator('> ul > li').count(), label).toBe(1);
      expect(await page.locator('ul[role="alert"]').count(), label).toBe(0);
      const { violations } = await new AxeBuilder({ page })
        .withRules(['listitem', 'list', 'color-contrast'])
        .analyze();
      expect(
        violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
        label,
      ).toEqual([]);
      await expectNoSeriousViolations(page, label);
    }
  }
});

test('誤りの文字は背景に対して 4.5:1 以上', async ({ page }) => {
  for (const viewport of [VIEWPORTS.mobile, VIEWPORTS.narrow, VIEWPORTS.wide]) {
    for (const where of ['modal', 'page'] as const) {
      await page.setViewportSize(viewport);
      const alert = await openWithBadFile(page, where);
      const ratio = await alert.locator('li').evaluate((el) => {
        const toRgba = (css: string): number[] => {
          const c = document.createElement('canvas');
          c.width = c.height = 1;
          const ctx = c.getContext('2d')!;
          ctx.fillStyle = css;
          ctx.fillRect(0, 0, 1, 1);
          return [...ctx.getImageData(0, 0, 1, 1).data];
        };
        let bg = [255, 255, 255];
        for (let n: Element | null = el; n; n = n.parentElement) {
          const [r, g, b, a] = toRgba(getComputedStyle(n).backgroundColor);
          if (a === 255) {
            bg = [r!, g!, b!];
            break;
          }
        }
        const fg = toRgba(getComputedStyle(el).color);
        const lum = ([r, g, b]: number[]) =>
          [r, g, b]
            .map((v) => v! / 255)
            .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
            .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i]!, 0);
        const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
        return (hi! + 0.05) / (lo! + 0.05);
      });
      expect(ratio, `${viewport.width}px ${where}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test('使えないファイルの誤りは role=alert で、すぐに読み上げられる', async ({ page }) => {
  const alert = await openWithBadFile(page, 'modal');
  await expect(alert).toHaveAttribute('role', 'alert');
  await expect(alerts(page)).toHaveCount(1);
});
