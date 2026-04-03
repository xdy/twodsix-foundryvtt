// BaseCharGenLogic.js — Abstract base class for character generation logic
import { CHARACTERISTIC_KEYS } from './CharGenState.js';

/**
 * Abstract base class for character generation logic.
 * Provides shared helpers and defines the contract that CE/CU subclasses must implement.
 */
export class BaseCharGenLogic {
  constructor() {
    // Subclasses should initialize their module-level data in resetData()
  }

  /**
   * Reset all module-level data to initial state.
   * Subclasses should call super.resetData() and then clear their own data.
   */
  resetData() {
    // Base implementation is empty; subclasses manage their own module-level state
  }

  /**
   * Load career and ruleset data from compendiums.
   * @param {string} ruleset - Ruleset key (e.g., 'CE', 'CU')
   * @abstract
   */
  async loadData(ruleset) {
    throw new Error('loadData must be implemented by subclass');
  }

  /**
   * Run character generation.
   * @param {CharGenApp} app - The character generation app
   * @returns {Promise<void>}
   * @abstract
   */
  async run(app) {
    throw new Error('run must be implemented by subclass');
  }


  // ─── SHARED HELPERS ─────────────────────────────────────────────────────────

  /**
   * Set a skill to at least the specified level if it's currently lower.
   * @param {CharGenApp} app - The character generation app
   * @param {string} skillName - Name of the skill
   * @param {number} level - Minimum level to set
   * @param {Map<string, number>} [skillMap] - Optional skill map to use (defaults to app.charState.skills)
   */
  async setSkillAtLeast(app, skillName, level, skillMap = null) {
    const state = app.charState;
    const skills = skillMap ?? state.skills;
    const cur = skills.has(skillName) ? skills.get(skillName) : -Infinity;
    if (cur < level) {
      skills.set(skillName, level);
    }
  }

  /**
   * Improve a skill by 1 level (from -1 to 0, or +1 to existing).
   * @param {CharGenApp} app - The character generation app
   * @param {string} skillName - Name of the skill
   * @param {Map<string, number>} [skillMap] - Optional skill map to use (defaults to app.charState.skills)
   */
  async improveSkill(app, skillName, skillMap = null) {
    const state = app.charState;
    const skills = skillMap ?? state.skills;
    const cur = skills.has(skillName) ? skills.get(skillName) : -1;
    skills.set(skillName, cur < 0 ? 1 : cur + 1);
  }

  /**
   * Prompt user to start another career or finish.
   * @param {CharGenApp} app - The character generation app
   * @param {number} totalTerms - Total terms served so far
   * @returns {Promise<string>} 'yes' to continue, 'no' to finish
   */
  async promptAnotherCareer(app, totalTerms) {
    return app._choose(
      `Another career? (${totalTerms} term${totalTerms !== 1 ? 's' : ''} served)`,
      [
        { value: 'yes', label: 'Yes — enter another career' },
        { value: 'no', label: 'No — finish' },
      ]
    );
  }

  /**
   * Start a new term history entry.
   * @param {Object} state - Character state
   * @param {Object} options - Term options
   * @param {string} options.careerName - Name of the career
   * @param {number} options.totalTerm - Total terms across all careers
   * @param {number} options.ageStart - Starting age for this term
   * @param {string} options.startedVerb - Verb describing how they entered (e.g., 'Became a', 'Stayed a')
   * @returns {Object} The term history entry
   */
  startTermHistoryEntry(state, { careerName, totalTerm, ageStart, startedVerb }) {
    const termEntry = {
      term: totalTerm,
      career: careerName,
      events: [`${startedVerb} ${careerName} at age ${ageStart}`],
    };
    state.termHistory.push(termEntry);
    return termEntry;
  }

  /**
   * Check for characteristic crisis (any characteristic at or below 0).
   * Override in subclass if crisis rules differ (e.g. CE vs CU).
   * @param {CharGenApp} app - The character generation app
   * @returns {Promise<void>}
   */
  async checkCrisis(app) {
    const state = app.charState;
    const zero = CHARACTERISTIC_KEYS.filter(c => (state.chars[c] ?? 0) <= 0);
    if (!zero.length) {
      return;
    }
    // Default implementation throws — subclasses should override
    throw new Error('checkCrisis must be implemented by subclass for crisis handling');
  }
}
