// CharacterGeneration.js — Entry point for character generation
import { CharGenApp } from './CharGenApp.js';
import { isChargenRulesetSupported, preloadCharGenData } from './CharGenRegistry.js';
import { deserializeCharGenState, freshState } from './CharGenState.js';

/**
 * Journal entries that have a saved CharGen session flag.
 * @returns {JournalEntry[]}
 */
export function findSavedCharGenSessions() {
  return game.journal.filter(j => j.getFlag('twodsix', 'charGenSession'));
}

/**
 * Main entry point for character generation.
 * Initializes the app and starts the generation process.
 * @param {JournalEntry|null} [existingJournal] - Resume from this journal when set
 */
export async function startCharacterGeneration(existingJournal = null) {
  let app = null;
  try {
    const ruleset = game.settings.get('twodsix', 'ruleset') || 'CE';

    if (!isChargenRulesetSupported(ruleset)) {
      ui.notifications.error(game.i18n.format('TWODSIX.CharGen.Errors.RulesetNotSupported', { ruleset }));
      return;
    }

    // Pre-load career data
    await preloadCharGenData(ruleset);

    // Create and initialize the app
    app = new CharGenApp();
    if (existingJournal) {
      app.loadState(existingJournal);
    } else {
      app.charState = deserializeCharGenState(freshState());
      app.charState.ruleset = ruleset;
    }

    app._syncWindowTitleForRuleset();
    await app.render({ force: true });
    if (app.isDone) {
      app._updateNameAndTitle(app.charName);
      app._syncWindowTitleForRuleset();
      return;
    }
    await app.run();
  } catch (err) {
    console.error('twodsix | CharGen startup/run failed', {
      error: err,
      ruleset: app?.charState?.ruleset ?? (game.settings.get('twodsix', 'ruleset') || 'CE'),
      terms: app?.charState?.totalTerms ?? 0,
    });
    const msg = err?.message || String(err);
    ui.notifications.error(game.i18n.format('TWODSIX.CharGen.Errors.RunFailed', { error: msg }));
  }
}
