import {describe, expect, test} from 'vitest';
import {formatThrownRangeLimits, getThrownWeaponRangeData, INTERMEDIATE_RANGE_MODIFIER} from '../../src/module/utils/thrownWeaponRange.js';

const thrownWeapon = {
  weaponType: 'Thrown',
  rangeModifierType: 'doubleBand',
  units: 'm'
};
const CD_THROWN_RANGE = {effective: 4, maximum: 8};

describe('derivative thrown weapon ranges', () => {
  test.each([
    ['CEL', 2, 4],
    ['CDEE', 2, 4],
    ['CD', 4, 8],
    ['CLU', 4, 8],
    ['CEFTL', 1, 2],
    ['AC', 2, 4]
  ])('%s uses its ruleset Strength multipliers', (_ruleset, effectiveMultiplier, maximumMultiplier) => {
    const effectiveRange = 6 * effectiveMultiplier;
    const maximumRange = 6 * maximumMultiplier;
    const getModifier = (range) => getThrownWeaponRangeData({
      ...thrownWeapon,
      range,
      thrownRange: {effective: effectiveMultiplier, maximum: maximumMultiplier},
      strength: 6
    }).rangeModifier;

    expect(getModifier(effectiveRange)).toBe(0);
    expect(getModifier(effectiveRange + 0.1)).toBe(INTERMEDIATE_RANGE_MODIFIER);
    expect(getModifier(maximumRange)).toBe(INTERMEDIATE_RANGE_MODIFIER);
    expect(getModifier(maximumRange + 0.1)).toBe(-99);
  });

  test('uses current Strength and converts feet to meters', () => {
    const rangeData = getThrownWeaponRangeData({
      ...thrownWeapon,
      range: 40,
      thrownRange: CD_THROWN_RANGE,
      strength: 3,
      units: 'ft'
    });

    expect(rangeData.effectiveRange).toBe(12);
    expect(rangeData.maximumRange).toBe(24);
    expect(rangeData.rangeModifier).toBe(INTERMEDIATE_RANGE_MODIFIER);
  });

  test('does not apply to non-thrown weapons, rulesets without multipliers, or non-double-band modes', () => {
    expect(getThrownWeaponRangeData({
      ...thrownWeapon,
      range: 100,
      thrownRange: CD_THROWN_RANGE,
      strength: 6,
      weaponType: 'Demolition'
    })).toBeUndefined();
    expect(getThrownWeaponRangeData({
      ...thrownWeapon,
      range: 100,
      strength: 6
    })).toBeUndefined();
    expect(getThrownWeaponRangeData({
      ...thrownWeapon,
      range: 100,
      thrownRange: CD_THROWN_RANGE,
      strength: 6,
      rangeModifierType: 'CE_Bands'
    })).toBeUndefined();
  });

  test('supports legacy explicit thrown range labels but not placed explosives', () => {
    const baseOptions = {
      range: 30,
      thrownRange: CD_THROWN_RANGE,
      rangeModifierType: 'doubleBand',
      strength: 6,
      weaponType: 'Ranged'
    };

    expect(getThrownWeaponRangeData({
      ...baseOptions,
      rangeBand: 'Thrown STR*4/STR*8'
    }).rangeModifier).toBe(INTERMEDIATE_RANGE_MODIFIER);
    expect(getThrownWeaponRangeData({
      ...baseOptions,
      rangeBand: 'placed'
    })).toBeUndefined();
  });

  test('does not make an infeasible result when current Strength is unavailable', () => {
    expect(getThrownWeaponRangeData({
      ...thrownWeapon,
      range: 100,
      thrownRange: CD_THROWN_RANGE,
      strength: undefined
    }).rangeModifier).toBe(0);
  });

  test('formats range limits as effective/maximum', () => {
    expect(formatThrownRangeLimits({effectiveRange: 24, maximumRange: 48}, 'en')).toBe('24/48');
    expect(formatThrownRangeLimits({effectiveRange: 7.25, maximumRange: 14.5}, 'en')).toBe('7.3/14.5');
  });

  test('returns dynamic limits when distance is unavailable for the chat label', () => {
    expect(getThrownWeaponRangeData({
      ...thrownWeapon,
      range: undefined,
      thrownRange: CD_THROWN_RANGE,
      strength: 6
    })).toMatchObject({
      rangeModifier: 0,
      effectiveRange: 24,
      maximumRange: 48
    });
  });
});
