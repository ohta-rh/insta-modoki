import { expect, test } from '@playwright/test';
import { ensureDemoSeed, loginAsDemo } from './support/demo';

// Seeding 300 posts with images takes about 20 seconds, and two workers must not seed at once.
test.describe.configure({ mode: 'serial', timeout: 180_000 });

test.beforeAll(async () => {
  await ensureDemoSeed();
});

test('デモアカウントでログインできる', async ({ page }) => {
  await page.goto('/accounts/login');
  await expect(page.getByRole('main')).toBeVisible();
  await loginAsDemo(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('main')).toBeVisible();
});

test('間違ったパスワードではデモアカウントにログインできない', async ({ page }) => {
  await loginAsDemo(page, 'not-the-demo-password');
  await expect(page.getByText('メールアドレスまたはパスワードが違います')).toBeVisible();
  await expect(page).toHaveURL(/\/accounts\/login$/);
});
