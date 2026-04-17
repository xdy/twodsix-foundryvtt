import { describe, expect, test } from 'vitest';
import {
  simplifySkillName,
  ObjectbyString,
  sortObj,
  addSign,
  capitalizeFirstLetter,
  roundToDecimal,
  roundToMaxDecimals,
  getKeyByValue,
  cleanSystemReferences,
  toHex
} from '../../src/module/utils/utils.js';
import Crit from '../../src/module/utils/crit.js';

describe('utils.js pure functions', () => {
  test('simplifySkillName removes non-word chars', () => {
    expect(simplifySkillName('Laser Pistol')).toBe('LaserPistol');
    expect(simplifySkillName('Combat Rifle - AP')).toBe('CombatRifleAP');
    expect(simplifySkillName('')).toBe('');
  });

  test('ObjectbyString resolves dot/bracket paths', () => {
    const obj = { a: { b: 1 }, c: [10, 20, 30] };
    expect(ObjectbyString(obj, 'a.b')).toBe(1);
    expect(ObjectbyString(obj, 'c[1]')).toBe(20);
    expect(ObjectbyString(obj, 'a.missing')).toBeUndefined();
    expect(ObjectbyString({}, '')).toBeUndefined();
  });

  test('sortObj sorts object keys alphabetically', () => {
    expect(sortObj({ b: 2, a: 1 })).toEqual({ a: 1, b: 2 });
    expect(sortObj({})).toEqual({});
    expect(sortObj({ c: 3, a: 1, b: 2 })).toEqual({ a: 1, b: 2, c: 3 });
  });

  test('addSign formats number with sign', () => {
    expect(addSign(0)).toBe('');
    expect(addSign(5)).toBe('+5');
    expect(addSign(-3)).toBe('-3');
    expect(addSign(10)).toBe('+10');
  });

  test('capitalizeFirstLetter capitalizes first char', () => {
    expect(capitalizeFirstLetter('hello')).toBe('Hello');
    expect(capitalizeFirstLetter('')).toBe('');
    expect(capitalizeFirstLetter('a')).toBe('A');
  });

  test('roundToDecimal rounds to fixed decimals', () => {
    expect(roundToDecimal(1.2345, 2)).toBe(1.23);
    expect(roundToDecimal(1.235, 2)).toBe(1.24);
    expect(roundToDecimal(-1.2345, 2)).toBe(-1.23);
    expect(roundToDecimal(0, 2)).toBe(0);
  });

  test('roundToMaxDecimals caps decimals by number size', () => {
    expect(roundToMaxDecimals(123.456, 2)).toBe(123);
    expect(roundToMaxDecimals(1.2345, 2)).toBe(1.23);
    expect(roundToMaxDecimals(0.123, 2)).toBe(0.12);
  });

  test('getKeyByValue finds key by JSON-serialized value', () => {
    expect(getKeyByValue({ a: 1, b: 2 }, 2)).toBe('b');
    expect(getKeyByValue({ a: 'foo' }, 'foo')).toBe('a');
    expect(getKeyByValue({}, 1)).toBeUndefined();
    expect(getKeyByValue({ a: [1,2] }, [1,2])).toBe('a');
    expect(getKeyByValue({}, 'NONE')).toBeUndefined();
  });

  test('cleanSystemReferences strips @system. prefixes', () => {
    expect(cleanSystemReferences('@system.foo')).toBe('@foo');
    expect(cleanSystemReferences('1d6 + @system.bar')).toBe('1d6 + @bar');
    expect(cleanSystemReferences('no ref')).toBe('no ref');
    expect(cleanSystemReferences(123)).toBe(123);
  });

  test('toHex converts 0-15 to hex char', () => {
    expect(toHex(0)).toBe('0');
    expect(toHex(9)).toBe('9');
    expect(toHex(10)).toBe('A');
    expect(toHex(15)).toBe('F');
  });
});

describe('crit.js constant', () => {
  test('Crit has correct frozen values', () => {
    expect(Crit.neither).toBe(0);
    expect(Crit.success).toBe(1);
    expect(Crit.fail).toBe(2);
    expect(Object.keys(Crit)).toHaveLength(3);
    expect(Object.isFrozen(Crit)).toBe(true);
  });
});
