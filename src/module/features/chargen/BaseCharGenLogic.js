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
    const primaryPack = requestedPack || (careersFallbackPackName ? game.packs.get(careersFallbackPackName) : null);
    if (!primaryPack) {
      throw new Error(`Failed to load career data: ${cpName} or ${careersFallbackPackName} not found.`);
    }

    const sources = [];

    // 1. Primary pack
    const primaryDocs = await primaryPack.getDocuments();
    sources.push({
      label: primaryPack.metadata.label,
      docs: primaryDocs.filter(d => d.type === 'career')
    });

    // 2. Custom sources from settings
    const config = game.settings.get('twodsix', 'customCareerSources')[ruleset] || { compendiums: [], folders: [] };

    // Compendiums
    for (const id of config.compendiums) {
      const pack = game.packs.get(id);
      if (!pack || pack.metadata.type !== 'Item') {
        console.warn(game.i18n.format('TWODSIX.CharGen.Warnings.sourceNotFound', { id }));
        continue;
      }
      const docs = await pack.getDocuments();
      sources.push({
        label: pack.metadata.label,
        docs: docs.filter(d => d.type === 'career')
      });
    }

    // Folders
    for (const id of config.folders) {
      const folder = game.folders.get(id);
      if (!folder || folder.type !== 'Item') {
        console.warn(game.i18n.format('TWODSIX.CharGen.Warnings.sourceNotFound', { id }));
        continue;
      }
      sources.push({
        label: folder.name,
        docs: folder.contents.filter(d => d.type === 'career')
      });
    }

    // 3. Process docs and handle collisions
    const careerGroups = new Map(); // name -> [{ sourceLabel, system }]

    for (const source of sources) {
      for (const doc of source.docs) {
        if (!doc?.name || !doc?.system || typeof doc.system !== 'object') {
          continue;
        }

        // Ruleset mismatch check
        const docRuleset = doc.system.ruleset;
        if (docRuleset && docRuleset !== ruleset) {
          console.warn(game.i18n.format('TWODSIX.CharGen.Warnings.rulesetMismatch', {
            name: doc.name,
            ruleset: docRuleset,
            requested: ruleset
          }));
        }

        if (!careerGroups.has(doc.name)) {
          careerGroups.set(doc.name, []);
        }
        careerGroups.get(doc.name).push({
          sourceLabel: source.label,
          system: doc.system
        });
      }
    }

    const careers = {};
    for (const [name, entries] of careerGroups.entries()) {
      if (entries.length === 1) {
        careers[name] = entries[0].system;
      } else {
        for (const entry of entries) {
          const suffixedName = `${name} - ${entry.sourceLabel}`;
          careers[suffixedName] = entry.system;
        }
      }
    }

    const careerNames = Object.keys(careers).sort();
    if (!careerNames.length) {
      throw new Error(`Failed to load career data: no valid careers found.`);
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
   * Convert a single tag to a human-readable string for history display.
   * Subclasses should override and call super() for unrecognized tags.
   * @param {string} tag - The raw tag content (without brackets)
   * @returns {string} Human-readable label
   * @protected
   */
  _humanizeTag(tag) {
    // Characteristic modifiers: STR_PLUS1, DEX_MINUS2, etc.
    const charMatch = tag.match(/^(STR|DEX|END|INT|EDU|SOC)_(PLUS|MINUS)(\d+)$/);
    if (charMatch) {
      const sign = charMatch[2] === 'PLUS' ? '+' : '−';
      return `${charMatch[1]} ${sign}${charMatch[3]}`;
    }

    // SKILL:Name:level
    if (tag.startsWith('SKILL:')) {
      const parts = tag.split(':');
      return `${parts[1]}-${parts[2] ?? 1}`;
    }

    if (tag === 'CONTACT') {
      return 'Contact';
    }
    if (tag === 'FRIEND') {
      return 'Friend';
    }
    if (tag === 'ENEMY') {
      return 'Enemy';
    }

    // Unknown — preserve bracketed so it's visible but not confusingly blank
    return `[${tag}]`;
  }

  /**
   * Replace all mechanic tags in a description with human-readable equivalents.
   * Used when recording events in the career history summary.
   * @param {string} description - Raw description with bracket tags
   * @returns {string} Display-ready string
   */
  _humanizeTaggedDescription(description) {
    return description.replace(/\[([^\]]+)\]/g, (_match, tag) => this._humanizeTag(tag)).trim();
  }

  /**
   * Tokenize a description into tag groups connected by 'or' or 'and'.
   * Returns an array of { tags: string[], connector: 'single'|'or'|'and' }.
   * 'or' groups → user chooses one tag to apply.
   * 'and' groups → all tags in the group are applied.
   * 'single' groups → the one tag is applied.
   */
  _parseTagGroups(description) {
    const parts = [];
    const regex = /\[([^\]]+)\]/g;
    let last = 0;
    let m;
    while ((m = regex.exec(description)) !== null) {
      if (m.index > last) {
        parts.push({ type: 'text', value: description.slice(last, m.index) });
      }
      parts.push({ type: 'tag', value: m[1] });
      last = m.index + m[0].length;
    }
    if (last < description.length) {
      parts.push({ type: 'text', value: description.slice(last) });
    }

    const groups = [];
    let i = 0;
    while (i < parts.length) {
      if (parts[i].type !== 'tag') {
        i++;
        continue;
      }
      const groupTags = [parts[i].value];
      let connector = 'single';
      i++;

      while (i < parts.length && parts[i].type === 'text' && i + 1 < parts.length && parts[i + 1].type === 'tag') {
        const bridge = parts[i].value.trim().toLowerCase();
        if (bridge === 'or') {
          if (connector === 'and') {
            break;
          }
          connector = 'or';
          groupTags.push(parts[i + 1].value);
          i += 2;
        } else if (bridge === 'and') {
          if (connector === 'or') {
            break;
          }
          connector = 'and';
          groupTags.push(parts[i + 1].value);
          i += 2;
        } else {
          break;
        }
      }
      groups.push({ tags: groupTags, connector });
    }
    return groups;
  }

  /**
   * Apply all tags in a description, respecting 'or' (user picks one) and 'and' (apply all).
   * Returns true if the event should end the career (CU INJURED_LEAVE etc.).
   * Subclasses implement the ruleset-specific tag logic in _applyRulesetTag.
   */
  async applyEventTags(app, description, careerName) {
    const groups = this._parseTagGroups(description);
    let leaveCareer = false;

    for (const group of groups) {
      if (group.connector === 'or') {
        const choices = group.tags.map(t => ({ value: t, label: this._humanizeTag(t) }));
        const chosen = await app._choose('Choose one:', choices);
        if (await this._applySingleTag(app, chosen, description, careerName)) {
          leaveCareer = true;
        }
      } else {
        for (const tag of group.tags) {
          if (await this._applySingleTag(app, tag, description, careerName)) {
            leaveCareer = true;
          }
        }
      }
    }
    return leaveCareer;
  }

  /** Apply a single tag. Tries common tags first, then delegates to _applyRulesetTag. */
  async _applySingleTag(app, tag, description, careerName) {
    if (await this._applyCommonTag(app, tag, description)) {
      return false;
    }
    return this._applyRulesetTag(app, tag, description, careerName);
  }

  /**
   * Apply a single ruleset-specific tag. Override in subclasses.
   * Returns true if the tag forces leaving the current career.
   * @abstract
   * @protected
   */
  async _applyRulesetTag(app, tag, description, careerName) {
    return false;
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
    app.charState.log.push(`${match[1]} ${delta > 0 ? '+' : ''}${delta}.`);
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
          app.charState.log.push(`Gained ${tag.charAt(0) + tag.slice(1).toLowerCase()}.`);
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
