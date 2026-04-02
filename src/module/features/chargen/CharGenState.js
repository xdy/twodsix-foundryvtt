// CharGenState.js — Character generation state management
import { LanguageType } from '../../utils/nameGenerator.js';

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
  TERM_DURATION: 4, // Years per term

  // Aging thresholds
  AGING_START_AGE: 34, // Age when aging effects begin
  MANDATORY_RETIREMENT_TERMS: 7, // Terms before forced retirement

  // Crisis/Medical costs
  CRISIS_COST_MULTIPLIER: 10000, // Cost per point on crisis roll (1d6 * this)
  LEGAL_DEBT_AMOUNT: 10000, // Mishap result 3 debt

  // Pension table (terms served -> annual pension)
  PENSION_ELIGIBILITY_TERMS: 5, // Minimum terms for pension
  PENSION_BASE: 10000, // Base pension per 1000 credits
  PENSION_MAX_TERMS: 8, // Terms at which pension caps
  PENSION_PER_TERM_INCREASE: 2000, // Additional pension per term above base

  // Skill counts
  DEFAULT_BACKGROUND_SKILLS: 3,
  MAX_HOMEWORLD_SKILLS: 2,

  // Draft/imprisonment
  IMPRISONMENT_YEARS: 4,

  // Mishap severity
  MISHAP_BENEFITS_LOST_THRESHOLD: 4, // mr >= 4 means benefits lost

  // Injuries
  SEVERELY_INJURED_ROLLS: [2],
  NEARLY_KILLED_ROLLS: [1],

  // Ship shares
  SHIP_SHARES_ROLL: '1d6',

  // Minimum characteristic value
  MIN_CHAR_VALUE: 0,
  MAX_CHAR_VALUE: 15,

  // Qualification DM per previous career
  QUAL_DM_PER_PREVIOUS_CAREER: 2,

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
    // CU-specific state
    creationMode: null,
    friends: [],
    enemies: [],
    contacts: [],
  };
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
