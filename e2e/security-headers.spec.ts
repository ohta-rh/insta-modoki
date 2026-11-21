import { expect, test, type Response } from '@playwright/test';

const HEADERS = [
  'content-security-policy',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
];

function expectSecurityHeaders(response: Response, label: string): void {
  const headers = response.headers();
  for (const name of HEADERS) {
    expect(headers[name], `${label}: ${name}`).toBeTruthy();
  }
  // one CSP header only: a repeated header would be joined with ", " by Playwright
  const csp = headers['content-security-policy'] ?? '';
  expect(csp.match(/default-src/g), `${label}: CSP once`).toHaveLength(1);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
}

test('トップページと 404 と静的ファイルの全ての応答に 4 つのヘッダーが付く', async ({ page }) => {
  const staticResponses: Response[] = [];
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.startsWith('/_next/static/')) {
      staticResponses.push(response);
    }
  });

  const top = await page.goto('/');
  expect(top?.status()).toBe(200);
  expectSecurityHeaders(top!, 'top');
  await page.waitForLoadState('networkidle');

  const missing = await page.goto('/this-page-does-not-exist');
  expect(missing?.status()).toBe(404);
  expectSecurityHeaders(missing!, '404');

  expect(staticResponses.length).toBeGreaterThan(0);
  expectSecurityHeaders(staticResponses[0]!, 'static');
});

test('外部のスクリプトとインラインのスクリプトを差し込んでも実行されない', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const result = await page.evaluate(async () => {
    const w = window as unknown as { __pwned?: number };
    let violations = 0;
    document.addEventListener('securitypolicyviolation', () => {
      violations += 1;
    });
    const external = document.createElement('script');
    external.src = 'https://example.invalid/x.js';
    document.body.append(external);
    const inline = document.createElement('script');
    inline.textContent = 'window.__pwned = 1';
    document.body.append(inline);
    const deadline = Date.now() + 5000;
    while (violations < 2 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return { pwned: w.__pwned, violations };
  });

  expect(result.pwned).toBeUndefined();
  expect(result.violations).toBeGreaterThanOrEqual(2);
});
