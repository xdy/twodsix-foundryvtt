export const INTERMEDIATE_RANGE_MODIFIER = -2;

const METERS_PER_UNIT = Object.freeze({
  cm: 0.01,
  ft: 0.3048,
  feet: 0.3048,
  in: 0.0254,
  inch: 0.0254,
  inches: 0.0254,
  km: 1000,
  m: 1,
  meter: 1,
  meters: 1,
  mm: 0.001,
  yd: 0.9144,
  yard: 0.9144,
  yards: 0.9144
});

/**
 * Format Strength-derived thrown range limits as "effective/maximum".
 * @param {{effectiveRange: number, maximumRange: number}} limits Limits in meters
 * @param {string} [locale] Locale used for number formatting
 * @returns {string}
 */
export function formatThrownRangeLimits({effectiveRange, maximumRange}, locale) {
  return [effectiveRange, maximumRange]
    .map((value) => value.toLocaleString(locale, {maximumFractionDigits: 1}))
    .join('/');
}

function hasExplicitRange(weaponRange) {
  const rangeValues = typeof weaponRange === 'number'
    ? [weaponRange]
    : typeof weaponRange === 'string'
      ? weaponRange.split('/', 2).map((value) => parseFloat(value))
      : [];
  return rangeValues.some((value) => Number.isFinite(value) && value > 0);
}

/**
 * Calculate the derivative ruleset range modifier for a thrown weapon.
 * @param {object} options
 * @param {number} options.range Measured distance in the scene's units
 * @param {string} options.weaponType Weapon's type label
 * @param {string} options.rangeBand Legacy range label used to identify existing thrown items
 * @param {string|number} options.weaponRange Stored weapon range; zero may be a placeholder for thrown weapons
 * @param {{effective: number, maximum: number}} [options.thrownRange] Ruleset Strength multipliers for thrown range
 * @param {string} options.rangeModifierType Active range modifier mode
 * @param {number} options.strength Actor's current Strength
 * @param {string} options.units Scene distance units
 * @param {boolean} [options.isAOE] Whether the attack targets an area
 * @returns {{rangeModifier: number, rollType: string, effectiveRange?: number, maximumRange?: number}|undefined}
 */
export function getThrownWeaponRangeData({range, weaponType, rangeBand, weaponRange, thrownRange, rangeModifierType, strength, units, isAOE = false}) {
  const isThrownWeapon = weaponType?.trim().toLowerCase() === 'thrown' ||
    rangeBand?.trim().toLowerCase().startsWith('thrown');
  if (!isThrownWeapon || hasExplicitRange(weaponRange) || rangeModifierType !== 'doubleBand') {
    return undefined;
  }

  const multipliers = thrownRange;
  if (!multipliers) {
    return undefined;
  }

  if (!Number.isFinite(strength)) {
    return {rangeModifier: 0, rollType: 'Normal'};
  }

  const unitMultiplier = METERS_PER_UNIT[units?.trim().toLowerCase()] ?? 1;
  const effectiveRange = Math.max(0, strength) * multipliers.effective;
  const maximumRange = Math.max(0, strength) * multipliers.maximum;
  if (!Number.isFinite(range)) {
    return {rangeModifier: 0, rollType: 'Normal', effectiveRange, maximumRange};
  }

  const rangeInMeters = range * unitMultiplier;
  const rangeModifier = rangeInMeters <= effectiveRange
    ? 0
    : rangeInMeters <= maximumRange
      ? isAOE ? 0 : INTERMEDIATE_RANGE_MODIFIER
      : -99;

  return {rangeModifier, rollType: 'Normal', effectiveRange, maximumRange};
}
