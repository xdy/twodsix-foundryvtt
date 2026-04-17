// speciesProfile.js — ruleset-agnostic helpers for chargen species / ancestry profiles

/**
 * Bonus added to the aging roll before comparing to terms (e.g. SOC SRD long-lived species).
 * @param {{ agingRollBonus?: number }|null|undefined} profile
 * @returns {number}
 */
export function getSpeciesAgingRollBonus(profile) {
  const n = profile?.agingRollBonus;
  return typeof n === 'number' ? n : 0;
}
