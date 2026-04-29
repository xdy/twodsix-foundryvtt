// characteristicsRules.js — Ruleset-aware characteristic UI / roll rules for CharGenApp
import {
  CDEE_POINT_BUY_MAXIMUM_VALUE,
  CDEE_POINT_BUY_MINIMUM_VALUE,
  CDEE_POINTBUY_MAX_POINTS,
} from './CDEECharGenConstants.js';

/**
 * @typedef {Object} CharacteristicsUiRules
 * @property {boolean} isPointBuy
 * @property {number} inputMin - valid manual input minimum (template validation)
 * @property {number} inputMax - valid manual input maximum
 * @property {number|null} pointBuyTargetTotal - total points when point-buy; null otherwise
 */

/**
 * UI / roll rules for the characteristic row on the CharGen sheet.
 * @param {string} ruleset - TWODSIX ruleset key (e.g. CE, CDEE, CU)
 * @param {string|null} creationMode - e.g. CDEE 'pointbuy' | 'array' | CU mode strings
 * @returns {CharacteristicsUiRules}
 */
export function getCharacteristicsUiRules(ruleset, creationMode) {
  const isCdeePointBuy = ruleset === 'CDEE' && creationMode === 'pointbuy';
  return {
    isPointBuy: isCdeePointBuy,
    inputMin: isCdeePointBuy ? CDEE_POINT_BUY_MINIMUM_VALUE : 1,
    inputMax: isCdeePointBuy ? CDEE_POINT_BUY_MAXIMUM_VALUE : 15,
    pointBuyTargetTotal: isCdeePointBuy ? CDEE_POINTBUY_MAX_POINTS : null,
  };
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
 * CDEE point-buy random fill: start at minimum, distribute remaining points randomly up to max.
 * @param {Record<string, number>} chars - state.chars (mutated)
 * @param {string[]} keys
 * @returns {Promise<void>}
 */
export async function rollPointBuyCharacteristics(chars, keys) {
  for (const k of keys) {
    chars[k] = CDEE_POINT_BUY_MINIMUM_VALUE;
  }
  let remaining =
    CDEE_POINTBUY_MAX_POINTS - CDEE_POINT_BUY_MINIMUM_VALUE * keys.length;
  while (remaining > 0) {
    const idx = (await new Roll(`1d${keys.length}`).roll()).total - 1;
    const k = keys[idx];
    if (chars[k] < CDEE_POINT_BUY_MAXIMUM_VALUE) {
      chars[k]++;
      remaining--;
    }
  }
}
