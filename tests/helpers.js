// Shared Playwright helpers for testing twodsix-foundryvtt.
// Pattern adapted from JiDW's foundryvtt-dice-so-nice-tests.

const FOUNDRY_URL = 'http://localhost:30000';
const WORLD_TITLE = 'twodsix-playwright-test';
const SYSTEM_ID = 'twodsix';
const DEFAULT_BENIGN_CONSOLE_PATTERNS = [
  /\[object Object]/,
  /Failed to load resource/,
];

// Retry / timing constants.
const MAX_USER_SELECT_RETRIES = 8;
const MAX_JOIN_ATTEMPTS = 3;
const WAIT_MS_AFTER_WORLD_READY = 1000;
const WAIT_MS_AFTER_TOUR_DISMISS = 200;
const WAIT_MS_BEFORE_SHUTDOWN = 1000;

/**
 * Register before/after hooks that create and tear down a shared world page.
 * Returns a getter to avoid reading page before beforeAll has completed.
 *
 * @param {import('@playwright/test').TestType<any, any>} testApi
 * @param {{ label?: string, timeout?: number }} [options]
 * @returns {() => import('@playwright/test').Page}
 */
function registerWorldHooks(testApi, options = {}) {
  const { label = '', timeout = 60000 } = options;
  let page;

  testApi.beforeAll(async ({ browser }) => {
    ({ page } = await setupTestWorld(browser, label));
  }, timeout);

  testApi.afterAll(async () => {
    await shutdownWorld(page);
  });

  return () => {
    if (!page) {
      throw new Error('Test world page is not initialized yet.');
    }
    return page;
  };
}
/**
 * Standard setup fixture for all spec files. Creates browser context + page,
 * joins the twodsix test world, and wires up teardown.
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {string} [label] - test suite name, posted as chat message in-world
 * @returns {Promise<{ page: import('@playwright/test').Page }>}
 */
async function setupTestWorld(browser, label = '') {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  await initializeTwodsixWorld(page, label);
  return { page };
}

/**
 * Navigate to the Foundry setup page, select (or create) the twodsix test world,
 * authenticate as the first GM user, and wait for full readiness.
 *
 * Stores console errors on window.__twodsix_consoleErrors for later inspection.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} [label] - test suite name, posted as chat message in-world
 */
async function initializeTwodsixWorld(page, label = '') {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      page.evaluate((errMsg) => {
        window.__twodsix_consoleErrors = window.__twodsix_consoleErrors || [];
        window.__twodsix_consoleErrors.push(errMsg);
      }, msg.text());
    }
  });

  await page.goto(FOUNDRY_URL + '/setup', { waitUntil: 'networkidle' });
  await dismissTourIfVisible(page);

  if (page.url().startsWith(FOUNDRY_URL + '/setup')) {
    const worldLink = page.locator(`[data-package-id="${WORLD_TITLE}"] a.play`);

    if (await worldLink.count() > 0) {
      await Promise.all([
        page.waitForNavigation(),
        worldLink.dispatchEvent('click'),
      ]);
      // Wait for the join page DOM to settle after navigation.
      await page.waitForLoadState('domcontentloaded');
      await dismissTourIfVisible(page);
    } else {
      await dismissTourIfVisible(page);
      await page.locator('button:has-text("Create World")').click({ force: true });
      await page.locator('input[name="title"]').fill(WORLD_TITLE);

      await selectSystemForWorldCreation(page, SYSTEM_ID);

      await submitWorldCreation(page);
    }
  }

  const alreadyInWorld = await page.evaluate(() => {
    return !!(window.game && window.game.ready && window.game.system?.id === 'twodsix');
  }).catch(() => false);

  if (!alreadyInWorld) {
    await selectFirstAvailableUser(page);

    let isReady = false;
    for (let attempt = 0; attempt < MAX_JOIN_ATTEMPTS && !isReady; attempt++) {
      await page.locator('button:has-text("Join Game Session")').click({ force: true });

      isReady = await page.waitForFunction(
        (expectedSystem) => {
          if (!window.game || !window.game.ready) {
            return false;
          }
          return window.game.system.id === expectedSystem;
        },
        SYSTEM_ID,
        { timeout: 20000 },
      ).then(() => true).catch(() => false);

      if (!isReady) {
        await selectFirstAvailableUser(page);
      }
    }

    if (!isReady) {
      throw new Error('Failed to enter the twodsix world after multiple join attempts.');
    }
  }

  await page.waitForTimeout(WAIT_MS_AFTER_WORLD_READY);

  await dismissTourIfVisible(page);

  await page.evaluate(() => {
    if (window.ui?.sidebar?.expand) {
      window.ui.sidebar.expand();
    }
  });

  if (label) {
    await page.evaluate(async (text) => {
      await ChatMessage.create({ content: `[test] ${text}` });
    }, label);
  }
}

/**
 * Select the first enabled user on the Join Game page.
 * Retries to handle temporary "current players full" state between spec files.
 *
 * @param {import('@playwright/test').Page} page
 */
async function selectFirstAvailableUser(page) {
  await dismissTourIfVisible(page);

  // selectOption({ index: 1 }) picks the first non-empty <option> and
  // handles all waiting internally — no manual visibility check needed.
  for (let attempt = 0; attempt < MAX_USER_SELECT_RETRIES; attempt++) {
    try {
      await page.locator('select[name="userid"]').first().selectOption({ index: 1 });
      return;
    } catch (e) {
      console.warn(`[twodsix test] selectFirstAvailableUser attempt ${attempt + 1}/${MAX_USER_SELECT_RETRIES} failed:`, e.message);
    }

    await page.waitForTimeout(1000);
    try {
      await page.reload({ waitUntil: 'networkidle' });
    } catch (e) {
      console.warn('[twodsix test] selectFirstAvailableUser: page reload failed, continuing...', e.message);
    }
    await dismissTourIfVisible(page);
  }

  throw new Error('Could not select a user on the Join Game screen after multiple attempts.');
}

/**
 * Select the requested system in world creation across Foundry UI variants.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} systemId
 */
async function selectSystemForWorldCreation(page, systemId) {
  const systemSelect = page.locator('select[name="system"]');
  const hasLegacySystemSelect = await systemSelect.isVisible().catch(() => false);
  if (hasLegacySystemSelect) {
    await systemSelect.selectOption(systemId);
    return;
  }

  const systemCardById = page.locator(`[data-package-id="${systemId}"]`).first();
  const hasSystemCardById = await systemCardById.isVisible().catch(() => false);
  if (hasSystemCardById) {
    await systemCardById.click({ force: true });
    return;
  }

  const twodsixCardByText = page
    .locator('[data-package-id], [role="listitem"], li')
    .filter({ hasText: /twodsix/i })
    .first();
  const hasTwodsixCardByText = await twodsixCardByText.isVisible().catch(() => false);
  if (hasTwodsixCardByText) {
    await twodsixCardByText.click({ force: true });
    return;
  }

  throw new Error(`Could not find a selectable system control for "${systemId}" during world creation.`);
}

/**
 * Submit world creation across Foundry UI variants and wait until join controls are ready.
 *
 * @param {import('@playwright/test').Page} page
 */
async function submitWorldCreation(page) {
  const submitButton = page
    .locator('button:has-text("Continue"), button:has-text("Create World")')
    .first();

  await submitButton.click({ force: true });

  // User Management screen appears first — must click "Save and Continue" before
  // we reach the Join Game screen where user select is ready.
  const saveUsersButton = page.locator('button:has-text("Save and Continue")').first();
  const hasSaveUsers = await saveUsersButton.isVisible({ timeout: 3000 }).catch(() => false);
  if (hasSaveUsers) {
    await saveUsersButton.click({ force: true });
  }

  const userSelect = page.locator('select[name="userid"]').first();
  await userSelect.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Close a Foundry guided tour if one is visible after world startup.
 * Keeps tests resilient when Foundry onboarding tours auto-open.
 *
 * @param {import('@playwright/test').Page} page
 */
async function dismissTourIfVisible(page) {
  const hasVisibleTour = await page
    .locator('aside.tour-center-step, aside.tour, .tour-overlay')
    .first()
    .isVisible({ timeout: 1500 })
    .catch(() => false);

  if (!hasVisibleTour) {
    return;
  }

  const closeSelectors = [
    'a.step-button[data-action="exit"]',
    'button.step-button[data-action="exit"]',
    '[data-action="exit"]',
    '[data-action="skip"]',
    '[data-action="close"]',
  ];

  // Try each close control selector in order
  for (const selector of closeSelectors) {
    const control = page.locator(selector).first();
    try {
      const isVisible = await control.isVisible();
      if (isVisible) {
        await control.click({ force: true });
        break;
      }
    } catch {
      // Control was detached or hidden between check and click — try next selector
    }
  }

  // Dismiss via keyboard as a secondary approach (only works on some tours)
  try {
    await page.keyboard.press('Escape');
  } catch (e) {
    console.warn('[twodsix test] dismissTour: Escape key failed:', e.message);
  }

  // Dismiss via Foundry tours API (only works in-world, not on setup page)
  try {
    await page.evaluate(async () => {
      const activeTours = game?.tours?.activeTours;
      if (!(activeTours instanceof Map)) return;
      for (const tour of activeTours.values()) {
        if (typeof tour?.exit === 'function') {
          await tour.exit();
        }
      }
    });
  } catch (e) {
    console.warn('[twodsix test] dismissTour: Tours API failed:', e.message);
  }

  // Brief stabilization wait after tour dismissal
  await page.waitForTimeout(WAIT_MS_AFTER_TOUR_DISMISS);
}

/**
 * Create a document (Actor or Item) via the Foundry API inside the browser context.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'Actor' | 'Item'} cls - Foundry document class name
 * @param {string} name
 * @param {string} type
 * @param {object} [data] - additional system data overrides
 * @returns {Promise<string>} the created document's ID
 */
async function createDocument(page, cls, name, type, data = {}) {
  return page.evaluate(
    async ({ cls, name, type, data }) => {
      const ctor = cls === 'Actor' ? Actor : Item;
      const doc = await ctor.create({ name, type, system: data });
      if (!doc || !doc.id) {
        throw new Error(`${cls} create returned ${doc} for name="${name}" type="${type}"`);
      }
      return doc.id;
    },
    { cls, name, type, data },
  );
}

/**
 * Create a test actor via the Foundry API inside the browser context.
 */
async function createTestActor(page, name, type, data = {}) {
  return createDocument(page, 'Actor', name, type, data);
}

/**
 * Create a test item via the Foundry API inside the browser context.
 */
async function createTestItem(page, name, type, data = {}) {
  return createDocument(page, 'Item', name, type, data);
}

/**
 * Return collected console errors from window storage.
 * Call after tests to assert no errors.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<string[]>}
 */
async function getConsoleErrors(page) {
  return page.evaluate(() => window.__twodsix_consoleErrors || []);
}

/**
 * Filter out known-benign console errors.
 *
 * @param {string[]} errors
 * @param {RegExp[]} [benignPatterns]
 * @returns {string[]}
 */
function filterConsoleErrors(errors, benignPatterns = DEFAULT_BENIGN_CONSOLE_PATTERNS) {
  return errors.filter((msg) => !benignPatterns.some((pattern) => pattern.test(msg)));
}

/**
 * Assert there are no non-benign console errors.
 *
 * @param {import('@playwright/test').Page} page
 * @param {RegExp[]} [benignPatterns]
 */
async function assertNoConsoleErrors(page, benignPatterns = DEFAULT_BENIGN_CONSOLE_PATTERNS) {
  const errors = await getConsoleErrors(page);
  const realErrors = filterConsoleErrors(errors, benignPatterns);
  if (realErrors.length > 0) {
    throw new Error(`Console errors found:\n${realErrors.join('\n')}`);
  }
}

/**
 * Small UI stabilization delay used after actions that trigger renders.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} [ms]
 */
async function uiPause(page, ms = 500) {
  await page.waitForTimeout(ms);
}

/**
 * Wait for a selector text to appear and then disappear (e.g. Undoing states).
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} options
 * @param {string} options.selector
 * @param {string} options.text
 * @param {number} [options.appearTimeout]
 * @param {number} [options.disappearTimeout]
 */
async function waitForTextCycle(page, {
  selector,
  text,
  appearTimeout = 10000,
  disappearTimeout = 30000,
}) {
  await page.waitForFunction(
    ({ selector, text }) => {
      const el = document.querySelector(selector);
      return el && el.textContent.includes(text);
    },
    { selector, text },
    { timeout: appearTimeout },
  );

  await page.waitForFunction(
    ({ selector, text }) => {
      const el = document.querySelector(selector);
      return !el || !el.textContent.includes(text);
    },
    { selector, text },
    { timeout: disappearTimeout },
  );
}

/**
 * Create one item of every twodsix item type and return their IDs and types.
 * Uses minimal but valid system data for each type.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array<{ id: string, type: string }>>}
 */
async function createAllItemTypes(page) {
  return page.evaluate(async () => {
    const itemDefs = [
      { name: 'Test Weapon', type: 'weapon', system: { damage: '3d6', range: '100m', weaponType: 'ranged' } },
      { name: 'Test Armor', type: 'armor', system: { armor: 5 } },
      { name: 'Test Equipment', type: 'equipment', system: { weight: 2.5 } },
      { name: 'Test Consumable', type: 'consumable', system: { currentCount: 3 } },
      { name: 'Test Skill', type: 'skills', system: { value: 1 } },
      { name: 'Test Trait', type: 'trait', system: {} },
      { name: 'Test Augment', type: 'augment', system: {} },
      { name: 'Test Component', type: 'component', system: {} },
      { name: 'Test Computer', type: 'computer', system: {} },
      { name: 'Test Spell', type: 'spell', system: {} },
      { name: 'Test PsiAbility', type: 'psiAbility', system: {} },
      { name: 'Test Tool', type: 'tool', system: {} },
      { name: 'Test Storage', type: 'storage', system: {} },
      { name: 'Test Junk', type: 'junk', system: {} },
      { name: 'Test ShipPosition', type: 'ship_position', system: {} },
      { name: 'Test Career', type: 'career', system: {} },
      { name: 'Test Species', type: 'species', system: {} },
    ];

    const results = [];
    for (const def of itemDefs) {
      const doc = await Item.create(def);
      results.push({ id: doc.id, type: doc.type });
    }
    return results;
  });
}

/**
 * Create one actor of every twodsix actor type and return their IDs and types.
 * Uses minimal but valid system data for each type.
 *
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array<{ id: string, type: string }>>}
 */
async function createAllActorTypes(page) {
  return page.evaluate(async () => {
    const actorDefs = [
      { name: 'Test Traveller', type: 'traveller', system: {} },
      {
        name: 'Test Ship',
        type: 'ship',
        system: {
          shipStats: {
            hull: { value: 40, max: 40, min: 0 },
            fuel: { value: 100, max: 100, min: 0 },
            power: { value: 60, max: 60, min: 0 },
          },
        },
      },
      { name: 'Test Vehicle', type: 'vehicle', system: {} },
      { name: 'Test SpaceObject', type: 'space-object', system: {} },
      { name: 'Test World', type: 'world', system: {} },
      { name: 'Test Animal', type: 'animal', system: {} },
      { name: 'Test Robot', type: 'robot', system: {} },
    ];

    const results = [];
    for (const def of actorDefs) {
      const doc = await Actor.create(def);
      results.push({ id: doc.id, type: doc.type });
    }
    return results;
  });
}

/**
 * Gracefully shut down the Foundry world and close the page.
 */
async function shutdownWorld(page) {
  if (!page) {
    return;
  }

  try {
    await page.evaluate(async () => {
      if (game && typeof game.shutDown === 'function') {
        await game.shutDown();
      }
    });
  } catch (e) {
    console.warn('[twodsix test] shutdownWorld: game.shutDown failed:', e.message);
  }

  // Give Foundry server time to fully release the world session.
  await page.waitForTimeout(WAIT_MS_BEFORE_SHUTDOWN);

  try {
    await page.close();
  } catch (e) {
    console.warn('[twodsix test] shutdownWorld: page.close failed:', e.message);
  }
}

module.exports = {
  setupTestWorld,
  registerWorldHooks,
  initializeTwodsixWorld,
  createTestActor,
  createTestItem,
  getConsoleErrors,
  filterConsoleErrors,
  assertNoConsoleErrors,
  shutdownWorld,
  uiPause,
  waitForTextCycle,
  createAllItemTypes,
  createAllActorTypes,
  DEFAULT_BENIGN_CONSOLE_PATTERNS,
};
