import { expect, test as base, type Page } from '@playwright/test';
import { test } from './support/auth';
import { expectNoSeriousViolations } from './support/axe';
import { seedFollow, seedUser, userRow } from './support/db';
import { waitForHydration } from './support/hydration';
import { tabTo } from './support/keys';
import { insertStory, insertStoryView, putStoryFiles } from './support/stories';

const HOUR = 3_600_000;

/** A person the signed-in user follows, with one story created `hoursAgo` hours ago. */
function followedWithStory(
  me: string,
  hoursAgo: number,
  seen = false,
): { username: string; storyId: string } {
  const username = `e2e_t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  seedUser(username, `${username}@example.com`, { displayName: '見本の人' });
  seedFollow(userRow(me)!.id as string, userRow(username)!.id as string);
  const story = insertStory({ authorUsername: username, createdAt: Date.now() - hoursAgo * HOUR });
  if (seen) insertStoryView({ storyId: story.id, viewerUsername: me });
  return { username, storyId: story.id };
}

async function openHome(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('main').waitFor();
  await waitForHydration(page);
}

const links = (page: Page) => page.getByTestId('story-tray').getByRole('link');

test('ホームの上部にトレイが出て、未読のあと既読が並ぶ', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const username = await ownUsername(page);
  const c = followedWithStory(username, 3, true);
  const b = followedWithStory(username, 1);
  for (let i = 0; i < 4; i++) followedWithStory(username, 10 + i, true);
  await openHome(page);

  await expect(page.getByRole('navigation', { name: 'ストーリー' })).toBeVisible();
  const first = links(page);
  await expect(first.nth(0)).toHaveAccessibleName('ストーリーを追加');
  await expect(first.nth(0)).toHaveAttribute('href', '/stories/create');
  await expect(first.nth(1)).toHaveAccessibleName(`${b.username}のストーリー（未視聴）`);
  await expect(first.nth(2)).toHaveAccessibleName(`${c.username}のストーリー（視聴済み）`);
  // The tray sits above the feed.
  const trayBox = (await page.getByTestId('story-tray').boundingBox())!;
  const h1Box = await page.getByRole('heading', { name: 'ホーム' }).boundingBox();
  expect(trayBox.y).toBeGreaterThanOrEqual((h1Box?.y ?? 0) - 1);
  // The tray scrolls sideways; the page does not.
  const sizes = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="story-tray"]')!;
    return {
      overflowX: getComputedStyle(el).overflowX,
      trayScrolls: el.scrollWidth > el.clientWidth,
      pageScrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  expect(sizes).toEqual({ overflowX: 'auto', trayScrolls: true, pageScrolls: false });
});

test('キーボードだけでトレイを操作でき、タップ領域が 44px 以上で、axe の重大な違反が 0 件', async ({
  page,
}) => {
  const username = await ownUsername(page);
  const b = followedWithStory(username, 1);
  const c = followedWithStory(username, 2, true);
  await openHome(page);

  const all = links(page);
  const count = await all.count();
  expect(count).toBe(3);
  for (let i = 0; i < count; i++) {
    const box = (await all.nth(i).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
  await expectNoSeriousViolations(page, 'ホームのストーリートレイ');

  await tabTo(page, all.nth(0));
  await page.keyboard.press('Tab');
  await expect(all.nth(1)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(all.nth(2)).toBeFocused();
  await expect(all.nth(1)).toHaveAttribute('href', `/stories/${b.username}`);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/stories/${c.username}$`));
});

test('項目を開くと並びを storyQueue に保存する', async ({ page }) => {
  const username = await ownUsername(page);
  const b = followedWithStory(username, 1);
  const c = followedWithStory(username, 2);
  const d = followedWithStory(username, 3);
  await openHome(page);

  await page.getByRole('link', { name: `${c.username}のストーリー（未視聴）` }).click();
  await expect(page).toHaveURL(new RegExp(`/stories/${c.username}$`));
  const saved = await page.evaluate(() => sessionStorage.getItem('storyQueue'));
  expect(JSON.parse(saved!)).toEqual([b.username, c.username, d.username]);
});

test('ビューアを閉じるとトレイが読み込み直さずに視聴済みの並びに変わる', async ({ page }) => {
  const me = await ownUsername(page);
  for (const how of ['Escape', 'button'] as const) {
    // A: two stories (newest person); C: two stories, only the first gets seen.
    const people: { username: string; storyIds: string[] }[] = [];
    for (const hoursAgo of [1, 2]) {
      const username = `e2e_t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      seedUser(username, `${username}@example.com`, { displayName: '見本の人' });
      seedFollow(userRow(me)!.id as string, userRow(username)!.id as string);
      const storyIds: string[] = [];
      for (let i = 0; i < 2; i++) {
        const story = insertStory({
          authorUsername: username,
          createdAt: Date.now() - hoursAgo * HOUR + i * 1000,
        });
        await putStoryFiles(page, story);
        storyIds.push(story.id);
      }
      people.push({ username, storyIds });
    }
    const [a, c] = people as [(typeof people)[0], (typeof people)[0]];
    await openHome(page);
    const unseen = (u: string) => page.getByRole('link', { name: `${u}のストーリー（未視聴）` });
    await expect(links(page).nth(1)).toHaveAccessibleName(`${a.username}のストーリー（未視聴）`);
    await expect(links(page).nth(2)).toHaveAccessibleName(`${c.username}のストーリー（未視聴）`);

    await unseen(a.username).click();
    const viewerA = page.getByRole('dialog', { name: `${a.username}のストーリー` });
    await expect(viewerA).toBeVisible();
    const position = page.locator('[aria-live="polite"]', { hasText: /ストーリー \d+ \/ \d+/ });
    await expect(position).toHaveText('ストーリー 1 / 2');
    await page.keyboard.press('ArrowRight');
    await expect(position).toHaveText('ストーリー 2 / 2');
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(new RegExp(`/stories/${c.username}$`));
    await expect(page.getByRole('dialog', { name: `${c.username}のストーリー` })).toBeVisible();
    await expect(position).toHaveText('ストーリー 1 / 2');

    if (how === 'Escape') await page.keyboard.press('Escape');
    else await page.getByRole('button', { name: '閉じる' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // No reload: the tray itself is redrawn.
    await expect(links(page).nth(1)).toHaveAccessibleName(`${c.username}のストーリー（未視聴）`);
    await expect(links(page).nth(2)).toHaveAccessibleName(`${a.username}のストーリー（視聴済み）`);
  }
});

base.describe('視差効果を減らす', () => {
  base.use({ reducedMotion: 'reduce' });
  test('視差効果を減らす設定でリングが動かない', async ({ page }) => {
    const username = await ownUsername(page);
    followedWithStory(username, 1);
    await openHome(page);
    const item = links(page).nth(1);
    await item.hover();
    const ring = item.locator('span[aria-hidden="true"]').first();
    const style = await ring.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { transform: cs.transform, duration: cs.transitionDuration };
    });
    expect(style).toEqual({ transform: 'none', duration: '0s' });
  });
});

/** The username of the signed-in user, read from the profile link in the navigation. */
async function ownUsername(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('main').waitFor();
  const href = await page.getByRole('link', { name: 'プロフィール' }).first().getAttribute('href');
  return href!.slice(1);
}
