import { expect, test } from '@playwright/test';

test('トップページを開くと、見出しが見えてコンソールのエラーが 0 件', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});

test('トップページを開いても CSP 違反が出ない', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __cspViolations: string[] };
    w.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      w.__cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
  const messages: string[] = [];
  page.on('console', (message) => {
    if (/content security policy/i.test(message.text())) messages.push(message.text());
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForLoadState('networkidle');

  const violations = await page.evaluate(
    () => (window as unknown as { __cspViolations: string[] }).__cspViolations,
  );
  expect(violations).toEqual([]);
  expect(messages).toEqual([]);
});
