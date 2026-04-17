// CharGenState.js — Character generation state management
import { LanguageType } from '../../utils/nameGenerator.js';
import { serializeEventReport } from './EventReport.js';

/**
 * Thrown (not returned) when a character dies during generation.
 * Caught in CharGenApp.run() to end generation cleanly.
 */
export const CHARGEN_DIED = Symbol('chargen-died');
/** Bumped when persisted chargen state shape changes (see {@link migrateLegacyChargenFields}). */
export const CHARGEN_STATE_VERSION = 3;

/** Version for `JournalEntry` flag `twodsix.charGenSession` snapshots. */
export const CHARGEN_SESSION_VERSION = 1;

/**
 * Standard characteristic keys used throughout character generation.
 */
export const CHARACTERISTIC_KEYS = ['str', 'dex', 'end', 'int', 'edu', 'soc'];

/**
 * Human-readable labels for characteristics.
 */
export const CHARACTERISTIC_LABELS = ['STR', 'DEX', 'END', 'INT', 'EDU', 'SOC'];

/**
 * Human-readable labels used in the decision log UI.
 */
export const CHARACTERISTICS_ROW_TYPE = 'Characteristics';
export const NAME_ROW_LABEL = 'Name';

/**
 * Stable row-type identifiers used by app logic and templates.
 * Keep behavior keyed to these values (not display labels) so localization or
 * wording changes do not alter control-flow semantics.
 */
export const CHARGEN_ROW_TYPES = {
  CHOICE: 'choice',
  CHARACTERISTICS: 'characteristics',
  NAME: 'name',
};

/**
 * Default objects merged into `state.chargenOverlay.<key>` when that bucket is first accessed
 * or when {@link ensureChargenOverlay} runs. Third-party rulesets can call
 * {@link registerChargenOverlayBucketDefaults} during `init` to register their namespace
 * (use a **lowercase** key, typically the ruleset registry key lowercased).
 * @type {Record<string, object>}
 */
const CHARGEN_OVERLAY_BUCKET_DEFAULTS = {
  cdee: { prisonTerms: 0 },
  soc: { chargenSpecies: null, chargenNotes: [] },
  cu: {},
};

/**
 * Merge or replace default field values for a chargen overlay bucket (e.g. `mybook`).
 * Call from `Hooks.once('init', …, { order })` after twodsix init if you register a new ruleset.
 * @param {string} overlayKey - Lowercase namespace (e.g. `'soc'`, `'mybook'`)
 * @param {object} partialDefaults - Shallow-merged into existing defaults for that key
 */
export function registerChargenOverlayBucketDefaults(overlayKey, partialDefaults) {
  const k = String(overlayKey || '').toLowerCase();
  if (!k) {
    return;
  }
  CHARGEN_OVERLAY_BUCKET_DEFAULTS[k] = foundry.utils.mergeObject(
    CHARGEN_OVERLAY_BUCKET_DEFAULTS[k] ?? {},
    partialDefaults ?? {},
    { inplace: false },
  );
}

function _createFreshChargenOverlay() {
  const o = {};
  for (const [key, defaults] of Object.entries(CHARGEN_OVERLAY_BUCKET_DEFAULTS)) {
    o[key] = foundry.utils.deepClone(defaults);
  }
  return o;
}

/**
 * Append a structured career EventReport (see {@link createEventReport} in EventReport.js) to state.
 * @param {object} state - charState
 * @param {object} report - mutable report object from {@link import('./EventReport.js').createEventReport}
 */
export function appendChargenEventReport(state, report) {
  const row = serializeEventReport(report);
  if (!row) {
    return;
  }
  if (!Array.isArray(state.chargenEventReports)) {
    state.chargenEventReports = [];
  }
  state.chargenEventReports.push(row);
}

/**
 * Character generation constants.
 * These can be overridden by ruleset-specific configurations in the future.
 */
export const CharGenConstants = {
  // Age settings
  STARTING_AGE: 18,

  // Crisis/Medical costs
  CRISIS_COST_MULTIPLIER: 10000, // Cost per point on crisis roll (1d6 * this)

  // Pension table (terms served -> annual pension)
  PENSION_ELIGIBILITY_TERMS: 5, // Minimum terms for pension
  PENSION_BASE: 10000, // Base pension per year at 5 terms
  PENSION_PER_TERM_INCREASE: 2000, // Additional pension per term above minimum

  // Pension formula: 5 terms -> 10,000; each additional term adds 2,000 indefinitely.
  getPensionForTerms(billableTerms) {
    if (billableTerms < this.PENSION_ELIGIBILITY_TERMS) {
      return 0;
    }
    return this.PENSION_BASE + (billableTerms - this.PENSION_ELIGIBILITY_TERMS) * this.PENSION_PER_TERM_INCREASE;
  },
};

/**
 * Creates a fresh character generation state object.
 * @returns {Object} Initial state for character generation
 */
export function freshState() {
  return {
    _schemaVersion: CHARGEN_STATE_VERSION,
    ruleset: 'CE',
    chars: { str: 0, dex: 0, end: 0, int: 0, edu: 0, soc: 0 },
    age: CharGenConstants.STARTING_AGE,
    gender: 'Male',
    skills: new Map(),
    joat: 0,
    careers: [],
    languageType: LanguageType.Humaniti,
    currentRank: 0,
    currentTermInCareer: 0,
    totalTerms: 0,
    hasBeenDrafted: false,
    previousCareers: [],
    qualFails: false,
    retired: false,          // set when character retires (5+ terms or mandatory); used for cash-benefit DM
    retireFromCareer: false, // set by crisis survival to force exit from current career term-loop
    medicalDebt: 0,
    pension: 0,
    cashBenefits: 0,
    cashRollsUsed: 0,
    materialBenefits: [],
    chosenWeapons: [],
    log: [],
    died: false,
    termHistory: [],
    homeworldDescriptors: [],
    optionalRules: {
      switchingCareers: false,
      agingTech: false,
      ironMan: false,
      skillLimits: false,
    },
    careerChanges: 0,
    // CU-specific state
    creationMode: null,
    friends: [],
    allies: [],
    enemies: [],
    contacts: [],
    traits: [],           // Selected trait names/ids (CDEE, SOC, …)
    benefitDMs: [],       // Accumulated DM values for muster-out rolls
    extraBenefitRolls: 0, // Additional muster-out rolls from BENEFIT_ROLL events
    /** Serialized {@link import('./EventReport.js').serializeEventReport} rows for actor bio / export. */
    chargenEventReports: [],
    /**
     * Ruleset-scoped chargen fields (serialization-friendly).
     * Legacy flat `prisonTerms` / `chargenSpecies` / `chargenNotes` are migrated in {@link deserializeCharGenState}.
     */
    chargenOverlay: _createFreshChargenOverlay(),
  };
}

/**
 * Ensure `state.chargenOverlay` exists with per-ruleset buckets (lowercase keys: cdee, soc, cu, …).
 * @param {object} state
 * @returns {object}
 */
export function ensureChargenOverlay(state) {
  if (!state.chargenOverlay || typeof state.chargenOverlay !== 'object') {
    state.chargenOverlay = _createFreshChargenOverlay();
  }
  for (const [key, defaults] of Object.entries(CHARGEN_OVERLAY_BUCKET_DEFAULTS)) {
    state.chargenOverlay[key] = foundry.utils.mergeObject(
      foundry.utils.deepClone(defaults),
      state.chargenOverlay[key] ?? {},
      { inplace: false },
    );
  }
  if (!Array.isArray(state.chargenOverlay.soc?.chargenNotes)) {
    state.chargenOverlay.soc.chargenNotes = [];
  }
  return state.chargenOverlay;
}

/**
 * Returns the overlay object for a ruleset namespace, creating an empty object if missing.
 * Use lowercase keys matching {@link CharGenRegistry} keys where possible (`cdee`, `soc`, `cu`).
 * @param {object} state
 * @param {string} overlayKey
 * @returns {object}
 */
export function getChargenOverlayBucket(state, overlayKey) {
  const o = ensureChargenOverlay(state);
  const k = String(overlayKey || '').toLowerCase();
  if (!k) {
    return o;
  }
  if (!o[k] || typeof o[k] !== 'object') {
    o[k] = {};
  }
  return o[k];
}

/**
 * Notes for actor sheet output (SOC species lines, etc.).
 * @param {object} state
 * @returns {string[]}
 */
export function getChargenNotesForActor(state) {
  return ensureChargenOverlay(state).soc.chargenNotes ?? [];
}

/**
 * Copy v1 flat fields into `chargenOverlay` and remove deprecated top-level keys.
 * @param {object} state
 */
export function migrateLegacyChargenFields(state) {
  const overlay = ensureChargenOverlay(state);
  if (Object.prototype.hasOwnProperty.call(state, 'prisonTerms') && state.prisonTerms != null) {
    overlay.cdee.prisonTerms = Number(state.prisonTerms) || 0;
    delete state.prisonTerms;
  }
  if (Object.prototype.hasOwnProperty.call(state, 'chargenSpecies')) {
    overlay.soc.chargenSpecies = state.chargenSpecies ?? null;
    delete state.chargenSpecies;
  }
  if (Object.prototype.hasOwnProperty.call(state, 'chargenNotes')) {
    overlay.soc.chargenNotes = Array.isArray(state.chargenNotes) ? [...state.chargenNotes] : [];
    delete state.chargenNotes;
  }
}

/**
 * Serialize chargen state to a persistence-safe shape.
 * @param {object} state
 * @returns {object}
 */
export function serializeCharGenState(state) {
  const snapshot = foundry.utils.deepClone(state ?? freshState());
  snapshot._schemaVersion = CHARGEN_STATE_VERSION;
  snapshot.skills = Array.from((state?.skills ?? new Map()).entries());
  migrateLegacyChargenFields(snapshot);
  return snapshot;
}

/**
 * Deserialize persisted chargen state into a normalized runtime shape.
 * @param {object|null|undefined} saved
 * @returns {object}
 */
export function deserializeCharGenState(saved) {
  const base = freshState();
  const merged = foundry.utils.mergeObject(base, foundry.utils.deepClone(saved ?? {}), {
    inplace: false,
    insertKeys: true,
    overwrite: true,
  });
  const savedSkills = saved?.skills;
  if (savedSkills instanceof Map) {
    merged.skills = new Map(savedSkills.entries());
  } else if (Array.isArray(savedSkills)) {
    merged.skills = new Map(savedSkills);
  } else if (savedSkills != null && typeof savedSkills === 'object' && !Array.isArray(savedSkills)) {
    console.warn(
      'twodsix | CharGen deserialization: skills is a plain object instead of Map or array; treating as empty.',
    );
    merged.skills = new Map();
  } else {
    merged.skills = new Map();
  }
  merged._schemaVersion = CHARGEN_STATE_VERSION;
  if (!Array.isArray(merged.chargenEventReports)) {
    merged.chargenEventReports = [];
  }
  if (!Array.isArray(merged.allies)) {
    merged.allies = [];
  }
  migrateLegacyChargenFields(merged);
  return merged;
}

/**
 * Adjust a characteristic value, clamped to [min, max].
 * Default min=0 lets a value reach 0 so crisis detection still fires;
 * callers that want to raise a char should pass max=15 (the PC hard cap).
 * @param {Object} state - charState
 * @param {string} key   - characteristic key e.g. 'str'
 * @param {number} delta - positive or negative adjustment
 * @param {Object} opts
 * @param {number} [opts.min=0]  - floor (0 to allow crisis detection)
 * @param {number} [opts.max=15] - ceiling (CE/CU hard cap is 15)
 */
export function adjustChar(state, key, delta, { min = 0, max = 15 } = {}) {
  state.chars[key] = Math.min(max, Math.max(min, (state.chars[key] ?? 0) + delta));
}

/**
 * State row for the UI display log.
 * @typedef {Object} CharGenRow
 * @property {string} label - Row label
 * @property {string|null} result - Row result value
 * @property {boolean} active - Whether row is awaiting user input
 * @property {Array} options - Available options for the row
 */

/**
 * Decision record for undo/redo.
 * @typedef {Object} CharGenDecision
 * @property {'roll'|'choice'} type - Decision type
 * @property {string|number} value - Decision value
 */
