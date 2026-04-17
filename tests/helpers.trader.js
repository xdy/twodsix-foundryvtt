const { expect } = require('@playwright/test');

/** The Actor folder holding Travellermap-imported worlds (matches TraderConstants.TRAVELLERMAP_ROOT_FOLDER_NAME). */
const TRAVELLERMAP_FOLDER = 'Travellermap Sectors';
/** Default starting world for local-mode tests. */
const DEFAULT_WORLD = 'Regina';

/**
 * Enable trader-related settings (undo, random roll).
 * @param {import('@playwright/test').Page} page
 */
async function enableTraderSettings(page) {
  await page.evaluate(() => {
    game.settings.set('twodsix', 'traderEnableUndo', true);
    game.settings.set('twodsix', 'traderEnableRandomRoll', true);
  });
}

/**
 * Click the trade button in the journal sidebar and dismiss any initial dialogs.
 * Returns the World Source dialog locator for caller to pick source.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<import('@playwright/test').Locator>}
 */
async function openTraderFlow(page) {
  await page.evaluate(() => ui.sidebar.activateTab('journal'));

  await page.waitForSelector('button.trade-journey', { state: 'visible', timeout: 10000 });
  await page.locator('button.trade-journey').click({ force: true });

  await page.waitForTimeout(300);

  // Handle "Trading" resume dialog if present.
  // Use :text-is on the header title to avoid false match on World Source
  // dialog content (which contains "trading" in its prompt text).
  try {
    const tradingDialog = page.locator('dialog.application:has(> header > h1:text-is("Trading"))');
    await tradingDialog.waitFor({ state: 'visible', timeout: 5000 });
    await tradingDialog.locator('button[data-action="ok"]').click({ force: true });
  } catch {
    // Resume dialog is optional — only appears when a prior session exists.
  }

  const worldSourceDialog = page.locator('.dialog:has-text("World Source")');
  await worldSourceDialog.waitFor({ state: 'visible', timeout: 10000 });
  return worldSourceDialog;
}

/**
 * Select a world source in the World Source dialog.
 * @param {import('@playwright/test').Locator} worldSourceDialog
 * @param {'travellermap'|'local'} source
 */
async function selectWorldSource(worldSourceDialog, source) {
  await worldSourceDialog.locator(`button[data-action="${source}"]`).click({ force: true });
}

/**
 * Complete the TravellerMap setup form (ruleset only; sector/subsector/world kept as defaults).
 * @param {import('@playwright/test').Page} page
 * @param {string} ruleset - e.g. 'CE', 'CEL', 'CDEE', 'CLU'
 * @param {number} [startingCredits=150000]
 */
async function completeTravellerMapSetup(page, ruleset, startingCredits = 150000) {
  const setupApp = page.locator('#trader-setup');
  await setupApp.waitFor({ state: 'visible', timeout: 30000 });

  // Wait for sector/world loading spinner to finish
  await page.waitForSelector('#trader-setup .fa-spin', { state: 'hidden', timeout: 60000 });

  await setupApp.locator('select[name="ruleset"]').selectOption(ruleset);
  await setupApp.locator('input[name="startingCredits"]').fill(String(startingCredits));

  // Confirm — wait for the button to become enabled then click
  const confirmBtn = setupApp.locator('button.st-confirm-btn');
  await expect(confirmBtn).toBeEnabled({ timeout: 10000 });
  await confirmBtn.click({ force: true });

  // Wait until the setup app is gone (closed by _confirm)
  await page.waitForSelector('#trader-setup', { state: 'detached', timeout: 30000 }).catch(() => {});
}

/**
 * Complete the local setup form.
 *
 * Uses page.evaluate for dropdown interactions to avoid Playwright locator
 * detachment during the re-renders triggered by each selection's change handler.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} ruleset - e.g. 'CE', 'CEL', 'CDEE', 'CLU'
 * @param {string} [rootFolderName='Travellermap Sectors'] - name of the Actor folder with worlds
 * @param {string} [worldName='Regina'] - name of the starting world
 * @param {number} [startingCredits=150000]
 */
async function completeLocalSetup(
  page,
  ruleset,
  rootFolderName = TRAVELLERMAP_FOLDER,
  worldName = DEFAULT_WORLD,
  startingCredits = 150000,
) {
  const setupApp = page.locator('#trader-local-setup');
  await setupApp.waitFor({ state: 'visible', timeout: 30000 });

  // Select ruleset first — triggers a re-render via change handler, then wait
  // for the form to settle by waiting for the confirm button to appear again.
  await setupApp.locator('select[name="ruleset"]').selectOption(ruleset);
  await page.waitForSelector('#trader-local-setup button.st-confirm-btn', {
    state: 'visible',
    timeout: 15000,
  });

  // Pick the root folder via evaluate to avoid locator detachment
  const folderValue = await page.evaluate((folderName) => {
    const select = document.querySelector('#trader-local-setup select[name="rootFolderId"]');
    if (!select) {
      return null;
    }
    const option = Array.from(select.options).find((o) => o.textContent.trim() === folderName);
    return option ? option.value : null;
  }, rootFolderName);

  if (!folderValue) {
    const available = await page.evaluate(() => {
      const select = document.querySelector('#trader-local-setup select[name="rootFolderId"]');
      return select ? Array.from(select.options).map((o) => o.textContent.trim()).join(' | ') : 'N/A';
    });
    throw new Error(
      `Root folder "${rootFolderName}" not found in local setup dropdown. Available: ${available}`,
    );
  }

  // Dispatch change so TraderLocalSetupApp._onRender loads worlds
  await page.evaluate((val) => {
    const select = document.querySelector('#trader-local-setup select[name="rootFolderId"]');
    if (select) {
      select.value = val;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, folderValue);

  // Wait for worlds dropdown to contain an option starting with the expected world name
  await page.waitForFunction(
    (name) => {
      const select = document.querySelector('#trader-local-setup select[name="startWorldId"]');
      if (!select) {
        return false;
      }
      return Array.from(select.options).some((o) => o.textContent.startsWith(name));
    },
    worldName,
    { timeout: 15000 },
  );

  // Select the start world via evaluate
  const worldValue = await page.evaluate((name) => {
    const select = document.querySelector('#trader-local-setup select[name="startWorldId"]');
    if (!select) {
      return null;
    }
    const option = Array.from(select.options).find((o) => o.textContent.startsWith(name));
    return option ? option.value : null;
  }, worldName);

  if (!worldValue) {
    throw new Error(`World "${worldName}" not found in start world dropdown`);
  }

  await page.evaluate((val) => {
    const select = document.querySelector('#trader-local-setup select[name="startWorldId"]');
    if (select) {
      select.value = val;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, worldValue);

  await page.locator('#trader-local-setup input[name="startingCredits"]').fill(String(startingCredits));

  // Confirm and wait for the app to close
  const confirmBtn = page.locator('#trader-local-setup button.st-confirm-btn');
  await expect(confirmBtn).toBeEnabled({ timeout: 10000 });
  await confirmBtn.click({ force: true });
  await page.waitForSelector('#trader-local-setup', { state: 'detached', timeout: 30000 }).catch(() => {});
}

/**
 * Confirm the crew setup dialog without changes.
 * @param {import('@playwright/test').Page} page
 */
async function confirmCrewSetup(page) {
  await page.waitForSelector('#trader-crew-setup', { state: 'visible', timeout: 30000 });
  await page.locator('#trader-crew-setup button.st-confirm-btn').click({ force: true });
  // Wait for crew dialog to close
  await page.waitForSelector('#trader-crew-setup', { state: 'detached', timeout: 30000 }).catch(() => {});
}

/**
 * Wait for the main trader app to appear and dismiss any blocking toasts.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<import('@playwright/test').Locator>}
 */
async function waitForTraderApp(page) {
  await page.waitForSelector('#trader', { state: 'visible', timeout: 30000 });

  // Close any info/toast messages that may block buttons
  await page.evaluate(() => {
    const selectors = ['.notification', '.info-message', '.dialog:not(.trader):not(.trader-setup):not(.trader-crew)'];
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (el.offsetParent !== null) {
          el.remove();
        }
      });
    });
  });

  // Wait for the st-scroll table to be populated (app finished first render)
  await page.waitForSelector('#trader .st-table', { state: 'visible', timeout: 15000 });

  return page.locator('#trader');
}

/**
 * Click "Roll Till Bankrupt" and wait for the outcome banner (.st-outcome) to
 * appear — i.e. the ship goes bankrupt or pays off.  No early cutoff.
 *
 * Polls every 500 ms for the outcome banner; if the loop stops running without
 * an outcome, throws immediately with a clear diagnostic instead of timing out
 * silently.
 *
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} traderApp
 */
async function runTillBankrupt(page, traderApp) {
  await traderApp.locator('.st-roll-till-bankrupt').waitFor({ state: 'visible', timeout: 10000 });
  await traderApp.locator('.st-roll-till-bankrupt').click({ force: true });

  // Poll: wait for .st-outcome OR the loop to stop without outcome (error).
  // Timeout is generous (5 min) — the app's own stuck-detection will stop the
  // loop if rolls make no progress.
  await traderApp.locator('.st-outcome').waitFor({ state: 'visible', timeout: 300000 });
}

/**
 * Stop the roll-till-bankrupt loop once the day counter reaches `minDay`.
 * Returns the day that was reached when the loop was stopped.
 *
 * Call this *before* `runTillBankrupt` when you want to exercise undo / random
 * mid-flight without waiting for actual bankruptcy.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} [minDay=5] - stop once the day counter is at least this value
 * @returns {Promise<number>} the day reached when the loop was stopped
 */
async function stopRollAfterDay(page, minDay = 5) {
  await page.waitForFunction(
    (target) => {
      const items = document.querySelectorAll('.st-status-item');
      for (const el of items) {
        const dayMatch = el.textContent.match(/Day (\d+)/);
        if (dayMatch && parseInt(dayMatch[1], 10) >= target) {
          return true;
        }
      }
      return false;
    },
    minDay,
    { timeout: 60000 },
  );

  const day = await page.evaluate(() => {
    const items = document.querySelectorAll('.st-status-item');
    for (const el of items) {
      const dayMatch = el.textContent.match(/Day (\d+)/);
      if (dayMatch) {
        return parseInt(dayMatch[1], 10);
      }
    }
    return 0;
  });

  // Stop the loop.  _cancelRollTillBankruptcy calls this.render() which is
  // async, so the DOM may still show the old "stop rolling" buttons after
  // evaluate returns.
  await page.evaluate(() => {
    const app = Object.values(ui.windows || {}).find((w) => w.id === 'trader');
    if (app?._rollTillBankruptcyActive) {
      app._stopRollTillBankruptcy();
    }
  });

  // Wait for the undo button to appear (re-render completed).
  await page.waitForSelector('#trader .st-undo', { state: 'visible', timeout: 15000 });

  return day;
}

/**
 * Wait for the bankruptcy outcome banner and return its text.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} traderApp
 * @returns {Promise<string>}
 */
async function getBankruptcyOutcomeText(page, traderApp) {
  await traderApp.locator('.st-outcome').waitFor({ timeout: 30000 });
  const text = await traderApp.locator('.st-outcome').textContent();
  return text || '';
}

/**
 * Close the main trader app via Foundry's API and wait for it to disappear.
 * @param {import('@playwright/test').Page} page
 */
async function closeTraderApp(page) {
  await page.evaluate(() => {
    const app = Object.values(ui.windows).find((w) => w.id === 'trader');
    if (app) {
      return app.close();
    }
  });
  await page.waitForSelector('#trader', { state: 'detached', timeout: 15000 }).catch(() => {});
}

/**
 * Close the TraderSetupApp (used to abort setup between iterations).
 * @param {import('@playwright/test').Page} page
 */
async function closeSetupApp(page) {
  await page.evaluate(() => {
    const app = Object.values(ui.windows).find(
      (w) => w.options.id === 'trader-setup' || w.options.id === 'trader-local-setup',
    );
    if (app) {
      return app.close();
    }
  });
  await page.waitForSelector('#trader-setup, #trader-local-setup', {
    state: 'detached',
    timeout: 10000,
  }).catch(() => {});
}

/**
 * Read trading state and journal content from the most recent Trader journal.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<{tradeState: object|null, textContent: string}|null>}
 */
async function readLatestTraderJournal(page) {
  return page.evaluate(async () => {
    const folder = game.folders.find(
      (f) => f.type === 'JournalEntry' && f.name === 'Trader journals',
    );
    if (!folder) {
      return null;
    }
    const journals = game.journal
      .filter((j) => j.folder === folder)
      .sort((a, b) => a.createTime - b.createTime);
    const lastJournal = journals[journals.length - 1];
    if (!lastJournal) {
      return null;
    }
    const tradeState = await lastJournal.getFlag('twodsix', 'tradeState');
    const htmlContent = lastJournal.pages.contents[0]?.text?.content || '';
    const tempEl = document.createElement('div');
    tempEl.innerHTML = htmlContent;
    const textContent = (tempEl.textContent || tempEl.innerText || '').trim();
    return { tradeState, textContent };
  });
}

/**
 * Read the enabled ruleset options from a trader setup form's ruleset `<select>`.
 * The setup app must already be visible.
 * @param {import('@playwright/test').Page} page
 * @param {'trader-setup'|'trader-local-setup'} setupAppId
 * @returns {Promise<string[]>}
 */
async function getEnabledTraderRulesets(page, setupAppId) {
  return page.evaluate((id) => {
    const select = document.querySelector(`#${id} select[name="ruleset"]`);
    return select
      ? Array.from(select.options).map((o) => o.value).filter(Boolean)
      : [];
  }, setupAppId);
}

/**
 * Close all open Foundry applications and dialogs before starting a new
 * trade run.  This prevents stale dialogs (resume, world source, etc.) from
 * interfering with the fresh flow.
 * @param {import('@playwright/test').Page} page
 */
async function closeAllApps(page) {
  await page.evaluate(() => {
    // 1. Close via ApplicationV2 API (covers TraderApp, setup apps, etc.).
    for (const app of Object.values(ui.windows ?? {})) {
      try { app.close(); } catch { /* ignore */ }
    }

    // 2. Close DialogV2 instances (Foundry v13, extends ApplicationV2 but
    //    may or may not register in ui.windows depending on version).
    const DialogV2 = foundry?.applications?.api?.DialogV2;
    if (DialogV2?.instances) {
      for (const dlg of Object.values(DialogV2.instances)) {
        try { dlg.close(); } catch { /* ignore */ }
      }
    }

    // 3. Fallback: close legacy v11/v12 Dialog instances.
    if (typeof Dialog !== 'undefined' && Array.isArray(Dialog?.instances)) {
      for (const dlg of [...Dialog.instances]) {
        try { dlg.close(); } catch { /* ignore */ }
      }
    }

    // 4. Belt-and-suspenders: dismiss any DOM-level dialog/app overlays
    //    that may be orphaned (no backing JS instance).
    for (const el of document.querySelectorAll('.dialog, .window-app')) {
      try { el.remove(); } catch { /* ignore */ }
    }
  });
  // Give Foundry a tick to tear down closing apps.
  await page.waitForTimeout(200);
}

module.exports = {
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
  closeSetupApp,
  readLatestTraderJournal,
  getEnabledTraderRulesets,
  closeAllApps,
};
