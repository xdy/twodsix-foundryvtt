const THROWN_RANGE_MULTIPLIERS = Object.freeze({
  CEL: {effective: 2, maximum: 4},
  CD: {effective: 4, maximum: 8},
  CDEE: {effective: 2, maximum: 4},
  CLU: {effective: 4, maximum: 8}
});

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
 * Calculate the derivative ruleset range modifier for a thrown weapon.
 * @param {object} options
 * @param {number} options.range Measured distance in the scene's units
 * @param {string} options.weaponType Weapon's type label
 * @param {string} options.rangeBand Legacy range label used to identify existing thrown items
 * @param {string} options.ruleset Active ruleset key
 * @param {string} options.rangeModifierType Active range modifier mode
 * @param {number} options.strength Actor's current Strength
 * @param {string} options.units Scene distance units
 * @returns {{rangeModifier: number, rollType: string, effectiveRange?: number, maximumRange?: number}|undefined}
 */
export function getThrownWeaponRangeData({range, weaponType, rangeBand, ruleset, rangeModifierType, strength, units}) {
  const isThrownWeapon = weaponType?.trim().toLowerCase() === 'thrown' ||
    rangeBand?.trim().toLowerCase().startsWith('thrown');
  if (!isThrownWeapon || rangeModifierType !== 'doubleBand') {
    return undefined;
  }

  const multipliers = THROWN_RANGE_MULTIPLIERS[ruleset];
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
      ? -2
      : -99;

  return {rangeModifier, rollType: 'Normal', effectiveRange, maximumRange};
}
