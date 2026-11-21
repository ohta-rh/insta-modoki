import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // CI keeps an HTML report so a failed run can upload it (ADR-0027).
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm start',
    // `/` redirects to the login screen for a visitor; a public screen answers 200 once the app is up.
    url: `http://localhost:${port}/accounts/signup`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { PORT: String(port) },
  },
});
