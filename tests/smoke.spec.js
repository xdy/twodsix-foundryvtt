// Smoke tests for the twodsix system.
// Verifies the system loads, settings work, and no console errors occur.

const { test, expect } = require('@playwright/test');
const { setupTestWorld, shutdownWorld, getConsoleErrors } = require('./helpers');

let page;
const BENIGN_CONSOLE_PATTERNS = [
  /\[object Object\]/,     // Foundry internal serialization
  /Failed to load resource/, // missing optional assets
];

test.describe('twodsix smoke tests', () => {
  test.beforeAll(async ({ browser }) => {
    ({ page } = await setupTestWorld(browser, 'twodsix smoke tests'));
  }, 60000);

  test.afterAll(async () => {
    await shutdownWorld(page);
  });

  test('system loads as twodsix', async () => {
    const systemId = await page.evaluate(() => game.system.id);
    expect(systemId).toBe('twodsix');

    const sidebar = await page.evaluate(() => !!window.ui.sidebar);
    expect(sidebar).toBe(true);
  });

  test('system settings accessible', async () => {
    const ruleset = await page.evaluate(() => game.settings.get('twodsix', 'ruleset'));
    expect(typeof ruleset).toBe('string');
    expect(ruleset.length).toBeGreaterThan(0);

    const displaySettings = await page.evaluate(() => {
      try {
        game.settings.get('twodsix', 'showIcons');
        return true;
      } catch {
        return false;
      }
    });
    expect(displaySettings).toBe(true);
  });

  test('no console errors during tests', async () => {
    const errors = await getConsoleErrors(page);
    const real = errors.filter((msg) =>
      !BENIGN_CONSOLE_PATTERNS.some((pat) => pat.test(msg)),
    );
    if (real.length > 0) {
      console.error('Console errors found:', real);
    }
    expect(real).toHaveLength(0);
  });
});
