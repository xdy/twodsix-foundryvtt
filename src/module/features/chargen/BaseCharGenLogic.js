// BaseCharGenLogic.js — Abstract base class for character generation logic
import { calcModFor } from '../../utils/sheetUtils.js';
import { addSign, simplifySkillName } from '../../utils/utils.js';
import { adjustChar, appendChargenEventReport, CHARACTERISTIC_KEYS, getChargenOverlayBucket, } from './CharGenState.js';
import { eventUsesStructuredResolve } from './chargenStructuredEvent.js';
import {
  chooseGender,
  chooseLanguage,
  chooseName,
  chooseWeapon,
  localizedMentalOpts,
  localizedPhysicalOpts,
  optionsFromStrings,
} from './CharGenUtils.js';
import { createEventReport, formatAutoHandledSuffix, reportAutoHandled, reportLeaveCareer } from './EventReport.js';
import { resolveCharKey } from './SharedCharGenConstants.js';
import { loadSpeciesChoicesForRuleset } from './SpeciesRegistry.js';

/** Uppercase characteristic keys for structured career events: 2d6 + DM vs target. */
export const CHAR_GEN_EVENT_CHAR_CHECKS = new Set(['STR', 'DEX', 'END', 'INT', 'EDU', 'SOC']);

/**
 * Detect Jack-of-All-Trades skill name regardless of spacing, hyphens, or casing.
 * Matches: "Jack of All Trades", "Jack-of-All-Trades", "Jack of all trades", "jackofalltrades", etc.
 * @param {string} name - Resolved skill name
 * @returns {boolean}
 */
export function isJoatSkillName(name) {
  return simplifySkillName(name).toLowerCase() === 'jackofalltrades';
}

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

  /**
   * Raw dice vs target (no characteristic or skill DM). For career events, gambling, etc.
   * @param {*} app - CharGenApp
   * @param {{ type: 'raw', formula?: string, target: number }} check
   * @returns {Promise<{ success: boolean, checkSummary: string, total: number }>}
   */
  async rollRawDiceCheck(app, check) {
    const formula = check?.formula || '2d6';
    const rawT = Number(check?.target);
    const target = Number.isFinite(rawT) ? rawT : 8;
    const total = await app._roll(formula);
    const success = total >= target;
    const checkSummary = game.i18n.format('TWODSIX.CharGen.Checks.RawCheckSummary', {
      formula,
      total,
      target,
      outcome: success
        ? game.i18n.localize('TWODSIX.CharGen.Outcome.Success')
        : game.i18n.localize('TWODSIX.CharGen.Outcome.Fail'),
    });
    app._log(
      game.i18n.localize('TWODSIX.CharGen.Checks.RawCheckLog'),
      game.i18n.format('TWODSIX.CharGen.Checks.RawCheckDetail', {
        formula,
        total,
        target,
        outcome: success
          ? game.i18n.localize('TWODSIX.CharGen.Outcome.Success')
          : game.i18n.localize('TWODSIX.CharGen.Outcome.Fail'),
      }),
    );
    app.charState.log.push(checkSummary);
    return { success, checkSummary, total };
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
    if (isJoatSkillName(skillName)) {
      state.joat = Math.max(state.joat ?? 0, level);
      return;
    }
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
    if (isJoatSkillName(skillName)) {
      state.joat = (state.joat ?? 0) + 1;
      return;
    }
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
    const termWord = game.i18n.localize(
      totalTerms === 1 ? 'TWODSIX.CharGen.TermWord.one' : 'TWODSIX.CharGen.TermWord.many',
    );
    return app._choose(
      game.i18n.format('TWODSIX.CharGen.Steps.AnotherCareerPrompt', { n: totalTerms, termWord }),
      [
        { value: 'yes', label: game.i18n.localize('TWODSIX.CharGen.Options.YesEnterAnother') },
        { value: 'no', label: game.i18n.localize('TWODSIX.CharGen.Options.NoFinish') },
      ],
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
   * App log + state log for term start, then append matching term history entry.
   * @param {CharGenApp} app
   * @param {Object} opts
   * @param {string} opts.careerName
   * @param {number} opts.termInCareer - Display term within current career (1-based)
   * @param {number} opts.totalTerm - Cumulative term index (state.totalTerms)
   * @param {number} opts.ageStart
   * @returns {{ termEntry: Object }}
   */
  logTermStart(app, { careerName, termInCareer, totalTerm, ageStart }) {
    const state = app.charState;
    const ageEnd = ageStart + 3;
    app._log(
      game.i18n.format('TWODSIX.CharGen.Events.TermLog', { career: careerName, term: termInCareer }),
      game.i18n.format('TWODSIX.CharGen.Events.AgeLog', { start: ageStart, end: ageEnd }),
    );
    state.log.push(
      game.i18n.format('TWODSIX.CharGen.Events.TermHeader', {
        career: careerName,
        term: termInCareer,
        start: ageStart,
        end: ageEnd,
      }),
    );
    const startedVerb = termInCareer === 1 ? 'Began' : 'Continued';
    const termEntry = this.startTermHistoryEntry(state, {
      careerName,
      totalTerm,
      ageStart,
      startedVerb,
    });
    return { termEntry };
  }

  /**
   * Current term row in {@link CharGenState} termHistory for this career and cumulative term.
   * @param {Object} state - Character state
   * @param {string} careerName
   * @param {number} totalTerm
   * @returns {Object|undefined}
   */
  findTermEntry(state, careerName, totalTerm) {
    return state.termHistory.find(th => th.career === careerName && th.term === totalTerm);
  }

  /**
   * Settle any outstanding medical/legal debt out of cash benefits (H2).
   * Per SRD: "During finishing touches, you must pay any outstanding costs from medical care
   * or anagathic drugs out of your Benefits before anything else."
   * Reduces cashBenefits first; any remainder stays as medicalDebt on the actor sheet.
   * @param {CharGenApp} app
   */
  stepSettleDebt(app) {
    const state = app.charState;
    if (!state.medicalDebt) {
      return;
    }
    const paid = Math.min(state.medicalDebt, Math.max(0, state.cashBenefits));
    state.cashBenefits -= paid;
    state.medicalDebt -= paid;
    app._log('Medical Debt', `Paid Cr${paid.toLocaleString()} from cash benefits${state.medicalDebt ? `. Remaining debt: Cr${state.medicalDebt.toLocaleString()}` : ''}.`);
    state.log.push(`Medical debt settled: Cr${paid.toLocaleString()} deducted from cash${state.medicalDebt ? `. Still owed: Cr${state.medicalDebt.toLocaleString()}` : ''}.`);
  }

  /**
   * Check for characteristic crisis (any characteristic at or below 0).
   * Rules for surviving crisis differ by ruleset ({@link #_handleCrisis}); do not unify behavior without an explicit rules pass.
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
   * Handle characteristic crisis. Must be implemented by subclass (CE / CU / CDEE use different survival rules).
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
   * Generic species/ancestry chargen step.
   *
   * Loads species choices from the ruleset's registered species pack
   * ({@link import('./SpeciesRegistry.js').loadSpeciesChoicesForRuleset}), prompts the user to pick one
   * (with an optional Human/no-species default), queues granted trait names onto `state.traits` so
   * {@link import('./CharGenActorFactory.js').createCharacterActor} embeds them, and stores the
   * selection on `state.chargenOverlay[<overlayKey>].species` so
   * {@link import('./CharGenActorFactory.js').createCharacterActor} can also embed the species item.
   *
   * Subclasses opt in by `await this.stepSpecies(app)` from `run()`. CU's SOC path keeps its own
   * legacy `stepSOCSpeciesPath` and does not invoke this generic step.
   *
   * @param {*} app
   * @param {object} [opts]
   * @param {boolean} [opts.allowHuman=true] - Include a "Human" / no-species option in the prompt
   * @param {string|null} [opts.overlayKey] - Lowercase chargen overlay namespace (defaults to `state.ruleset.toLowerCase()`)
   * @returns {Promise<void>}
   */
  async stepSpecies(app, { allowHuman = true, overlayKey = null } = {}) {
    const state = app.charState;
    const ruleset = state.ruleset;
    const overlayNs = (overlayKey || String(ruleset ?? '').toLowerCase()).trim();
    const choices = await loadSpeciesChoicesForRuleset(ruleset);
    if (!choices.length) {
      return;
    }

    const humanLabel = game.i18n.localize('TWODSIX.CharGen.Species.Human');
    const promptOpts = [];
    if (allowHuman) {
      promptOpts.push({ value: '', label: humanLabel });
    }
    for (const c of choices) {
      promptOpts.push({ value: c.id, label: c.name });
    }
    const pickedId = await app._choose(
      game.i18n.localize('TWODSIX.CharGen.Species.Choose'),
      promptOpts,
      { preserveOptionOrder: true },
    );
    if (!pickedId) {
      app._log('Species', humanLabel);
      state.log.push(game.i18n.format('TWODSIX.CharGen.Species.LogPickedHuman', { name: humanLabel }));
      return;
    }

    const sp = choices.find(c => c.id === pickedId);
    if (!sp) {
      return;
    }

    for (const traitName of sp.grantedTraitNames || []) {
      if (traitName && !state.traits.includes(traitName)) {
        state.traits.push(traitName);
      }
    }

    const bucket = getChargenOverlayBucket(state, overlayNs);
    if (!Array.isArray(bucket.chargenNotes)) {
      bucket.chargenNotes = [];
    }
    bucket.species = {
      id: sp.id,
      name: sp.name,
      packId: sp.packId,
      grantedTraitNames: [...(sp.grantedTraitNames ?? [])],
    };

    app._log('Species', sp.name);
    state.log.push(game.i18n.format('TWODSIX.CharGen.Species.LogPicked', { name: sp.name }));
    for (const line of sp.abilityLines || []) {
      const formatted = `${sp.name}: ${line}`;
      state.log.push(formatted);
      bucket.chargenNotes.push(formatted);
    }
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
    const rawCustomSources = game.settings.get('twodsix', 'customCareerSources');
    const customSourcesByRuleset = rawCustomSources && typeof rawCustomSources === 'object' ? rawCustomSources : {};
    const rulesetConfig = customSourcesByRuleset?.[ruleset];
    const config = {
      compendiums: Array.isArray(rulesetConfig?.compendiums) ? rulesetConfig.compendiums : [],
      folders: Array.isArray(rulesetConfig?.folders) ? rulesetConfig.folders : [],
    };

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
          continue;
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
    const localized = baseHumanizeMechanicTag(tag);
    if (localized != null) {
      return localized;
    }
    // Unknown — preserve bracketed so it's visible but not confusingly blank
    return game.i18n.format('TWODSIX.CharGen.Tag.Unknown', { tag });
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
   * Apply one material muster-out benefit line shared by CE and CDEE (characteristic bump, weapon, or generic string).
   * @param {CharGenApp} app
   * @param {string} benefit
   * @param {'verbose'|'silent'} logStyle - `verbose`: push `Material: …` per line; `silent`: caller logs a single summary
   */
  async applySharedMaterialBenefit(app, benefit, logStyle) {
    const state = app.charState;
    const charKey = resolveCharKey(benefit);
    if (charKey) {
      adjustChar(state, charKey, 1);
      if (logStyle === 'verbose') {
        state.log.push(`Material: ${benefit}`);
      }
      return;
    }
    if (benefit === 'Weapon' || benefit === 'Gun') {
      await chooseWeapon(app);
      return;
    }
    state.materialBenefits.push(benefit);
    if (logStyle === 'verbose') {
      state.log.push(`Material: ${benefit}`);
    }
  }

  /**
   * Prompted reductions from one aging-table row (physical amounts then optional mental −1).
   * @param {CharGenApp} app
   * @param {{ phys: number[], mental: number }} entry
   * @param {Object} [opts]
   * @param {string} [opts.physPromptPrefix='Aging: reduce characteristic by'] - Text before ` ${amt}` for each physical pick
   */
  async applyAgingEntryReductions(
    app,
    entry,
    { physPromptFormatKey = 'TWODSIX.CharGen.Aging.ReduceCharBy' } = {},
  ) {
    const state = app.charState;
    for (const amt of entry.phys.filter(n => n > 0)) {
      const c = await app._choose(game.i18n.format(physPromptFormatKey, { amount: amt }), localizedPhysicalOpts(), {
        preserveOptionOrder: true,
      });
      state.chars[c] -= amt;
    }
    if (entry.mental > 0) {
      const c = await app._choose(game.i18n.localize('TWODSIX.CharGen.Aging.ReduceMentalBy'), localizedMentalOpts(), {
        preserveOptionOrder: true,
      });
      state.chars[c]--;
    }
    await this.checkCrisis(app);
  }

  /**
   * Tokenize a description into tag groups connected by 'or' or 'and'.
   * Returns an array of { tags: string[], connector: 'single'|'or'|'and' }.
   * 'or' groups -> user chooses one tag to apply.
   * 'and' groups -> all tags in the group are applied.
   * 'single' groups -> the one tag is applied.
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
        const bridgeIsOr = /^(?:\W*or\W*)$/i.test(bridge);
        const bridgeIsAnd = /^(?:\W*and\W*)$/i.test(bridge);
        if (bridgeIsOr) {
          if (connector === 'and') {
            break;
          }
          connector = 'or';
          groupTags.push(parts[i + 1].value);
          i += 2;
        } else if (bridgeIsAnd) {
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
   * Infer missing `[CONTACT]` / `[FRIEND]` / `[ENEMY]` / `[ALLY]` from common English SRD phrasing
   * when compendium rows omit bracket tags. Skips when the same mechanic is already bracket-tagged
   * (including typed `CONTACT:…`) or when `ALLY_ROLL` handles allies so we never double-apply ALLY.
   *
   * **Limitation:** The regex patterns target canonical Traveller / Cepheus SRD prose. Custom
   * compendiums with non-standard wording may not trigger inference — contributors should prefer
   * explicit bracket tags for reliability.
   * @param {string} description
   * @returns {string}
   */
  _ensureInferredSocialTags(description) {
    const d = String(description ?? '');
    const t = d.trimEnd();
    if (!t.trim()) {
      return d;
    }
    const parsed = this._parseTags(t);
    const hasMechanic = prefix =>
      parsed.some(x => x === prefix || x.startsWith(`${prefix}:`));
    /** SOC / tables that grant allies via dice — do not also infer plain `[ALLY]` from prose. */
    const hasAllyRollOrBracketAlly = parsed.some(
      x => x === 'ALLY' || x.startsWith('ALLY:') || x.startsWith('ALLY_ROLL'),
    );
    const inferred = [];
    const addInferred = token => {
      if (inferred.includes(token)) {
        return;
      }
      inferred.push(token);
    };

    if (!hasMechanic('CONTACT')) {
      if (
        /\bgain\s+(?:a|an|the)\s+(?:[\w'-]+\s+){0,6}contact\b/i.test(t)
        || /\bgain\s+them\s+as\s+a\s+contact\b/i.test(t)
        || /\b(?:acquire|obtain)\s+(?:a|an|the)\s+(?:[\w'-]+\s+){0,4}contact\b/i.test(t)
      ) {
        addInferred('[CONTACT]');
      }
    }

    if (!hasMechanic('FRIEND')) {
      if (
        /\bgain\s+(?:a|an|the)\s+(?:romantic\s+)?friend\b/i.test(t)
        || /\bmake\s+(?:a|an)\s+(?:good\s+)?friend\b/i.test(t)
      ) {
        addInferred('[FRIEND]');
      }
    }

    if (!hasMechanic('ENEMY')) {
      if (
        /\bgain\s+(?:a|an|the)\s+enemy\b/i.test(t)
        || /\bmake\s+(?:a|an)\s+enemy\b/i.test(t)
        || /\bgain\s+(?:a|an)\s+rival\b/i.test(t)
      ) {
        addInferred('[ENEMY]');
      }
    }

    if (!hasMechanic('ALLY') && !hasAllyRollOrBracketAlly) {
      if (
        /\bgain\s+(?:an?\s+)?ally\b/i.test(t)
        || /\byou\s+gain\s+an?\s+important\s+friend\s+or\s+lover\b/i.test(t)
        || /\byou\s+form\s+a\s+close\s+relationship\b/i.test(t)
        || /\bform\s+a\s+close\s+(?:relationship|bond)\b/i.test(t)
      ) {
        addInferred('[ALLY]');
      }
    }

    if (!inferred.length) {
      return d;
    }
    return `${t} ${inferred.join(' ')}`;
  }

  /**
   * Build normalized mechanical groups for an event.
   * Supports:
   * - legacy prose strings with bracket tags and textual connectors
   * - structured event objects with `effects` (array of tags or grouped descriptors)
   */
  _getEventMechanics(eventOrDescription) {
    if (typeof eventOrDescription === 'string') {
      return this._parseTagGroups(this._ensureInferredSocialTags(eventOrDescription));
    }
    const effects = Array.isArray(eventOrDescription?.tags)
      ? [eventOrDescription]
      : Array.isArray(eventOrDescription?.effects)
        ? eventOrDescription.effects
        : null;
    if (!effects) {
      const desc = String(eventOrDescription?.description ?? '');
      return this._parseTagGroups(this._ensureInferredSocialTags(desc));
    }

    const groups = [];
    for (const effect of effects) {
      if (typeof effect === 'string') {
        groups.push({ tags: [effect], connector: 'single' });
        continue;
      }
      if (!effect || typeof effect !== 'object') {
        continue;
      }
      const tags = Array.isArray(effect.tags) ? effect.tags.filter(Boolean) : [];
      if (!tags.length) {
        continue;
      }
      const connector = effect.connector === 'or' || effect.connector === 'and' ? effect.connector : 'single';
      groups.push({ tags, connector });
    }
    return groups;
  }

  /**
   * Apply all tags in a description, respecting 'or' (user picks one) and 'and' (apply all).
   * Returns an EventReport; callers should check report.leaveCareer instead of the raw boolean.
   * Subclasses implement the ruleset-specific tag logic in _applyRulesetTag.
   * Structured career events (checks, branches, onSuccess/onFail) delegate to {@link #_resolveEvent}.
   */
  async applyEventTags(app, eventOrDescription, careerName, { recordInState = true, eventCtx = {} } = {}) {
    if (eventUsesStructuredResolve(eventOrDescription)) {
      return this._resolveEvent(app, eventOrDescription, careerName || '', { recordInState });
    }
    const description = typeof eventOrDescription === 'string'
      ? eventOrDescription
      : String(eventOrDescription?.description ?? '');
    const report = createEventReport(this._humanizeTaggedDescription(description));
    const groups = this._getEventMechanics(eventOrDescription);

    for (const group of groups) {
      if (group.connector === 'or') {
        const choices = group.tags.map(t => ({ value: t, label: this._humanizeTag(t) }));
        const chosen = await app._choose(game.i18n.localize('TWODSIX.CharGen.Steps.ChooseOneFromTags'), choices);
        if (await this._applySingleTag(app, chosen, description, careerName, report, eventCtx)) {
          reportLeaveCareer(report);
        }
      } else {
        for (const tag of group.tags) {
          if (await this._applySingleTag(app, tag, description, careerName, report, eventCtx)) {
            reportLeaveCareer(report);
          }
        }
      }
    }
    if (recordInState) {
      const stored = report.allAutoHandled
        ? { ...report, headline: `${report.headline}${formatAutoHandledSuffix(report)}`.trim() }
        : report;
      appendChargenEventReport(app.charState, stored);
    }
    return report;
  }

  /**
   * Normalize a structured event fragment (string tag, prose, or grouped tags) for {@link applyEventTags}.
   * @param {string|object} piece
   * @returns {string|object}
   * @protected
   */
  _coerceEventPiece(piece) {
    if (typeof piece !== 'string') {
      if (piece?.tags?.length) {
        return {
          description: piece.tags.map(tag => `[${tag}]`).join(piece.connector === 'or' ? ' or ' : ' and '),
          effects: [piece],
        };
      }
      return piece;
    }
    if (piece.includes('[')) {
      return piece;
    }
    return { description: `[${piece}]`, effects: [piece] };
  }

  /**
   * @param {{ type?: string, formula?: string, target?: number, skill?: string }} c
   * @protected
   */
  _labelForEventCheck(c) {
    if (c?.type === 'raw') {
      const formula = c.formula || '2d6';
      const rawT = Number(c.target);
      const target = Number.isFinite(rawT) ? rawT : 8;
      return game.i18n.format('TWODSIX.CharGen.Checks.RawCheckChoiceLabel', { formula, target });
    }
    const skill = c?.skill ?? '';
    const target = c?.target ?? 8;
    return `${skill} ${target}+`;
  }

  /**
   * When an event lists multiple checks (player picks one to roll).
   * @param {string} [options.promptKey='TWODSIX.CharGen.Checks.ChooseCheck'] - i18n key for the choice dialog
   * @protected
   */
  async _chooseCheck(app, checks, { promptKey = 'TWODSIX.CharGen.Checks.ChooseCheck' } = {}) {
    if (checks.length === 1) {
      return checks[0];
    }
    const chosen = await app._choose(
      game.i18n.localize(promptKey),
      checks.map((c, i) => ({
        value: c.type === 'raw' ? `raw:${i}` : c.skill,
        label: this._labelForEventCheck(c),
      })),
      { preserveOptionOrder: true },
    );
    const rawIdx = String(chosen).startsWith('raw:') ? parseInt(String(chosen).slice(4), 10) : NaN;
    if (!Number.isNaN(rawIdx) && checks[rawIdx]?.type === 'raw') {
      return checks[rawIdx];
    }
    return checks.find(c => c.type !== 'raw' && c.skill === chosen) || checks[0];
  }

  /**
   * Run one event check: raw dice vs TN, or skill/characteristic + DM vs TN.
   * @param {*} app
   * @param {{ type?: 'raw', formula?: string, target?: number, skill?: string }} check
   * @param {object} [ctx] - Event-scoped context; sets `ctx.lastCheckSkill` for IMPROVE_CHECK_SKILL
   * @returns {Promise<{ success: boolean, checkSummary?: string, total?: number }>}
   * @protected
   */
  async _rollEventCheck(app, check, ctx) {
    if (check?.type === 'raw') {
      return this.rollRawDiceCheck(app, check);
    }
    return this._rollSkillOrCharCheck(app, check.skill, check.target, ctx);
  }

  /**
   * 2d6 + characteristic or skill DM vs target. Sets `ctx.lastCheckSkill` for tags like IMPROVE_CHECK_SKILL.
   * CDEE overrides with different logging and optional abbreviated state log.
   * @param {*} app
   * @param {string} skill
   * @param {number} target
   * @param {object} [ctx] - Event-scoped context; sets `ctx.lastCheckSkill` for IMPROVE_CHECK_SKILL
   * @returns {Promise<{ success: boolean, checkSummary: string }>}
   * @protected
   */
  /**
   * DM for 2d6 + DM vs TN event checks. CDEE overrides to use characteristic-style DMs on skill levels (incl. untrained).
   * @protected
   */
  _eventCheckDm(state, { isCharCheck, resolvedSkill }) {
    if (isCharCheck) {
      return calcModFor(state.chars[resolvedSkill] ?? 0);
    }
    return Math.max(0, state.skills.get(resolvedSkill) ?? 0);
  }

  async _rollSkillOrCharCheck(app, skill, target, ctx) {
    const state = app.charState;
    const roll = await app._roll('2d6');
    const normalized = String(skill).toUpperCase();
    const isCharCheck = CHAR_GEN_EVENT_CHAR_CHECKS.has(normalized);
    const resolvedSkill = isCharCheck ? normalized.toLowerCase() : await this._resolveSkillName(app, skill);
    const mod = this._eventCheckDm(state, { isCharCheck, resolvedSkill });
    const total = roll + mod;
    const success = total >= target;
    if (ctx && typeof ctx === 'object' && !('abbreviatedStateLog' in ctx)) {
      ctx.lastCheckSkill = isCharCheck ? normalized : resolvedSkill;
    }
    app._log('Event Check', `${skill} ${target}+: ${roll}${addSign(mod)}=${total} -> ${success ? 'Success' : 'Fail'}`);
    state.log.push(`Check ${skill} ${target}+: ${success ? 'Success' : 'Fail'}.`);
    return { success, checkSummary: `${skill} ${target}+: ${roll}${addSign(mod)}=${total}` };
  }

  /**
   * Resolve a structured career event: optional {@link branchChoices}, optional {@link checks},
   * then apply `always`, success/fail branches, and root `effects` when there are no checks.
   * @param {*} app
   * @param {object} event
   * @param {string} careerName
   * @returns {Promise<{ headline: string, subRows: string[], allAutoHandled: boolean, leaveCareer: boolean, _autoHandledItems: unknown[] }>}
   */
  async _resolveEvent(app, event, careerName, { recordInState = true } = {}) {
    const hadBranchChoices = (event.branchChoices?.length ?? 0) > 0;
    const ev = { ...event };
    delete ev.branchChoices;
    delete ev.branchPrompt;

    if (event.branchChoices?.length) {
      const prompt =
        typeof event.branchPrompt === 'string' && event.branchPrompt.startsWith('TWODSIX.')
          ? game.i18n.localize(event.branchPrompt)
          : (event.branchPrompt || game.i18n.localize('TWODSIX.CharGen.Branches.DefaultPrompt'));
      const opts = event.branchChoices.map(b => ({
        value: String(b.value),
        label: b.labelKey ? game.i18n.localize(b.labelKey) : (b.label || String(b.value)),
      }));
      const chosen = await app._choose(prompt, opts);
      const branch = event.branchChoices.find(b => String(b.value) === String(chosen)) || event.branchChoices[0];
      for (const k of ['always', 'checks', 'onSuccess', 'onFail', 'effects', 'benefitGamble']) {
        if (k in branch) {
          ev[k] = branch[k];
        }
      }
    }

    const report = createEventReport(this._humanizeTaggedDescription(event.description));
    const gambleCtx = await this._prepareBenefitGambleBeforeEventChecks(app, ev, careerName, report);
    const eventCtx = {};

    let success = true;
    let checkSummarySuffix = '';
    if (ev.checks?.length && !gambleCtx?.skipEventChecks) {
      const check = await this._chooseCheck(app, ev.checks);
      const result = await this._rollEventCheck(app, check, eventCtx);
      success = result.success;
      if (result.checkSummary) {
        checkSummarySuffix = ` ${result.checkSummary}.`;
      }
    }

    report.headline = `${report.headline}${checkSummarySuffix}`.trim();

    await this._finalizeBenefitGambleAfterEventChecks(app, ev, success, gambleCtx, careerName, report);

    const pieces = [];
    pieces.push(...(ev.always || []));
    pieces.push(...(success ? ev.onSuccess || [] : ev.onFail || []));
    if (!ev.checks?.length) {
      pieces.push(...(ev.effects || []));
      if (pieces.length === 0 && !hadBranchChoices) {
        pieces.push(ev);
      }
    }

    for (const piece of pieces) {
      const pieceReport = await this.applyEventTags(app, this._coerceEventPiece(piece), careerName, { recordInState: false, eventCtx });
      if (!pieceReport.allAutoHandled) {
        report.allAutoHandled = false;
      }
      report.subRows.push(...pieceReport.subRows);
      report._autoHandledItems.push(...(pieceReport._autoHandledItems || []));
      if (pieceReport.leaveCareer) {
        report.leaveCareer = true;
      }
    }
    if (recordInState) {
      const stored = report.allAutoHandled
        ? { ...report, headline: `${report.headline}${formatAutoHandledSuffix(report)}`.trim() }
        : report;
      appendChargenEventReport(app.charState, stored);
    }
    return report;
  }

  /**
   * Optional structured-event hook: prompt for benefit-roll stakes before event checks (CDEE gambling events).
   * Return context consumed by {@link BaseCharGenLogic#_finalizeBenefitGambleAfterEventChecks}.
   * @protected
   * @returns {Promise<object|null>}
   */
  async _prepareBenefitGambleBeforeEventChecks(_app, _ev, _careerName, _report) {
    return null;
  }

  /**
   * Optional structured-event hook: apply benefit stake resolution after checks (CDEE).
   * @protected
   */
  async _finalizeBenefitGambleAfterEventChecks(_app, _ev, _success, _gambleCtx, _careerName, _report) {
    // default no-op
  }

  /** Apply a single tag. Tries common tags first, then delegates to _applyRulesetTag. */
  async _applySingleTag(app, tag, description, careerName, report = null, eventCtx = {}) {
    if (await this._applyCommonTag(app, tag, description, report, eventCtx)) {
      return false;
    }
    return this._applyRulesetTag(app, tag, description, careerName, report);
  }

  /**
   * Apply a single ruleset-specific tag. Override in subclasses.
   * Returns true if the tag forces leaving the current career.
   * @abstract
   * @protected
   */
  async _applyRulesetTag(app, tag, description, careerName, report = null) {
    return false;
  }

  /**
   * Internal helper to apply characteristic changes from tags.
   * Handles (STR|DEX|END|INT|EDU|SOC)_(PLUS|MINUS)<N>
   * @protected
   */
  _applyCharacteristicTag(app, tag, report = null) {
    const match = tag.match(/^(STR|DEX|END|INT|EDU|SOC)_(PLUS|MINUS)(-?\d+)$/);
    if (!match) {
      return false;
    }

    const key = match[1].toLowerCase();
    const sign = match[2] === 'PLUS' ? 1 : -1;
    const value = parseInt(match[3], 10);
    const delta = sign * value;

    // use adjustChar to enforce 0–15 bounds (0 allows crisis detection; 15 is the PC cap)
    adjustChar(app.charState, key, delta);
    const label = `${match[1]} ${delta > 0 ? '+' : ''}${delta}`;
    app._log('Characteristic', label);
    app.charState.log.push(`${label}.`);
    reportAutoHandled(report, label);
    return true;
  }

  /**
   * Apply tags common across rulesets.
   * Handles SKILL, Characteristics (via helper), CONTACT, FRIEND, ENEMY (and typed variants).
   * @param {*} app
   * @param {string} tag
   * @param {string} description
   * @param {object|null} report
   * @param {object} eventCtx - Event-scoped context with `lastCheckSkill`
   * @protected
   */
  async _applyCommonTag(app, tag, description = '', report = null, eventCtx = {}) {
    // 1. Characteristics
    if (this._applyCharacteristicTag(app, tag, report)) {
      return true;
    }

    // 2. Skills — canonical SKILL:Name:Level or legacy SKILL:Name-Level
    if (tag.startsWith('SKILL:')) {
      const { skillName, level } = _parseSkillTag(tag);
      const name = await this._addSkillAtLevel(app, skillName, level);
      if (name) {
        const label = `${name}-${level}`;
        app._log('Skill', label);
        app.charState.log.push(`Gained ${label}.`);
        reportAutoHandled(report, label);
      }
      return true;
    }

    // Improve the skill (or specialization) used for the preceding career-event check (e.g. Smuggler Admin/Streetwise).
    if (tag === 'IMPROVE_CHECK_SKILL') {
      const sk = eventCtx.lastCheckSkill;
      if (sk && !CHAR_GEN_EVENT_CHAR_CHECKS.has(String(sk).toUpperCase())) {
        await this._addOrImproveSkill(app, sk);
        const label = `${sk} +1`;
        app._log('Skill', label);
        app.charState.log.push(game.i18n.format('TWODSIX.CharGen.LogImprovedCheckSkill', { skill: sk }));
        reportAutoHandled(report, label);
      }
      return true;
    }

    if (tag === 'SHIP_SHARE') {
      app.charState.materialBenefits.push('Ship Share');
      app.charState.log.push('Material: Ship Share');
      app._log('Material', 'Ship Share');
      reportAutoHandled(report, 'Ship Share');
      return true;
    }
    if (tag.startsWith('SHIP_SHARE:') || tag.startsWith('SHIP_SHARES:')) {
      const raw = tag.split(':')[1] ?? '';
      let count = Number.parseInt(raw, 10);
      if (!Number.isFinite(count)) {
        if (/^1d$/i.test(raw)) {
          count = await app._roll('1d6');
        } else if (/^2d$/i.test(raw)) {
          count = await app._roll('2d6');
        } else {
          count = 1;
        }
      }
      const safeCount = Math.max(0, count);
      for (let i = 0; i < safeCount; i++) {
        app.charState.materialBenefits.push('Ship Share');
      }
      app.charState.log.push(`Material: ${safeCount} Ship Share(s)`);
      app._log('Material', `${safeCount} Ship Share(s)`);
      reportAutoHandled(report, `${safeCount} Ship Share(s)`);
      return true;
    }

    // 3. Social / Narrative tags — CONTACT, FRIEND, ENEMY, ALLY (and typed variants)
    const socialBase = _parseSocialTag(tag);
    if (socialBase) {
      const { base, typedLabel } = socialBase;
      const list =
        base === 'CONTACT'
          ? 'contacts'
          : base === 'ENEMY'
            ? 'enemies'
            : base === 'ALLY'
              ? 'allies'
              : 'friends';
      const descPrefix = description.split('[')[0].trim();
      // Standalone tags like "[CONTACT]" (used in CDEE structured onSuccess) have no prose prefix;
      // still record an entry so actor Contacts / friends / enemies are populated.
      const entryText = typedLabel || descPrefix
        || game.i18n.localize(
          base === 'ALLY'
            ? 'TWODSIX.CharGen.Tag.Ally'
            : base === 'FRIEND'
              ? 'TWODSIX.CharGen.Tag.Friend'
              : base === 'ENEMY'
                ? 'TWODSIX.CharGen.Tag.Enemy'
                : 'TWODSIX.CharGen.Tag.Contact',
        );
      if (entryText && app.charState[list] != null) {
        app.charState[list].push(entryText);
        const roleKey =
          base === 'ALLY'
            ? 'TWODSIX.CharGen.Tag.Ally'
            : base === 'FRIEND'
              ? 'TWODSIX.CharGen.Tag.Friend'
              : base === 'ENEMY'
                ? 'TWODSIX.CharGen.Tag.Enemy'
                : 'TWODSIX.CharGen.Tag.Contact';
        const roleLabel = game.i18n.localize(roleKey);
        const humanLabel = typedLabel ? `${roleLabel}: ${typedLabel}` : roleLabel;
        app._log(roleLabel, entryText.slice(0, 60));
        app.charState.log.push(game.i18n.format('TWODSIX.CharGen.Tag.GainedSocial', { label: humanLabel }));
        reportAutoHandled(report, typedLabel ? `${roleLabel}: ${typedLabel}` : roleLabel);
      }
      return true;
    }

    return false;
  }

  async _pickSpecialization(app, name) {
    return app._choose(
      game.i18n.format('TWODSIX.CharGen.Steps.Specialize', { skill: name }),
      optionsFromStrings(this.cascadeSkills[name], { sort: true }),
    );
  }

  _splitAlternativeSkillNames(raw) {
    const source = String(raw ?? '').trim();
    if (!source) {
      return [];
    }
    return source
      .split(/\s*(?:\/|\bor\b)\s*/i)
      .map(v => v.trim())
      .filter(Boolean);
  }

  async _resolveSingleSkillName(app, raw) {
    const name = String(raw ?? '').trim();
    if (!name) {
      return null;
    }
    if (this.skillNameMap[name]) {
      return this.skillNameMap[name];
    }
    if (name in this.cascadeSkills) {
      return this._pickSpecialization(app, name);
    }
    return name;
  }

  async _resolveSkillName(app, raw) {
    const options = this._splitAlternativeSkillNames(raw);
    if (options.length > 1) {
      const choice = await app._choose(
        `Choose one: ${String(raw ?? '').trim()}`,
        optionsFromStrings(options, { sort: false }),
        { preserveOptionOrder: true },
      );
      return this._resolveSingleSkillName(app, choice);
    }
    return this._resolveSingleSkillName(app, raw);
  }

  /**
   * Resolve cascades/specializations and set the skill to at least `level`.
   * @param {*} app
   * @param {string} rawName
   * @param {number} level
   * @returns {Promise<string|null>} Resolved skill name, or null if unresolved
   */
  async _addSkillAtLevel(app, rawName, level) {
    const name = await this._resolveSkillName(app, rawName);
    if (!name) {
      return null;
    }
    if (isJoatSkillName(name)) {
      const state = app.charState;
      state.joat = Math.max(state.joat ?? 0, level);
      return name;
    }
    await this.setSkillAtLeast(app, name, level);
    return name;
  }

  /**
   * Resolve cascades/specializations and improve the skill by one step (see {@link #improveSkill}).
   * CDEE/SOC may override for cascade alternatives or richer return values for logging.
   * @param {*} app
   * @param {string} rawName
   * @returns {Promise<void|{ name: string, level: number }|undefined>} Base implementation returns nothing
   */
  async _addOrImproveSkill(app, rawName) {
    const name = await this._resolveSkillName(app, rawName);
    if (!name) {
      return;
    }
    await this.improveSkill(app, name);
  }

  async _applyTableEntry(app, entry) {
    const state = app.charState;
    // Try underscore characteristic format first (e.g. INT_PLUS1, DEX_PLUS1 from career personal development tables)
    if (this._applyCharacteristicTag(app, entry)) {
      return;
    }
    const charKey = resolveCharKey(entry);
    if (charKey) {
      adjustChar(state, charKey, 1); // capped at 15
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

// ─── MODULE-LEVEL HELPERS ─────────────────────────────────────────────────────

/**
 * Parse a SKILL tag into { skillName, level }.
 * Canonical: `SKILL:Name:Level`. Legacy two-part `SKILL:Name-Level` (e.g. Bribery-1) is still parsed for
 * older world/custom compendiums; bundled packs use the canonical form only.
 */
export function _parseSkillTag(tag) {
  const parts = tag.split(':');
  if (parts.length >= 3) {
    return { skillName: parts[1], level: parseInt(parts[2], 10) || 1 };
  }
  const raw = parts[1] ?? '';
  const hyphenIdx = raw.lastIndexOf('-');
  if (hyphenIdx > 0) {
    const maybeLevel = parseInt(raw.slice(hyphenIdx + 1), 10);
    if (!Number.isNaN(maybeLevel)) {
      return { skillName: raw.slice(0, hyphenIdx), level: maybeLevel };
    }
  }
  return { skillName: raw, level: 1 };
}

/**
 * Detect social tags (CONTACT, FRIEND, ENEMY) in plain or typed form.
 * Returns null if the tag is not a social tag.
 * Returns { base: 'CONTACT'|'FRIEND'|'ENEMY'|'ALLY', typedLabel: string|null }.
 */
export function _parseSocialTag(tag) {
  if (tag === 'ALLY' || tag.startsWith('ALLY:')) {
    return {
      base: 'ALLY',
      typedLabel: tag.startsWith('ALLY:') ? tag.slice(5).trim() || null : null,
    };
  }
  for (const base of ['CONTACT', 'FRIEND', 'ENEMY']) {
    if (tag === base) {
      return { base, typedLabel: null };
    }
    if (tag.startsWith(base + ':')) {
      return { base, typedLabel: tag.slice(base.length + 1).trim() || null };
    }
  }
  return null;
}

/**
 * Humanize one mechanic tag using only rules shared by every ruleset (characteristics,
 * SKILL:*, CONTACT/FRIEND/ENEMY including typed forms). Used by {@link BaseCharGenLogic#_humanizeTag}.
 * Subclass-specific tags return null here.
 * @param {string} tag - Bracket contents, e.g. `CONTACT`, `SKILL:Admin:1`, `SOC_MINUS1`
 * @returns {string|null} Localized label, or null if not a shared tag
 */
export function baseHumanizeMechanicTag(tag) {
  if (tag == null || tag === '') {
    return null;
  }
  const i18n = game?.i18n;

  const charMatch = tag.match(/^(STR|DEX|END|INT|EDU|SOC)_(PLUS|MINUS)(-?\d+)$/);
  if (charMatch) {
    const sign = charMatch[2] === 'PLUS' ? '+' : '−';
    if (i18n) {
      const charLabel = i18n.localize(`TWODSIX.CharGen.Chars.${charMatch[1]}`);
      return `${charLabel} ${sign}${charMatch[3]}`;
    }
    return `${charMatch[1]} ${sign}${charMatch[3]}`;
  }

  if (tag.startsWith('SKILL:')) {
    const { skillName, level } = _parseSkillTag(tag);
    return `${skillName}-${level}`;
  }

  if (tag.startsWith('BENEFIT_DM:')) {
    const n = tag.slice('BENEFIT_DM:'.length);
    if (i18n) {
      return i18n.format('TWODSIX.CharGen.CDEE.TagBenefitDM', { n });
    }
    return `Benefit DM +${n}`;
  }

  if (tag.startsWith('CHOOSE_SKILL:')) {
    const list = tag.slice('CHOOSE_SKILL:'.length);
    const or = i18n ? i18n.localize('TWODSIX.CharGen.ListOr') : ' or ';
    return list.split(',').join(or);
  }

  if (tag === 'IMPROVE_CHECK_SKILL') {
    return i18n ? i18n.localize('TWODSIX.CharGen.Tag.ImproveCheckSkill') : '+1 checked skill';
  }
  if (tag === 'SHIP_SHARE') {
    return i18n ? i18n.localize('TWODSIX.CharGen.Tag.ShipShare') : 'Ship Share';
  }
  if (tag.startsWith('SHIP_SHARE:') || tag.startsWith('SHIP_SHARES:')) {
    const raw = tag.split(':')[1] ?? '1';
    if (/^\d+$/u.test(raw)) {
      const n = Number.parseInt(raw, 10);
      return `${n} Ship Share(s)`;
    }
    if (/^1d$/i.test(raw)) {
      return '1D Ship Shares';
    }
    if (/^2d$/i.test(raw)) {
      return '2D Ship Shares';
    }
    return 'Ship Shares';
  }

  const soc = _parseSocialTag(tag);
  if (soc) {
    if (!i18n) {
      return soc.typedLabel ? `${soc.base}: ${soc.typedLabel}` : soc.base;
    }
    const baseKey =
      soc.base === 'ALLY'
        ? 'TWODSIX.CharGen.Tag.Ally'
        : soc.base === 'FRIEND'
          ? 'TWODSIX.CharGen.Tag.Friend'
          : soc.base === 'ENEMY'
            ? 'TWODSIX.CharGen.Tag.Enemy'
            : 'TWODSIX.CharGen.Tag.Contact';
    const baseLabel = i18n.localize(baseKey);
    if (soc.typedLabel) {
      return `${baseLabel}: ${soc.typedLabel}`;
    }
    return baseLabel;
  }

  return null;
}
