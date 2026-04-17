// charGenMusterShared.js — Shared muster-benefit math for CDEE / SOC (CE uses per-career muster)

/**
 * One benefit roll per career record for (1 + terms) — CDEE and SOC both use this base count.
 * @param {{ careers: { terms: number }[] }} state
 * @returns {number}
 */
export function sumCareerMusterRollCountFromCareers(state) {
  return state.careers.reduce((acc, c) => acc + (1 + c.terms), 0);
}

/**
 * Clamp 1d6 + total DM into the 1–6 range used on cash/material benefit tables.
 * @param {number} roll1d6
 * @param {number} totalDm
 * @returns {number}
 */
export function clampMusterBenefit1d6(roll1d6, totalDm) {
  return Math.min(6, Math.max(1, roll1d6 + totalDm));
}
