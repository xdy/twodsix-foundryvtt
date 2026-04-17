const { test, expect } = require('@playwright/test');
const {
  registerWorldHooks,
  assertNoConsoleErrors,
} = require('./helpers');
const {
  enableChargenSettings,
  openChargenApp,
  selectChargenRuleset,
  runRandomAll,
  undoFromDoneState,
  undoActiveRow,
  randomizeActiveRowIfAvailable,
  autoFromHereToDone,
  getCreateButtonAndCharName,
  createActorFromChargen,
  readLatestChargenJournal,
  getEnabledChargenRulesets,
  closeChargenApp,
} = require('./helpers.chargen');

/**
 * Shared assertions run after each ruleset completes random-all + actor create.
 * @param {import('@playwright/test').Page} page
 * @param {string} charName - expected character name
 * @param {string} ruleset - ruleset key used for this iteration
 */
async function verifyCreatedActorAndJournal(page, charName, ruleset) {
  // Wait for journal save to flush (debounced 450ms + extra)
  await page.waitForTimeout(3000);

  const journalData = await readLatestChargenJournal(page);

  expect(journalData.error, `Journal error for ruleset ${ruleset}`).toBeUndefined();
  expect(journalData.hasFlag, `Journal missing flag for ruleset ${ruleset}`).toBe(true);
  expect(journalData.isDone, `Journal not done for ruleset ${ruleset}`).toBe(true);
  expect(journalData.journalName, `Journal name mismatch for ruleset ${ruleset}`).toMatch(
    new RegExp(`^${charName}:`),
  );
  expect(journalData.textContent, `Missing 'Generation complete' for ruleset ${ruleset}`).toContain(
    'Generation complete',
  );
  expect(journalData.textContent, `Missing char name in journal for ruleset ${ruleset}`).toContain(charName);

  await assertNoConsoleErrors(page);
}

test.describe('twodsix character generation — random flow', () => {
  const getPage = registerWorldHooks(test, {
    label: 'chargen random flow test',
    timeout: 300000,
  });

  test('random all, double undo, random + auto from here, create actor, verify journal', async () => {
    const page = getPage();

    await enableChargenSettings(page);

    const charGenApp = await openChargenApp(page);

    await selectChargenRuleset(page, charGenApp, 'CE');

    await runRandomAll(page, charGenApp);

    await assertNoConsoleErrors(page);

    await undoFromDoneState(page, charGenApp);

    await undoActiveRow(page, charGenApp);

    await randomizeActiveRowIfAvailable(page, charGenApp);

    await autoFromHereToDone(page, charGenApp);

    await assertNoConsoleErrors(page);

    const { createBtn, charName } = await getCreateButtonAndCharName(charGenApp);
    expect(charName).toBeTruthy();

    await createActorFromChargen(page, createBtn);

    await verifyCreatedActorAndJournal(page, charName, 'CE');
  });

  test('creates one character per selectable ruleset via random all', async () => {
    const page = getPage();

    await enableChargenSettings(page);

    // Open chargen once to discover which rulesets are enabled in the picker
    const discoverApp = await openChargenApp(page);
    const rulesets = await getEnabledChargenRulesets(page, discoverApp);
    await closeChargenApp(page);

    expect(rulesets.length, 'Expected at least one enabled chargen ruleset').toBeGreaterThan(0);

    for (const ruleset of rulesets) {
      const charGenApp = await openChargenApp(page);

      await selectChargenRuleset(page, charGenApp, ruleset);

      await runRandomAll(page, charGenApp);

      await assertNoConsoleErrors(page);

      const { createBtn, charName } = await getCreateButtonAndCharName(charGenApp);
      expect(charName, `No character name for ruleset ${ruleset}`).toBeTruthy();

      await createActorFromChargen(page, createBtn);

      await verifyCreatedActorAndJournal(page, charName, ruleset);
    }
  });
});
