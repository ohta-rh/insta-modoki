import { expect, test } from '@playwright/test';
import { signInViaHarness } from './auth';

test('a harness session signs the browser in', async ({ page }) => {
  const user = await signInViaHarness(page);

  await page.goto('/');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(`a[href="/${user.username}"]`).first()).toBeAttached();
});
