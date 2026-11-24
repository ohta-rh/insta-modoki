import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: 'e2e',
  // e2e/support/**/*.test.ts are vitest unit tests of the helpers, not browser scenarios.
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  // CI keeps an HTML report so a failed run can upload it (ADR-0027).
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // A failed test keeps its trace, locally under test-results/<test>/trace.zip and in CI inside the
  // HTML report; a passing test leaves none (ADR-0027, ADR-0070).
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: '**/seed.spec.ts' },
    // Seeding holds the slot's database busy for about 20 seconds, so it runs after everything else.
    {
      name: 'seed',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/seed.spec.ts',
      dependencies: ['chromium'],
    },
  ],
  webServer: {
    // E2E_HARNESS reaches the Worker only as a wrangler --var (a shell variable does not), and only here.
    // --test-scheduled makes wrangler serve /__scheduled?cron=<expr>, which runs the Worker's `scheduled` (ADR-0049).
    command: 'pnpm start --test-scheduled --var E2E_HARNESS:1 --var APP_ENV:local',
    // `/` redirects to the login screen for a visitor; a public screen answers 200 once the app is up.
    url: `http://localhost:${port}/accounts/signup`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { PORT: String(port) },
  },
});
