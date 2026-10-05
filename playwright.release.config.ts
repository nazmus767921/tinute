import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: ['app.spec.ts', 'pipeline.spec.ts', 'release.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  reporter: 'list',
  use: {
    baseURL: process.env.TINUTE_BASE_URL ?? 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['iPhone 13'] } },
  ],
  webServer: process.env.TINUTE_BASE_URL
    ? undefined
    : {
        command: 'pnpm preview --host 127.0.0.1',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: false,
      },
});
