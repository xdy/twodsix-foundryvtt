/**
 * Whether a formula references the top-level effect roll-data value.
 * @param {string} formula
 * @returns {boolean}
 */
export function referencesEffect(formula) {
  return /@effect(?![\w.])/i.test(formula);
}

/**
 * Add automatic attack effect unless the formula already uses @effect.
 * @param {string} formula
 * @param {number} effect
 * @param {boolean} enabled
 * @returns {string}
 */
export function addEffectToDamageFormula(formula, effect, enabled) {
  if (!enabled || effect === 0 || referencesEffect(formula)) {
    return formula;
  }
  return `${formula} + ${effect}`;
}
