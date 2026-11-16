import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 120000,
  workers: 1,
  expect: { timeout: 30000 },
  use: {
    baseURL: process.env.PLIVVI_TEST_URL || 'http://127.0.0.1:4174',
    browserName: 'chromium',
    launchOptions: {
      executablePath:
        process.env.PLIVVI_BROWSER ||
        (process.platform === 'win32'
          ? 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe'
          : undefined),
    },
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: process.env.PLIVVI_TEST_URL
    ? undefined
    : {
        command: 'npm run preview -- --port 4174',
        url: 'http://127.0.0.1:4174',
        reuseExistingServer: !process.env.CI,
        timeout: 30000,
      },
  reporter: [['list'], ['json', { outputFile: 'test-output/browser-results.json' }]],
});
