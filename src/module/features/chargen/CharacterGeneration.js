// CharacterGeneration.js — Entry point for character generation
import { CharGenApp } from './CharGenApp.js';
import { preloadCharGenData } from './CharGenRegistry.js';
import { deserializeCharGenState, freshState } from './CharGenState.js';

/**
 * Main entry point for character generation.
 * Initializes the app and starts the generation process.
 */
export async function startCharacterGeneration() {
  let app = null;
  try {
    const ruleset = game.settings.get('twodsix', 'ruleset') || 'CE';

    // Pre-load career data
    await preloadCharGenData(ruleset);

    // Create and initialize the app
    app = new CharGenApp();
    app.charState = deserializeCharGenState(freshState());

    await app.render({ force: true });
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
