const { test, expect } = require('@playwright/test');
const {
  registerWorldHooks,
  assertNoConsoleErrors,
} = require('./helpers');
const {
  enableTraderSettings,
  openTraderFlow,
  selectWorldSource,
  completeTravellerMapSetup,
  completeLocalSetup,
  confirmCrewSetup,
  waitForTraderApp,
  runTillBankrupt,
  stopRollAfterDay,
  getBankruptcyOutcomeText,
  closeTraderApp,
  readLatestTraderJournal,
  getEnabledTraderRulesets,
  closeAllApps,
} = require('./helpers.trader');

/**
 * Post a chat message announcing which ruleset is under test.
 * @param {import('@playwright/test').Page} page
 * @param {string} ruleset
 */
async function announceRulesetInChat(page, ruleset) {
  await page.evaluate((rs) => {
    ChatMessage.create({ content: `Testing trader bankruptcy with ruleset: **${rs}**` });
  }, ruleset);
}

/**
 * Click a trader-app button via evaluate, then wait for undo processing to finish.
 *
 * After undo, the "Undoing..." span is shown briefly and then the app re-renders.
 * This waits for the undo flag on the app instance to clear, which means the new
 * render with stable buttons is visible.
 *
 * @param {import('@playwright/test').Page} page
 */
async function undoAndWaitStable(page) {
  // Click undo via evaluate (avoids locator detachment during re-render).
  await page.evaluate(() => {
    const btn = document.querySelector('#trader .st-undo');
    if (btn) {
      btn.click();
    }
  });

  // After undo, the app renders "Undoing...", then replays decisions.
  // During replay _undoInProgress stays true and no renders happen, so we
  // can't poll the internal flag.  Instead wait for the undo button to
  // reappear, which means the replay finished and a fresh render is done.
  await page.waitForSelector('#trader .st-undo', { state: 'visible', timeout: 60000 });
}

/**
 * Poll for the latest trader journal to contain the repossession text.
 * Much faster than a hardcoded 5-second sleep; returns as soon as the journal
 * flush is complete (typically well under 1 second).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} ruleset
 * @param {number} [timeoutMs=8000]
 * @returns {Promise<object|null>}
 */
async function pollForJournalWithRepossession(page, ruleset, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const data = await readLatestTraderJournal(page);
    if (data?.textContent?.includes('The bank has repossessed the ship. Game over...')) {
      return data;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  // One last attempt, return whatever we have
  return readLatestTraderJournal(page);
}

/**
 * Shared assertions run after each ruleset reaches bankruptcy.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} traderApp
 * @param {string} ruleset
 */
async function verifyBankruptcyOutcomeAndJournal(page, traderApp, ruleset) {
  const outcomeText = await getBankruptcyOutcomeText(page, traderApp);
  expect(outcomeText, `Wrong bankruptcy outcome for ruleset ${ruleset}`).toContain(
    'Bankrupt. The ship has been repossessed.',
  );

  await assertNoConsoleErrors(page);

  // Flush any pending trader save so the journal flag is up-to-date, then poll
  // for the journal write to land (debounced saves + serialized journal appends).
  await page.evaluate(() => {
    const app = Object.values(ui.windows || {}).find((w) => w.id === 'trader');
    if (app?.flushSave) {
      return app.flushSave();
    }
  });

  const journalData = await pollForJournalWithRepossession(page, ruleset);

  expect(journalData, `No trader journal for ruleset ${ruleset}`).not.toBeNull();
  expect(
    journalData.textContent,
    `Missing 'repossessed' in journal for ruleset ${ruleset}`,
  ).toContain('The bank has repossessed the ship. Game over...');

  const state = journalData.tradeState;
  expect(state, `Missing tradeState flag for ruleset ${ruleset}`).not.toBeNull();

  // Cross-check journal state against the live app state
  const appState = await page.evaluate(() => {
    const app = Object.values(ui.windows || {}).find((w) => w.id === 'trader');
    if (!app?.state) {
      return null;
    }
    return {
      gameDate: app.state.gameDate,
      currentWorldName: app.state.currentWorldName,
      credits: app.state.credits,
    };
  });
  if (appState) {
    expect(state.gameDate, `gameDate mismatch for ruleset ${ruleset}`).toBe(appState.gameDate);
    expect(state.currentWorldName, `currentWorldName mismatch for ruleset ${ruleset}`).toBe(appState.currentWorldName);
    expect(state.credits, `credits mismatch for ruleset ${ruleset}`).toBe(appState.credits);
  }
}

test.describe('twodsix trader bankruptcy', () => {
  const getPage = registerWorldHooks(test, {
    label: 'trader bankruptcy test',
    timeout: 600000,
  });

  test('full bankruptcy flow via TravellerMap with undo + random', async () => {
    test.setTimeout(600000);
    const page = getPage();

    await enableTraderSettings(page);
    await closeAllApps(page);
    await announceRulesetInChat(page, 'CEL');

    const worldSourceDialog = await openTraderFlow(page);
    await selectWorldSource(worldSourceDialog, 'travellermap');

    await completeTravellerMapSetup(page, 'CEL');

    await confirmCrewSetup(page);

    const traderApp = await waitForTraderApp(page);

    await page.locator('#trader .st-roll-till-bankrupt').click({ force: true });
    const stopDay = await stopRollAfterDay(page, 5);

    // Exercise undo twice, then random roll
    await undoAndWaitStable(page);
    await undoAndWaitStable(page);

    await page.evaluate(() => {
      const randBtn = document.querySelector('#trader .st-rand');
      if (randBtn) {
        randBtn.click();
      }
    });

    // Now run till actual bankruptcy
    await runTillBankrupt(page, traderApp);

    await assertNoConsoleErrors(page);

    await verifyBankruptcyOutcomeAndJournal(page, traderApp, 'CEL');
  });

  test('creates one bankrupt journey per selectable trader ruleset via TravellerMap + local', async () => {
    test.setTimeout(600000);
    const page = getPage();

    await enableTraderSettings(page);
    await closeAllApps(page);

    // ── First ruleset: TravellerMap load (populates world actors) ──
    const firstDialog = await openTraderFlow(page);
    await selectWorldSource(firstDialog, 'travellermap');

    // Open setup to discover available rulesets
    await page.waitForSelector('#trader-setup', { state: 'visible', timeout: 30000 });
    await page.waitForSelector('#trader-setup .fa-spin', { state: 'hidden', timeout: 60000 });
    const rulesets = await getEnabledTraderRulesets(page, 'trader-setup');

    expect(rulesets.length, 'Expected at least one enabled trader ruleset').toBeGreaterThan(0);

    // Complete the first iteration through TravellerMap
    const firstRuleset = rulesets[0];
    await announceRulesetInChat(page, firstRuleset);
    await completeTravellerMapSetup(page, firstRuleset);
    await confirmCrewSetup(page);

    const firstTraderApp = await waitForTraderApp(page);
    await runTillBankrupt(page, firstTraderApp);
    await verifyBankruptcyOutcomeAndJournal(page, firstTraderApp, firstRuleset);
    await closeTraderApp(page);

    // ── Remaining rulesets: use local source (world actors now exist) ──
    for (let i = 1; i < rulesets.length; i++) {
      const ruleset = rulesets[i];

      await closeAllApps(page);
      await announceRulesetInChat(page, ruleset);

      const localDialog = await openTraderFlow(page);
      await selectWorldSource(localDialog, 'local');

      await completeLocalSetup(page, ruleset);

      await confirmCrewSetup(page);

      const traderApp = await waitForTraderApp(page);
      await runTillBankrupt(page, traderApp);
      await verifyBankruptcyOutcomeAndJournal(page, traderApp, ruleset);
      await closeTraderApp(page);
    }
  });
});
