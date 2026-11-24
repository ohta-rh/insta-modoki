import { expect, type Page } from '@playwright/test';
import { expectNoSeriousViolations } from './support/axe';
import { VIEWPORTS } from './support/measure';
import { newScreenPage, openSettled, SCREENS, test, type World } from './support/screens';

const MOBILE = 375;
const WIDTHS = [VIEWPORTS.mobile, VIEWPORTS.narrow, VIEWPORTS.wide];
const PDF = { name: 'memo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') };

type Scene = { name: string; open: (page: Page, world: World) => Promise<void>; loggedIn: boolean };

/** Every screen, and the create modal after a file that cannot be used was chosen. */
const SCENES: Scene[] = [
  ...SCREENS.map((screen) => ({
    name: screen.name,
    loggedIn: screen.loggedIn,
    open: (page: Page, world: World) => openSettled(page, screen.path(world)),
  })),
  {
    name: '作成のモーダル（使えないファイルを選んだ状態）',
    loggedIn: true,
    open: async (page) => {
      await openSettled(page, '/');
      await page.getByRole('link', { name: '投稿', exact: true }).first().click();
      const modal = page.getByRole('dialog', { name: '新規投稿を作成' });
      await expect(modal).toBeVisible();
      await modal.locator('input[type="file"]').setInputFiles(PDF);
      await expect(
        page
          .locator('[role="alert"]:not(#__next-route-announcer__)')
          .filter({ has: page.getByRole('listitem') }),
      ).toHaveCount(1);
      // The modal fades in; measure and scan the settled colours.
      await expect(modal.getByTestId('create-box')).toHaveCSS('opacity', '1');
    },
  },
];

for (const vp of WIDTHS) {
  for (const scene of SCENES) {
    test(`${vp.width}px ${scene.name} で axe の重大・深刻な違反が 0 件`, async ({
      browser,
      world,
    }) => {
      const page = await newScreenPage(browser, {
        world,
        loggedIn: scene.loggedIn,
        width: vp.width,
        height: vp.height,
      });
      await scene.open(page, world);
      await expectNoSeriousViolations(page, `${vp.width}px ${scene.name}`);
      await page.context().close();
    });
  }
}

test('投稿のモーダルで axe の重大・深刻な違反が 0 件', async ({ browser, world }) => {
  const page = await newScreenPage(browser, { world, loggedIn: true, width: MOBILE });
  await openSettled(page, `/${world.author}`);
  await page.locator(`[data-testid="post-grid"] a[href="/p/${world.detailPostId}"]`).click();
  await expect(page.getByRole('dialog', { name: '投稿', exact: true })).toBeVisible();
  // The modal fades in; axe measures contrast on the settled colours, not on a half-faded frame.
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
  await expectNoSeriousViolations(page, '投稿のモーダル');
  await page.context().close();
});

test('いいねした人の一覧で axe の重大・深刻な違反が 0 件', async ({ browser, world }) => {
  const page = await newScreenPage(browser, { world, loggedIn: true, width: MOBILE });
  await openSettled(page, `/p/${world.likersPostId}`);
  await page.getByRole('button', { name: 'いいね', exact: true }).click();
  await page.getByRole('button', { name: '1 件のいいね', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'いいねした人' });
  await expect(dialog.getByRole('listitem')).toHaveCount(1);
  await expectNoSeriousViolations(page, 'いいねした人の一覧');
  await page.context().close();
});

for (const vp of WIDTHS) {
  test(`${vp.width}px で操作できる要素が全て 44×44px 以上`, async ({ browser, world }) => {
    for (const scene of SCENES) {
      const page = await newScreenPage(browser, {
        world,
        loggedIn: scene.loggedIn,
        width: vp.width,
        height: vp.height,
      });
      await scene.open(page, world);
      if (vp.width >= 1160 && scene.name === 'ホームフィード') {
        // The scene must put the 「おすすめ」 names under the check, or it checks nothing about them.
        await expect(
          page.locator('aside[aria-label="おすすめ"] li > span > a').first(),
        ).toBeVisible();
      }
      const small = await page.evaluate(() => {
        // Every link and button inside main (EPIC #87 AC-10), and the other controls of the page.
        const selector =
          'main a, main button, button, [role=button], input, select, textarea, [role=tab], nav a, aside a';
        const targets = Array.from(document.querySelectorAll(selector));
        return targets.flatMap((el) => {
          if (el instanceof HTMLInputElement && el.type === 'hidden') return [];
          const box = el.getBoundingClientRect();
          // Not on screen (display: none) or only for a screen reader (sr-only, 1px).
          if (box.width <= 1 || box.height <= 1) return [];
          if (box.width >= 44 && box.height >= 44) return [];
          const name = el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30) ?? '';
          return [`<${el.tagName.toLowerCase()}> "${name}" ${box.width}x${box.height}`];
        });
      });
      if (scene.name === 'ホームフィード') {
        // The scene must put "続きを読む" under the check, or it checks nothing about it.
        await expect(page.getByRole('link', { name: '続きを読む' }).first()).toBeVisible();
      }
      expect(small, `${vp.width}px ${scene.name} の小さい要素`).toEqual([]);
      await page.context().close();
    }
  });
}

const photoAlts = (page: Page) =>
  page.locator('img[srcset]').evaluateAll((imgs) => imgs.map((i) => i.getAttribute('alt')));

test('投稿の写真は全て空でない alt を持つ', async ({ browser, world }) => {
  const page = await newScreenPage(browser, { world, loggedIn: true, width: MOBILE });
  for (const path of ['/', `/${world.author}`, `/p/${world.detailPostId}`]) {
    await openSettled(page, path);
    await expect(page.locator('img[srcset]').first()).toBeVisible();
    const alts = await photoAlts(page);
    expect(alts.length, path).toBeGreaterThan(0);
    for (const alt of alts) expect(alt?.trim(), `${path} の alt`).toBeTruthy();
  }
  await page.context().close();
});

test('代替テキストが無い写真は位置と枚数つきの alt を持つ', async ({ browser, world }) => {
  const page = await newScreenPage(browser, { world, loggedIn: true, width: MOBILE });
  await openSettled(page, `/p/${world.detailPostId}`);
  await expect(page.locator('img[srcset]').first()).toBeVisible();
  expect(await photoAlts(page)).toEqual([
    '猫',
    `${world.author} が投稿した写真（2 / 3）`,
    `${world.author} が投稿した写真（3 / 3）`,
  ]);
  await page.context().close();
});

test('いいねの状態が aria-pressed と形で伝わる', async ({ browser, world }) => {
  const page = await newScreenPage(browser, { world, loggedIn: true, width: MOBILE });
  await openSettled(page, `/p/${world.likePostId}`);
  const heart = page.getByRole('button', { name: 'いいね', exact: true });
  await expect(heart).toHaveAttribute('aria-pressed', 'false');
  const shape = () => heart.locator('svg').getAttribute('fill');
  // The outline heart has no fill; the pressed one paints its shape.
  expect(await shape()).toBe('none');
  await heart.click();
  await expect(heart).toHaveAttribute('aria-pressed', 'true');
  expect(await shape()).toBe('currentColor');
  await page.context().close();
});

test('画面ごとに h1 が 1 つ', async ({ browser, world }) => {
  for (const screen of SCREENS) {
    const page = await newScreenPage(browser, { world, loggedIn: screen.loggedIn, width: MOBILE });
    await openSettled(page, screen.path(world));
    await expect(page.locator('h1'), screen.name).toHaveCount(1);
    await page.context().close();
  }
});

test('html の lang が ja', async ({ browser, world }) => {
  for (const screen of SCREENS) {
    const page = await newScreenPage(browser, { world, loggedIn: screen.loggedIn, width: MOBILE });
    await openSettled(page, screen.path(world));
    await expect(page.locator('html'), screen.name).toHaveAttribute('lang', 'ja');
    await page.context().close();
  }
});
