/**
 * Shared chargen constants used by multiple rulesets when SRD tables match (e.g. CE / CDEE / SOC aging bands).
 * Do not dedupe tables that differ by edition—only reference here when values are intentionally identical.
 */
export const SHARED_AGING_TABLE = [
  { phys: [2, 2, 2], mental: 1 },
  { phys: [2, 2, 2], mental: 0 },
  { phys: [2, 2, 1], mental: 0 },
  { phys: [2, 1, 1], mental: 0 },
  { phys: [1, 1, 1], mental: 0 },
  { phys: [1, 1, 0], mental: 0 },
  { phys: [1, 0, 0], mental: 0 },
  null
];

export const PHYS_OPTS = [
  { value: 'str', label: 'Strength' },
  { value: 'dex', label: 'Dexterity' },
  { value: 'end', label: 'Endurance' }
];

export const MENT_OPTS = [
  { value: 'int', label: 'Intelligence' },
  { value: 'edu', label: 'Education' },
  { value: 'soc', label: 'Social Standing' }
];

export const ALL_CHAR_OPTS = [...PHYS_OPTS, ...MENT_OPTS];

/**
 * Normalizes characteristic keys from various formats.
 * Handles '+1 Str', '+1 STR', '+2 END', etc.
 * @param {string} entry
 * @returns {string|null} The lowercase characteristic key (str, dex, end, int, edu, soc)
 */
export function resolveCharKey(entry) {
  if (!entry) {
    return null;
  }
  const match = entry.match(/\+(\d+)\s+(STR|DEX|END|INT|EDU|SOC)/i);
  return match ? match[2].toLowerCase() : null;
}
