// speciesProfile.js — ruleset-agnostic helpers for chargen species / ancestry profiles
import { adjustChar, CHARACTERISTIC_KEYS } from './CharGenState.js';

/**
 * Apply characteristic deltas from a species profile (keys: str, dex, end, int, edu, soc).
 * @param {object} state - charState with `chars`
 * @param {Record<string, number>|null|undefined} deltas
 * @param {{ min?: number, max?: number }} [opts]
 */
export function applySpeciesCharacteristicDeltas(state, deltas, opts = {}) {
  if (!deltas || typeof deltas !== 'object') {
    return;
  }
  const { min = 0, max = 15 } = opts;
  for (const key of CHARACTERISTIC_KEYS) {
    const delta = deltas[key];
    if (typeof delta === 'number' && delta !== 0) {
      adjustChar(state, key, delta, { min, max });
    }
  }
}

/**
 * Bonus added to the aging roll before comparing to terms (e.g. SOC SRD long-lived species).
 * @param {{ agingRollBonus?: number }|null|undefined} profile
 * @returns {number}
 */
export function getSpeciesAgingRollBonus(profile) {
  const n = profile?.agingRollBonus;
  return typeof n === 'number' ? n : 0;
}
