import {afterEach, describe, expect, test, vi} from 'vitest';
import {formatThrownRangeLimits, getThrownWeaponRangeData, INTERMEDIATE_RANGE_MODIFIER} from '../../src/module/utils/thrownWeaponRange.js';

vi.mock('../../src/module/config.js', () => ({
  TWODSIX: {RULESETS: {AC: {thrownRange: {effective: 2, maximum: 4}}}}
}));
vi.mock('../../src/module/utils/targetModifiers.js', () => ({getTargetStatusModifiers: vi.fn()}));
vi.mock('../../src/module/utils/TwodsixRollSettings.js', () => ({TwodsixRollSettings: class {}}));
vi.mock('../../src/module/utils/utils.js', () => ({getCharacteristicFromDisplayLabel: vi.fn()}));
vi.mock('../../src/module/entities/items/GearItem.js', () => ({GearItem: class {}}));
vi.mock('../../src/module/entities/items/BaseItem.js', () => ({getValueFromRollFormula: vi.fn()}));

const {WeaponItem} = await import('../../src/module/entities/items/WeaponItem.js');

const thrownWeapon = {
  weaponType: 'Thrown',
  rangeModifierType: 'doubleBand',
  units: 'm'
};
const CD_THROWN_RANGE = {effective: 4, maximum: 8};

function createRifle() {
  const rifle = Object.create(WeaponItem.prototype);
  rifle.system = {
    weaponType: 'Ranged',
    rangeBand: 'rifle',
    range: '100/400',
    useConsumableForAttack: '',
    meleeRangeModifier: ''
  };
  return rifle;
}

function setRangeMode(rangeModifierType) {
  vi.stubGlobal('game', {
    settings: {
      get: (_namespace, setting) => ({
        rangeModifierType,
        ruleset: 'AC',
        meleeRange: 1.5,
        termForAdvantage: 'advantage',
        termForDisadvantage: 'disadvantage'
      })[setting]
    }
  });
  vi.stubGlobal('canvas', {scene: {grid: {units: 'm'}}});
}

afterEach(() => vi.unstubAllGlobals());

describe('derivative thrown weapon ranges', () => {
  test.each([
    ['doubleBand', 'rifle', 100, 0],
    ['doubleBand', 'rifle', 200, -2],
    ['doubleBand', 'rifle', 401, -99],
    ['singleBand', 'rifle', 25, 1],
    ['singleBand', 'rifle', 200, -2],
    ['CE_Bands', 'rifle', 10, 0],
    ['CT_Bands', 'rifle', 5, 1],
    ['CU_Bands', 'long', 100, 0],
    ['none', 'rifle', 401, 0]
  ])('keeps regular rifle behavior for %s at %sm', (rangeModifierType, weaponBand, range, expectedModifier) => {
    setRangeMode(rangeModifierType);
    const result = createRifle().getRangeModifier(range, weaponBand, false);
    expect(result.rangeModifier).toBe(expectedModifier);
  });

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
    expect(getModifier(effectiveRange + 0.1)).toBe(-2);
    expect(getModifier(maximumRange)).toBe(-2);
    expect(getModifier(maximumRange + 0.1)).toBe(-99);
  });

  test('keeps AoE STR throws unpenalized between effective and maximum range', () => {
    expect(getThrownWeaponRangeData({
      ...thrownWeapon,
      range: 30,
      thrownRange: CD_THROWN_RANGE,
      strength: 6,
      isAOE: true
    }).rangeModifier).toBe(0);
  });

  test('uses fixed numeric ranges instead of the STR fallback', () => {
    expect(getThrownWeaponRangeData({
      ...thrownWeapon,
      range: 30,
      weaponRange: '15/35m',
      thrownRange: CD_THROWN_RANGE,
      strength: 6
    })).toBeUndefined();
  });

  test('allows a zero placeholder for thrown STR ranges but not other weapons', () => {
    expect(getThrownWeaponRangeData({
      ...thrownWeapon,
      range: 30,
      weaponRange: '0',
      thrownRange: CD_THROWN_RANGE,
      strength: 6
    }).rangeModifier).toBe(-2);
    expect(getThrownWeaponRangeData({
      ...thrownWeapon,
      range: 20,
      weaponRange: '0',
      thrownRange: CD_THROWN_RANGE,
      strength: 6,
      weaponType: 'Ranged',
      rangeBand: 'rifle'
    })).toBeUndefined();
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
      weaponType: 'Ranged',
      weaponRange: '0'
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
