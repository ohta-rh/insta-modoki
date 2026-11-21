import { expect, type Page } from '@playwright/test';
import { newScreenPage, openSettled, test } from './support/screens';

const MODAL = '[role="dialog"][aria-label="投稿"]';
const CAROUSEL = '[aria-roledescription="carousel"]';

/** The computed motion properties of the first element matching `selector`. */
const motionOf = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        transition: cs.transitionDuration,
        animation: cs.animationDuration,
        scroll: cs.scrollBehavior,
      };
    });

async function openCarouselAndModal(
  page: Page,
  world: { author: string; detailPostId: string },
): Promise<{ carousel: string; modal: string }> {
  await openSettled(page, `/p/${world.detailPostId}`);
  await expect(page.locator(CAROUSEL)).toBeVisible();
  const carousel = JSON.stringify(await motionOf(page, CAROUSEL));
  await openSettled(page, `/${world.author}`);
  await page.locator(`[data-testid="post-grid"] a[href="/p/${world.detailPostId}"]`).click();
  await expect(page.locator(MODAL)).toBeVisible();
  return { carousel, modal: JSON.stringify(await motionOf(page, MODAL)) };
}

test('視差効果を減らす設定のとき、動きが 0 秒になる', async ({ browser, world }) => {
  const page = await newScreenPage(browser, {
    world,
    loggedIn: true,
    width: 375,
    reducedMotion: 'reduce',
  });
  const { carousel, modal } = await openCarouselAndModal(page, world);
  expect(JSON.parse(carousel)).toEqual({ transition: '0s', animation: '0s', scroll: 'auto' });
  expect(JSON.parse(modal)).toMatchObject({ transition: '0s', animation: '0s' });
  await page.context().close();
});

test('設定が無いときは動きがある', async ({ browser, world }) => {
  const page = await newScreenPage(browser, {
    world,
    loggedIn: true,
    width: 375,
    reducedMotion: 'no-preference',
  });
  const { carousel, modal } = await openCarouselAndModal(page, world);
  const seconds = (value: string) => Number.parseFloat(value.split(',')[0]!);
  expect(seconds(JSON.parse(carousel).transition)).toBeGreaterThan(0);
  expect(seconds(JSON.parse(modal).transition)).toBeGreaterThan(0);
  await page.context().close();
});
