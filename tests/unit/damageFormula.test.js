import { describe, expect, test } from 'vitest';
import { addEffectToDamageFormula, referencesEffect } from '../../src/module/utils/damageFormula.js';

describe('damageFormula.js', () => {
  test('recognizes a standalone @effect reference', () => {
    expect(referencesEffect('2d6 + @effect')).toBe(true);
    expect(referencesEffect('2d6 + @effect * 2')).toBe(true);
    expect(referencesEffect('2d6 + @effectiveness')).toBe(false);
    expect(referencesEffect('2d6 + @effect.value')).toBe(false);
  });

  test('adds the automatic effect only when it is not explicitly referenced', () => {
    expect(addEffectToDamageFormula('2d6', 3, true)).toBe('2d6 + 3');
    expect(addEffectToDamageFormula('2d6 + @effect', 3, true)).toBe('2d6 + @effect');
  });

  test('leaves the formula unchanged when disabled or effect is zero', () => {
    expect(addEffectToDamageFormula('2d6', 3, false)).toBe('2d6');
    expect(addEffectToDamageFormula('2d6', 0, true)).toBe('2d6');
  });
});
