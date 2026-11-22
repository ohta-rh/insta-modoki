import { expect, test as base, type Page } from '@playwright/test';
import { signUpViaUi } from './support/auth';
import { expectNoSeriousViolations } from './support/axe';
import { seedUser, userRow } from './support/db';
import { harness } from './support/harness';
import { waitForHydration } from './support/hydration';

const LINK = '通知（未読 1 件）';
const WIDTHS = [
  { width: 1280, height: 800, nav: 'side' },
  { width: 375, height: 800, nav: 'bottom' },
] as const;

/** A new user with one unread notification, on `/` with the badge shown. */
async function withUnread(page: Page): Promise<void> {
  const me = await signUpViaUi(page);
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const actor = `e2e_b${stamp}`;
  seedUser(actor, `${actor}@example.com`);
  harness({
    op: 'seedNotification',
    recipientId: userRow(me.username)!.id as string,
    actorId: userRow(actor)!.id as string,
    type: 'follow',
    createdAt: Date.now() - 60_000,
  });
  await page.goto('/');
  await waitForHydration(page);
  await expect(
    page.locator('nav[data-nav="side"]').getByRole('link', { name: LINK, exact: true }),
  ).toBeAttached({ timeout: 15_000 });
}

const navOf = (page: Page, kind: 'side' | 'bottom') => page.locator(`nav[data-nav="${kind}"]`);

base('未読があるときナビの通知のリンクに axe の重大な違反が無い', async ({ page }) => {
  base.setTimeout(90_000);
  await withUnread(page);
  for (const { width, height, nav } of WIDTHS) {
    await page.setViewportSize({ width, height });
    await expect(navOf(page, nav).getByRole('link', { name: LINK, exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expectNoSeriousViolations(page, `/ ${width}px`);
  }
});

base('未読の数は通知のリンクの名前だけで読み上げ、バッジの数字は見えている', async ({ page }) => {
  base.setTimeout(90_000);
  await withUnread(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  const nav = navOf(page, 'side');
  await expect(nav.getByRole('link', { name: LINK, exact: true })).toBeVisible();
  await expect(nav.getByTestId('notification-badge')).toHaveText('1');
  const tree = await nav.ariaSnapshot();
  expect(tree).toContain(`link "${LINK}"`);
  expect(tree).not.toMatch(/text: 1\b/);
  expect(tree).not.toContain('（未読 1 件）\n');
  expect(tree.match(/（未読 1 件）/g)).toHaveLength(1);
});

// Opening the notifications screen marks them read, so each width gets its own user.
for (const { width, height, nav } of WIDTHS) {
  base(`バッジの上を押しても通知の画面に移る（${width}px）`, async ({ page }) => {
    base.setTimeout(90_000);
    await withUnread(page);
    await page.setViewportSize({ width, height });
    const badge = navOf(page, nav).getByTestId('notification-badge');
    await expect(badge).toBeVisible({ timeout: 15_000 });
    const box = (await badge.boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page).toHaveURL(/\/notifications$/);
  });
}

base('バッジは通知のリンクの上の今と同じ場所に出る', async ({ page }) => {
  base.setTimeout(90_000);
  await withUnread(page);
  for (const { width, height, nav } of WIDTHS) {
    await page.setViewportSize({ width, height });
    const n = navOf(page, nav);
    const badge = (await n.getByTestId('notification-badge').boundingBox())!;
    const link = (await n.getByRole('link', { name: LINK, exact: true }).boundingBox())!;
    expect(badge.x).toBeGreaterThanOrEqual(link.x);
    expect(badge.y).toBeGreaterThanOrEqual(link.y);
    expect(badge.x + badge.width).toBeLessThanOrEqual(link.x + link.width);
    expect(badge.y + badge.height).toBeLessThanOrEqual(link.y + link.height);
  }
});
