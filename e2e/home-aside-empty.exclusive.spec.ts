import type { Page } from '@playwright/test';
import { freshUser as test, expect } from './support/auth';
import { withDb } from './support/db';
import { waitForHydration } from './support/hydration';

const aside = (page: Page) => page.locator('aside[aria-label="おすすめ"]');
const home = async (page: Page, width: number) => {
  await page.setViewportSize({ width, height: 800 });
  await page.goto('/');
  await waitForHydration(page);
};

// Follows every user in the database, so it runs in the exclusive project, last and alone (ADR-0073).
test('候補がいなければおすすめの見出しを出さない', async ({ page, me }) => {
  // Follow everyone who exists, then look; a user another worker adds in between is followed on the retry.
  await expect(async () => {
    withDb((db) =>
      db
        .prepare(
          'INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) SELECT (SELECT id FROM users WHERE username = ?1), id, 1 FROM users WHERE username <> ?1',
        )
        .run(me.username),
    );
    await home(page, 1280);
    await expect(aside(page)).toBeVisible();
    await expect(aside(page).getByRole('heading', { name: 'おすすめ' })).toHaveCount(0);
  }).toPass();
  await expect(aside(page).getByRole('listitem')).toHaveCount(0);
  await expect(aside(page).getByRole('link', { name: new RegExp(me.username) })).toBeVisible();
  await expect(aside(page).locator('footer')).toBeVisible();
});
