import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // CI keeps an HTML report so a failed run can upload it (ADR-0027).
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // CI keeps the trace of a failed test; the HTML report embeds it (open it from the report).
  use: { baseURL: `http://localhost:${port}`, trace: process.env.CI ? 'retain-on-failure' : 'off' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // E2E_HARNESS reaches the Worker only as a wrangler --var (a shell variable does not), and only here.
    command: 'pnpm start --var E2E_HARNESS:1',
    // `/` redirects to the login screen for a visitor; a public screen answers 200 once the app is up.
    url: `http://localhost:${port}/accounts/signup`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { PORT: String(port) },
  },
});
