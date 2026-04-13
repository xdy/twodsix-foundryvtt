// BaseCharGenLogic.js — Abstract base class for character generation logic
import { CHARACTERISTIC_KEYS } from './CharGenState.js';
import { chooseGender, chooseLanguage, chooseName } from './CharGenUtils.js';
import { resolveCharKey } from './SharedCharGenConstants.js';

/**
 * Abstract base class for character generation logic.
 * Provides shared helpers and defines the contract that CE/CU subclasses must implement.
 */
export class BaseCharGenLogic {
  constructor() {
    this.resetData();
  }

  /**
   * Reset all instance data to initial state.
   * Subclasses should call super.resetData() and then clear their own data.
   */
  resetData() {
    // Base implementation handles shared mechanics; subclasses manage their own instance state
    this.skillNameMap = {};
    this.cascadeSkills = {};
    this._loadedRuleset = null;
  }

  /**
   * Load career and ruleset data from compendiums.
   * Template method: skeleton shared, specifics in hooks.
   * @param {string} ruleset - Ruleset key (e.g., 'CE', 'CU')
   */
  async loadData(ruleset) {
    if (this._isDataLoaded(ruleset)) {
      return;
    }
    this.resetData();

    const options = this._getCareerPackOptions(ruleset);
    const { careers, careerNames } = await this.loadCareerData(ruleset, options);

    this._assignRulesetConstants(careers, careerNames, ruleset);
    this._loadedRuleset = ruleset;
  }

  /** Hook to check if data is already cached. Default checks _loadedRuleset. */
  _isDataLoaded(ruleset) {
    return this._loadedRuleset === ruleset;
  }

  /** Hook to return pack names for loadCareerData. */
  _getCareerPackOptions(ruleset) {
    return {};
  }

  /** Hook to assign constants to instance properties. */
  _assignRulesetConstants(careers, careerNames, ruleset) {
    // Subclasses override
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
   * @param {string} options.startedVerb - Verb key describing how they entered (e.g., 'Began', 'Continued')
   * @returns {Object} The term history entry
   */
  startTermHistoryEntry(state, { careerName, totalTerm, ageStart, startedVerb }) {
    const localizedVerb = game.i18n.localize(`TWODSIX.CharGen.Events.${startedVerb}`);
    const termEntry = {
      term: totalTerm,
      career: careerName,
      events: [game.i18n.format('TWODSIX.CharGen.Events.TermStart', { verb: localizedVerb, career: careerName, age: ageStart })],
    };
    state.termHistory.push(termEntry);
    return termEntry;
  }

  /**
   * Check for characteristic crisis (any characteristic at or below 0).
   * @param {CharGenApp} app - The character generation app
   * @returns {Promise<void>}
   */
  async checkCrisis(app) {
    const state = app.charState;
    const zero = CHARACTERISTIC_KEYS.filter(c => (state.chars[c] ?? 0) <= 0);
    if (!zero.length) {
      return;
    }
    await this._handleCrisis(app, zero);
  }

  /**
   * Handle characteristic crisis. Must be implemented by subclass.
   * @param {CharGenApp} app
   * @param {string[]} zeroChars - Keys of characteristics at or below 0
   * @abstract
   * @protected
   */
  async _handleCrisis(app, zeroChars) {
    throw new Error('_handleCrisis must be implemented by subclass');
  }

  /**
   * Run the identity step (characteristics -> gender -> language -> name).
   * @param {CharGenApp} app - The character generation app
   * @param {Object} options - Step options
   * @param {function} [options.characteristicsStep] - Optional custom characteristics step
   */
  async stepIdentity(app, { characteristicsStep = null } = {}) {
    const state = app.charState;
    if (characteristicsStep) {
      await characteristicsStep(app);
    } else {
      await app._chooseCharacteristics();
    }
    state.gender = await chooseGender(app);
    await chooseLanguage(app);
    await chooseName(app);
  }

  /**
   * Load career data from compendiums.
   * @param {string} ruleset - Ruleset key (e.g., 'CE', 'CU')
   * @param {Object} opts - Load options
   * @returns {Promise<Object>} { careers, careerNames }
   */
  async loadCareerData(ruleset, { careersPackName = null, careersFallbackPackName = null } = {}) {
    const cpName = careersPackName ?? `twodsix.${ruleset.toLowerCase()}-srd-careers`;
    const requestedPack = game.packs.get(cpName);
    if (!requestedPack && ruleset !== 'CE' && careersFallbackPackName) {
      console.warn(`twodsix | CharGen: pack "${cpName}" not found — falling back to ${careersFallbackPackName}.`);
    }
    let pack = requestedPack || (careersFallbackPackName ? game.packs.get(careersFallbackPackName) : null);
    if (!pack) {
      throw new Error(`Failed to load career data: ${cpName} or ${careersFallbackPackName} not found.`);
    }
    const careerDocs = await pack.getDocuments();
    const careers = careerDocs.reduce((acc, doc) => {
      if (!doc?.name || !doc?.system || typeof doc.system !== 'object') {
        console.warn(`twodsix | CharGen: skipping invalid career entry in ${pack.collection}.`, doc);
        return acc;
      }
      acc[doc.name] = doc.system;
      return acc;
    }, {});
    const careerNames = Object.keys(careers).sort();
    if (!careerNames.length) {
      throw new Error(`Failed to load career data: no valid careers found in ${pack.collection}.`);
    }

    return { careers, careerNames };
  }

  /** Parse simple mechanic tags from description strings like [SKILL:Bribery:1] */
  _parseTags(description) {
    const tags = [];
    const regex = /\[([^\]]+)\]/g;
    let m;
    while ((m = regex.exec(description)) !== null) {
      tags.push(m[1]);
    }
    return tags;
  }

  /**
   * Internal helper to apply characteristic changes from tags.
   * Handles (STR|DEX|END|INT|EDU|SOC)_(PLUS|MINUS)<N>
   * @protected
   */
  _applyCharacteristicTag(app, tag) {
    const match = tag.match(/^(STR|DEX|END|INT|EDU|SOC)_(PLUS|MINUS)(-?\d+)$/);
    if (!match) {
      return false;
    }

    const key = match[1].toLowerCase();
    const sign = match[2] === 'PLUS' ? 1 : -1;
    const value = parseInt(match[3], 10);
    const delta = sign * value;

    app.charState.chars[key] += delta;
    app._log('Characteristic', `${match[1]} ${delta > 0 ? '+' : ''}${delta}`);
    return true;
  }

  /**
   * Apply tags common across rulesets.
   * Handles SKILL, Characteristics (via helper), CONTACT, FRIEND, ENEMY.
   * @protected
   */
  async _applyCommonTag(app, tag, description = '') {
    // 1. Characteristics
    if (this._applyCharacteristicTag(app, tag)) {
      return true;
    }

    // 2. Skills
    if (tag.startsWith('SKILL:')) {
      const parts = tag.split(':');
      const skillName = parts[1];
      const level = parseInt(parts[2], 10) || 1;
      const name = await this._addSkillAtLevel(app, skillName, level);
      if (name) {
        app._log('Skill', `${name}-${level}`);
        app.charState.log.push(`Gained ${name}-${level}.`);
      }
      return true;
    }

    // 3. Social / Narrative tags
    if (['CONTACT', 'FRIEND', 'ENEMY'].includes(tag)) {
      const list = tag.toLowerCase() + 's';
      const desc = description.split('[')[0].trim();
      if (desc) {
        if (app.charState[list]) {
          app.charState[list].push(desc);
          app._log(tag.charAt(0) + tag.slice(1).toLowerCase(), desc.slice(0, 60));
        }
      }
      return true;
    }

    return false;
  }

  async _pickSpecialization(app, name) {
    return app._choose(
      `Specialize: ${name}`,
      this.cascadeSkills[name].sort().map(s => ({ value: s, label: s }))
    );
  }

  async _resolveSkillName(app, raw) {
    if (this.skillNameMap[raw]) {
      return this.skillNameMap[raw];
    }
    if (raw in this.cascadeSkills) {
      return this._pickSpecialization(app, raw);
    }
    return raw;
  }

  async _addSkillAtLevel(app, rawName, level) {
    const name = await this._resolveSkillName(app, rawName);
    if (!name) {
      return null;
    }
    await this.setSkillAtLeast(app, name, level);
    return name;
  }

  async _addOrImproveSkill(app, rawName) {
    const name = await this._resolveSkillName(app, rawName);
    if (!name) {
      return;
    }
    await this.improveSkill(app, name);
  }

  async _applyTableEntry(app, entry) {
    const state = app.charState;
    const charKey = resolveCharKey(entry);
    if (charKey) {
      state.chars[charKey]++;
      app._log('Characteristic', entry);
    } else {
      const name = await this._resolveSkillName(app, entry);
      if (!name) {
        return;
      }
      const before = state.skills.get(name) ?? -1;
      await this.improveSkill(app, name);
      app._log('Skill', `${name}-${state.skills.get(name) ?? (before + 1)}`);
    }
  }
}
