// @ts-check
const { devices } = require('@playwright/test');

/**
 * @see https://playwright.dev/docs/test-configuration
 * @type {import('@playwright/test').PlaywrightTestConfig}
 */
const config = {
  testDir: './tests',
  timeout: 60 * 1000,
  expect: {
    timeout: 5000,
  },
  forbidOnly: true,
  retries: 0,
  // Test helpers currently use one shared Foundry world/GM session.
  // Running spec files in parallel causes join/setup contention and early failures.
  workers: 1,
  reporter: 'html',
  use: {
    actionTimeout: 0,
    trace: 'on',
    headless: false,
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 },
    screenshot: 'only-on-failure',
  },
  snapshotPathTemplate: '{testDir}/snapshots/{testFilePath}/{arg}{ext}',
  projects: [
    {
      name: 'smoke',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: 'smoke.spec.js',
    },
    {
      name: 'main',
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: ['dice.spec.js', 'actors.spec.js', 'items.spec.js', 'sheets.spec.js', 'perf.spec.js', 'trader.spec.js', 'chargen-random.spec.js'],
      dependencies: ['smoke'],
    },
  ],
  outputDir: 'test-results/',
};

module.exports = config;
