const { uiPause } = require('./helpers');

async function enableChargenSettings(page) {
  await page.evaluate(() => {
    game.settings.set('twodsix', 'chargenSessionJournal', true);
    game.settings.set('twodsix', 'chargenEnableUndo', true);
    game.settings.set('twodsix', 'chargenEnableRandomRoll', true);
  });
}

async function openChargenApp(page) {
  await page.evaluate(() => ui.sidebar.activateTab('actors'));
  await uiPause(page);

  const cgButton = page.locator('.header-actions.char-gen button.character-generation');
  await cgButton.waitFor({ state: 'visible', timeout: 10000 });
  await cgButton.click({ force: true });
  await uiPause(page);

  const resumeDialog = page.locator('.dialog:has-text("Character Generation")');
  const hasResumeDialog = await resumeDialog.isVisible({ timeout: 3000 }).catch(() => false);
  if (hasResumeDialog) {
    const goButton = resumeDialog.locator('button[data-action="ok"]');
    await goButton.waitFor({ state: 'visible', timeout: 5000 });
    await goButton.click({ force: true });
    await uiPause(page);
  }

  const charGenApp = page.locator('#char-gen');
  await charGenApp.waitFor({ state: 'visible', timeout: 15000 });
  await uiPause(page);
  return charGenApp;
}

async function selectChargenRuleset(page, charGenApp, ruleset = 'CE') {
  const rulesetSelect = charGenApp.locator('select.cg-ruleset');
  await rulesetSelect.waitFor({ state: 'visible', timeout: 5000 });
  await rulesetSelect.selectOption(ruleset);
  await uiPause(page);
}

async function runRandomAll(page, charGenApp) {
  const randomAllBtn = charGenApp.locator('.cg-rand-all');
  await randomAllBtn.waitFor({ state: 'visible', timeout: 10000 });
  await randomAllBtn.click({ force: true });
  await waitForChargenDone(page, charGenApp);
}

async function waitForChargenDone(page, charGenApp) {
  await charGenApp.locator('.cg-footer .cg-create').waitFor({ state: 'visible', timeout: 120000 });
  await uiPause(page);
}

async function undoFromDoneState(page, charGenApp) {
  const footerUndo = charGenApp.locator('.cg-footer button.cg-undo.cg-create-btn');
  await footerUndo.waitFor({ state: 'visible', timeout: 5000 });
  await footerUndo.click({ force: true });
  await uiPause(page);

  await page.waitForFunction(() => {
    const app = document.querySelector('#char-gen');
    if (!app) {
      return false;
    }
    const activeRow = app.querySelector('tr.cg-row-active');
    return activeRow && activeRow.querySelector('button.cg-undo.cg-btn-action');
  }, { timeout: 15000 });
  await uiPause(page);
}

async function undoActiveRow(page, charGenApp) {
  const rowUndo = charGenApp.locator('tr.cg-row-active button.cg-undo.cg-btn-action');
  await rowUndo.waitFor({ state: 'visible', timeout: 5000 });
  await rowUndo.click({ force: true });
  await uiPause(page);

  await charGenApp.locator('tr.cg-row-active').waitFor({ state: 'visible', timeout: 15000 });
  await uiPause(page);
}

async function randomizeActiveRowIfAvailable(page, charGenApp) {
  const randomBtn = charGenApp.locator('tr.cg-row-active button.cg-rand');
  const hasRandomBtn = await randomBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (!hasRandomBtn) {
    return false;
  }

  await randomBtn.click({ force: true });
  await uiPause(page);
  await charGenApp.locator('tr.cg-row-active').waitFor({ state: 'visible', timeout: 10000 });
  await uiPause(page);
  return true;
}

async function autoFromHereToDone(page, charGenApp) {
  const autoFromHereBtn = charGenApp.locator('tr.cg-row-active button.cg-auto-from-here');
  await autoFromHereBtn.waitFor({ state: 'visible', timeout: 10000 });
  await autoFromHereBtn.click({ force: true });
  await waitForChargenDone(page, charGenApp);
}

async function getCreateButtonAndCharName(charGenApp) {
  const createBtn = charGenApp.locator('.cg-footer .cg-create');
  const createBtnText = await createBtn.textContent();
  const charName = createBtnText.replace(/\s+/g, ' ').replace(/^.*?:\s*/, '').trim();
  return { createBtn, charName };
}

async function createActorFromChargen(page, createBtn) {
  await createBtn.click({ force: true });
  await uiPause(page, 1000);
}

async function readLatestChargenJournal(page) {
  return page.evaluate(async () => {
    const folder = game.folders.find(
      (f) => f.type === 'JournalEntry' && f.getFlag('twodsix', 'purpose') === 'chargen',
    );
    if (!folder) {
      return { error: 'Chargen journal folder not found' };
    }

    const journals = game.journal
      .filter((j) => j.folder === folder)
      .sort((a, b) => (a.createTime ?? 0) - (b.createTime ?? 0));
    const lastJournal = journals[journals.length - 1];
    if (!lastJournal) {
      return { error: 'No journals found in chargen folder' };
    }

    const pages = lastJournal.pages.contents;
    const sessionPage = pages.find((p) => p.name === 'Session') || pages[0];
    if (!sessionPage) {
      return { error: 'No pages in journal', journalName: lastJournal.name };
    }

    const htmlContent = sessionPage.text?.content || '';
    const tempEl = document.createElement('div');
    tempEl.innerHTML = htmlContent;
    const textContent = (tempEl.textContent || tempEl.innerText || '').trim();
    const charGenFlag = lastJournal.getFlag('twodsix', 'charGenSession');

    return {
      journalName: lastJournal.name,
      textContent,
      hasFlag: !!charGenFlag,
      isDone: charGenFlag?.isDone || false,
      flagCharName: charGenFlag?.charName || null,
    };
  });
}

/**
 * Read the enabled (non-disabled) ruleset keys from the chargen ruleset `<select>`.
 * The chargen app must already be open and visible.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} charGenApp
 * @returns {Promise<string[]>}
 */
async function getEnabledChargenRulesets(page, charGenApp) {
  const enabledKeys = await charGenApp.locator('select.cg-ruleset option:not([disabled])').evaluateAll(
    opts => opts.map(o => o.value).filter(Boolean),
  );
  return /** @type {string[]} */ (enabledKeys);
}

/**
 * Close the chargen app via Foundry's API.
 * @param {import('@playwright/test').Page} page
 */
async function closeChargenApp(page) {
  await page.evaluate(() => {
    const app = Object.values(ui.windows).find(w => w.options.id === 'char-gen');
    if (app) {
      return app.close();
    }
  });
  await uiPause(page);
}

module.exports = {
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
};
