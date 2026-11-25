import { expect } from '@playwright/test';
import { signedIn as test } from './support/auth';
import { waitForHydration } from './support/hydration';
import { styles, VIEWPORTS } from './support/measure';

const FONT_FAMILY =
  '-apple-system, system-ui, "Segoe UI", Roboto, Helvetica, Arial, "Noto Sans JP", sans-serif';

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test(`本文は 14px/18px の黒で、html の文字の大きさは 16px のまま（${name} ${viewport.width}px）`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await waitForHydration(page);
    const body = await styles(page.locator('body'), [
      'font-size',
      'line-height',
      'color',
      'font-family',
    ]);
    expect(body['font-size']).toBe('14px');
    expect(body['line-height']).toBe('18px');
    expect(body['color']).toBe('rgb(0, 0, 0)');
    expect(body['font-family']).toBe(FONT_FAMILY);
    const html = await styles(page.locator('html'), ['font-size']);
    expect(html['font-size']).toBe('16px');
  });
}

test('エラーの文は #D62D3C で表示される', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.wide);
  await page.goto(`/explore/search?q=${'a'.repeat(31)}`);
  await waitForHydration(page);
  const alert = page.getByRole('alert').filter({ hasText: /\S/ });
  await expect(alert).toBeVisible();
  expect((await styles(alert, ['color']))['color']).toBe('rgb(214, 45, 60)');
});
