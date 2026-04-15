// CharGenState.js — Character generation state management
import { LanguageType } from '../../utils/nameGenerator.js';

/**
 * Thrown (not returned) when a character dies during generation.
 * Caught in CharGenApp.run() to end generation cleanly.
 */
export const CHARGEN_DIED = Symbol('chargen-died');

/**
 * Standard characteristic keys used throughout character generation.
 */
export const CHARACTERISTIC_KEYS = ['str', 'dex', 'end', 'int', 'edu', 'soc'];

/**
 * Human-readable labels for characteristics.
 */
export const CHARACTERISTIC_LABELS = ['STR', 'DEX', 'END', 'INT', 'EDU', 'SOC'];

/**
 * Magic string constant for the characteristics row type.
 */
export const CHARACTERISTICS_ROW_TYPE = 'Characteristics';

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
  PENSION_BASE: 10000, // Base pension per 1000 credits
  PENSION_MAX_TERMS: 8, // Terms at which pension caps
  PENSION_PER_TERM_INCREASE: 2000, // Additional pension per term above base

  // Pension formula helper
  // 5 terms -> 10,000; each additional term adds 2,000; caps increase past 8 terms at 2,000/term
  getPensionForTerms(billableTerms) {
    if (billableTerms < this.PENSION_ELIGIBILITY_TERMS) {
      return 0;
    }
    const base = this.PENSION_BASE; // 10,000 for 5 terms
    if (billableTerms <= this.PENSION_MAX_TERMS) {
      return base + (billableTerms - this.PENSION_ELIGIBILITY_TERMS) * this.PENSION_PER_TERM_INCREASE;
    }
    return base + (this.PENSION_MAX_TERMS - this.PENSION_ELIGIBILITY_TERMS) * this.PENSION_PER_TERM_INCREASE
      + (billableTerms - this.PENSION_MAX_TERMS) * this.PENSION_PER_TERM_INCREASE;
  },
};

/**
 * Creates a fresh character generation state object.
 * @returns {Object} Initial state for character generation
 */
export function freshState() {
  return {
    ruleset: 'CE',
    chars: { str: 0, dex: 0, end: 0, int: 0, edu: 0, soc: 0 },
    age: CharGenConstants.STARTING_AGE,
    gender: 'Male',
    skills: new Map(),
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
    enemies: [],
    contacts: [],
    // CDEE-specific state
    traits: [],           // Selected trait names/ids
    prisonTerms: 0,       // Prison terms served (don't count for benefits)
    benefitDMs: [],       // Accumulated DM values for muster-out rolls
    extraBenefitRolls: 0, // Additional muster-out rolls from BENEFIT_ROLL events
  };
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
