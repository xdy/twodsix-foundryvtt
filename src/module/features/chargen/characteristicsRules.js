// characteristicsRules.js — Ruleset-aware characteristic UI / roll rules for CharGenApp
import { getCharGenRegistryEntry } from './CharGenRegistry.js';
import { DEFAULT_CHARACTERISTICS_UI_RULES } from './chargenUiDefaults.js';

/**
 * @typedef {Object} CharacteristicsUiRules
 * @property {boolean} isPointBuy
 * @property {number} inputMin - valid manual input minimum (template validation)
 * @property {number} inputMax - valid manual input maximum
 * @property {number|null} pointBuyTargetTotal - total points when point-buy; null otherwise
 */

/**
 * UI / roll rules for the characteristic row on the CharGen sheet.
 * Resolved from {@link CharGenRegistry} so new rulesets do not branch here.
 * @param {string} ruleset - TWODSIX ruleset key (e.g. CE, CDEE, CU)
 * @param {string|null} creationMode - e.g. CDEE 'pointbuy' | 'array' | CU mode strings
 * @returns {CharacteristicsUiRules}
 */
export function getCharacteristicsUiRules(ruleset, creationMode) {
  const entry = getCharGenRegistryEntry(ruleset);
  if (entry?.resolveCharacteristicsUiRules) {
    return entry.resolveCharacteristicsUiRules(creationMode ?? null);
  }
  return { ...DEFAULT_CHARACTERISTICS_UI_RULES };
}

/**
 * Random UPP: assign each characteristic 2–12 using 2d6.
 * @param {Record<string, number>} chars - state.chars (mutated)
 * @param {string[]} keys - characteristic keys in order
 * @returns {Promise<void>}
 */
export async function rollRandomCharacteristics(chars, keys) {
  for (const k of keys) {
    chars[k] = (await new Roll('2d6').roll()).total;
  }
}

/**
 * Point-buy random fill: delegated to the active ruleset registry entry when defined.
 * @param {Record<string, number>} chars - state.chars (mutated)
 * @param {string[]} keys
 * @param {{ ruleset: string, creationMode?: string|null }} opts
 * @returns {Promise<void>}
 */
export async function rollPointBuyCharacteristics(chars, keys, { ruleset, creationMode = null } = {}) {
  const entry = getCharGenRegistryEntry(ruleset);
  if (entry?.rollPointBuyCharacteristics) {
    await entry.rollPointBuyCharacteristics(chars, keys, creationMode);
  }
}
