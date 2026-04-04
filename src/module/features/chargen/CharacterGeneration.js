// CharacterGeneration.js — Entry point for character generation
import { CharGenApp } from './CharGenApp.js';
import { preloadCharGenData } from './CharGenRegistry.js';
import { freshState } from './CharGenState.js';

/**
 * Main entry point for character generation.
 * Initializes the app and starts the generation process.
 */
export async function startCharacterGeneration() {
  const ruleset = game.settings.get('twodsix', 'ruleset') || 'CE';

  // Pre-load career data for rulesets that need it upfront.
  // Rulesets that defer loading (e.g. CU) handle it inside their own run function.
  await preloadCharGenData(ruleset);

  // Create and initialize the app
  const app = new CharGenApp();
  app.charState = freshState();

  await app.render({ force: true });

  app.run().catch(err => {
    console.error('CharGen error:', err);
    ui.notifications.error(`Character generation error: ${err.message}`);
  });
}
