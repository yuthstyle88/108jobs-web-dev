import { defineConfig, devices } from '@playwright/test';

// The port the dev server under test listens on. It is overridable because
// 3001 is not free everywhere: the self-hosted CI runner carries a long-lived
// listener on 127.0.0.1:3001 owned by another user, so the webServer died with
// EADDRINUSE and killing the port did not help — an unprivileged `lsof`/`fuser`
// cannot even see that process, which is why the workflow's "free the port"
// step reported the port idle two seconds before the bind failed. CI picks a
// genuinely free port and passes it in here instead of fighting for this one.
const port = Number(process.env.E2E_PORT ?? 3001);
const baseURL = process.env.E2E_BASE_URL || `http://localhost:${port}`;

// See https://playwright.dev/docs/test-configuration
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // A PRODUCTION build, never `next dev`. Under dev the destination of a
  // post-login redirect is compiled on demand, and that compile ran past the
  // specs' 15s waitForURL budget on CI -- so the three "lands authenticated"
  // specs failed while the app was working correctly (the failure snapshot
  // showed the redirect already done and the Next overlay still "Compiling").
  // It presented as flakiness: identical code went 10/10 green on #13's PR run
  // and red on the push run 90 seconds later. Against a build, the same 12
  // specs pass in ~1.2 min with no retries.
  //
  // `npm run build` needs API_INTERNAL_URL (next.config.ts fails closed rather
  // than defaulting to the staging backend) and inlines every NEXT_PUBLIC_* at
  // build time, so both live in the workflow job's `env:`, not just the run step.
  webServer: {
    command: `npm run build && PORT=${port} npm run start`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // You can enable more browsers as needed
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
