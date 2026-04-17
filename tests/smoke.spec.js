// Smoke tests for the twodsix system.
// Verifies the system loads, settings work, and no console errors occur.

const { test, expect } = require('@playwright/test');
const { registerWorldHooks, assertNoConsoleErrors } = require('./helpers');

test.describe('twodsix smoke tests', () => {
  const getPage = registerWorldHooks(test, { label: 'twodsix smoke tests', timeout: 60000 });

  test('system loads as twodsix', async () => {
    const page = getPage();
    const systemId = await page.evaluate(() => game.system.id);
    expect(systemId).toBe('twodsix');

    const sidebar = await page.evaluate(() => !!window.ui.sidebar);
    expect(sidebar).toBe(true);
  });

  test('system settings accessible', async () => {
    const page = getPage();
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
    const page = getPage();
    await assertNoConsoleErrors(page);
  });
});
