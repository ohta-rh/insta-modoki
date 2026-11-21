import type { Page } from '@playwright/test';

/** Waits until React has hydrated the page (the root layout's marker sets `html[data-hydrated="1"]`). */
export async function waitForHydration(page: Page): Promise<void> {
  await page.locator('html[data-hydrated="1"]').waitFor({ state: 'attached' });
}
