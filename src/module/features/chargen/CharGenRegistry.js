// CharGenRegistry.js — Registry of rulesets that support character generation.
//
// Built-in rulesets are registered on `CHARGEN_REGISTRY`. Third-party modules can add
// entries during `init` via the `twodsix.registerCharGen` hook (see initializeCharGenRegistry).
//
// Extension contract summary: docs/agents/chargen.md

import { CDEECharGenLogic } from './rulesets/cdee/CDEECharGenLogic.js';
import { CECharGenLogic } from './rulesets/ce/CECharGenLogic.js';
import { DEFAULT_CHARACTERISTICS_UI_RULES } from './chargenUiDefaults.js';
import { CUCharGenLogic } from './rulesets/cu/CUCharGenLogic.js';
import { SOCCharGenLogic } from './rulesets/soc/SOCCharGenLogic.js';

// Re-export for callers that historically imported from this module.
export { DEFAULT_CHARACTERISTICS_UI_RULES } from './chargenUiDefaults.js';

// ─── CLASS INSTANCES (singletons) ───────────────────────────────────────────────

const ceLogic = new CECharGenLogic();
const cuLogic = new CUCharGenLogic();
const cdeeLogic = new CDEECharGenLogic();
const socLogic = new SOCCharGenLogic();

function canonicalizeChargenRulesetKey(rulesetKey) {
  return String(rulesetKey ?? '').trim().toUpperCase();
}

/**
 * @typedef {import('./characteristicsRules.js').CharacteristicsUiRules} CharacteristicsUiRules
 */

/**
 * @typedef {Object} CharGenPackIds
 * @property {string} itemPackId - Primary Item compendium for skills/weapons on actor create
 * @property {string} itemPackFallbackId
 * @property {string|null} [speciesPackId] - Species compendium; null = derive from ruleset key
 * @property {string|null} [speciesPackFallbackId]
 */

/**
 * @typedef {Object} SpeciesCharCaps
 * @property {number} min - Minimum characteristic value after species deltas
 * @property {number} max - Maximum characteristic value after species deltas (use `Infinity` to disable)
 */

/**
 * @typedef {Object} CharGenRegistryEntry
 * @property {import('./BaseCharGenLogic.js').BaseCharGenLogic} logic
 * @property {boolean} needsPreload
 * @property {string} [displayName] - Shown when `CONFIG.TWODSIX.RULESETS` has no name (e.g. hook-only rulesets)
 * @property {(state: object) => string[]} [getActorNotesLines] - Optional; overrides default SOC notes bucket for actor sheet
 * @property {(state: object) => string} [getActorSpeciesLabel] - Optional; non-empty sets `system.species` on actor create
 * @property {CharGenPackIds} packs
 * @property {SpeciesCharCaps} [speciesCharCaps] - Per-ruleset min/max applied during species delta application
 * @property {(creationMode: string|null) => CharacteristicsUiRules} resolveCharacteristicsUiRules
 * @property {(chars: Record<string, number>, keys: string[], creationMode: string|null) => Promise<void>} [rollPointBuyCharacteristics]
 */

function refreshChargenSupportedRuleSets() {
  CHARGEN_SUPPORTED_RULESETS.clear();
  for (const k of Object.keys(CHARGEN_REGISTRY)) {
    CHARGEN_SUPPORTED_RULESETS.add(k);
  }
}

/** @type {Record<string, CharGenRegistryEntry>} */
export const CHARGEN_REGISTRY = {
  CE: {
    logic: ceLogic,
    needsPreload: true,
    packs: {
      itemPackId: 'twodsix.ce-srd-items',
      itemPackFallbackId: 'twodsix.ce-srd-items',
    },
    resolveCharacteristicsUiRules: () => ({ ...DEFAULT_CHARACTERISTICS_UI_RULES }),
  },
  CU: {
    logic: cuLogic,
    needsPreload: false,
    packs: {
      itemPackId: 'twodsix.cepheus-universal-items',
      itemPackFallbackId: 'twodsix.ce-srd-items', // bad fit: CE items for CU
    },
    resolveCharacteristicsUiRules: () => ({ ...DEFAULT_CHARACTERISTICS_UI_RULES }),
  },
  CDEE: {
    logic: cdeeLogic,
    needsPreload: true,
    packs: {
      itemPackId: 'twodsix.cepheus-deluxe-enhanced-edition-items',
      itemPackFallbackId: 'twodsix.cepheus-deluxe-items', // bad fit: deluxe isn't CDEE
    },
    resolveCharacteristicsUiRules: m => cdeeLogic.resolveCharacteristicsUiRules(m),
    rollPointBuyCharacteristics: (chars, keys, m) => cdeeLogic.rollPointBuyCharacteristics(chars, keys, m),
  },
  SOC: {
    logic: socLogic,
    needsPreload: true,
    packs: {
      itemPackId: 'twodsix.sword-of-cepheus-items',
      itemPackFallbackId: 'twodsix.ce-srd-items', // bad fit: CE items for SOC
      speciesPackId: 'twodsix.sword-of-cepheus-items',
      speciesPackFallbackId: null,
    },
    getActorSpeciesLabel: state => socLogic.getActorSpeciesLabelForActor(state),
    resolveCharacteristicsUiRules: m => socLogic.resolveCharacteristicsUiRules(m),
    rollPointBuyCharacteristics: (chars, keys, m) => socLogic.rollPointBuyCharacteristics(chars, keys, m),
  },
};

/**
 * The set of ruleset keys that have chargen support (includes hook-registered rulesets after init).
 */
export const CHARGEN_SUPPORTED_RULESETS = new Set();
refreshChargenSupportedRuleSets();

/**
 * Display name for UI and actor header: registry `displayName`, else CONFIG ruleset name, else i18n default.
 * @param {string} rulesetKey
 * @returns {string}
 */
export function getChargenRulesetDisplayName(rulesetKey) {
  const entry = getCharGenRegistryEntry(rulesetKey);
  const custom = entry?.displayName?.trim();
  if (custom) {
    return custom;
  }
  const fromConfig = CONFIG.TWODSIX?.RULESETS?.[rulesetKey]?.name;
  if (fromConfig) {
    return fromConfig;
  }
  return game.i18n.localize('TWODSIX.CharGen.DefaultRulesetName');
}

/**
 * Rows for the CharGen ruleset `<select>`: all CONFIG rulesets plus chargen-only registered keys.
 * @returns {{ key: string, name: string, disabled: boolean }[]}
 */
export function getChargenRulesetPickerItems() {
  const supported = CHARGEN_SUPPORTED_RULESETS;
  const fromConfig = Object.values(CONFIG.TWODSIX?.RULESETS ?? {}).map(r => ({
    key: r.key,
    name: getChargenRulesetDisplayName(r.key),
    disabled: !supported.has(r.key),
  }));
  const configKeys = new Set(fromConfig.map(i => i.key));
  const extras = [];
  for (const key of supported) {
    if (!configKeys.has(key)) {
      extras.push({
        key,
        name: getChargenRulesetDisplayName(key),
        disabled: false,
      });
    }
  }
  extras.sort((a, b) => a.name.localeCompare(b.name));
  return [...fromConfig, ...extras];
}

/**
 * @param {string} [ruleset]
 * @returns {CharGenRegistryEntry|undefined}
 */
export function getCharGenRegistryEntry(ruleset) {
  const key = canonicalizeChargenRulesetKey(ruleset);
  return key ? CHARGEN_REGISTRY[key] : undefined;
}

/** @type {SpeciesCharCaps} */
const DEFAULT_SPECIES_CHAR_CAPS = Object.freeze({ min: 1, max: 15 });

/**
 * Resolve species characteristic caps for a ruleset (registry override > default `{min:1,max:15}`).
 * @param {string} ruleset
 * @returns {SpeciesCharCaps}
 */
export function getSpeciesCharCaps(ruleset) {
  const entry = getCharGenRegistryEntry(ruleset);
  const caps = entry?.speciesCharCaps;
  if (caps && typeof caps.min === 'number' && typeof caps.max === 'number') {
    return caps;
  }
  return DEFAULT_SPECIES_CHAR_CAPS;
}

/**
 * Ruleset-specific species / ancestry label for the actor sheet (`system.species`).
 * @param {object} state - Completed chargen state
 * @returns {string} Trimmed label, or empty string
 */
export function getCharGenActorSpeciesLabel(state) {
  const entry = getCharGenRegistryEntry(state?.ruleset);
  const fn = entry?.getActorSpeciesLabel;
  if (typeof fn === 'function') {
    return String(fn(state) ?? '').trim();
  }
  return '';
}

/**
 * @param {string} [ruleset]
 * @returns {boolean}
 */
export function isChargenRulesetSupported(ruleset) {
  const key = canonicalizeChargenRulesetKey(ruleset);
  return Boolean(key && CHARGEN_REGISTRY[key]);
}

/**
 * If `ruleset` has chargen support, return it; otherwise return `'CE'`.
 * @param {string|null|undefined} ruleset
 * @returns {string}
 */
export function normalizeChargenRulesetOrCe(ruleset) {
  const key = canonicalizeChargenRulesetKey(ruleset);
  return isChargenRulesetSupported(key) ? key : 'CE';
}

/**
 * Merge a partial registry entry with defaults (for `twodsix.registerCharGen`).
 * @param {Partial<CharGenRegistryEntry> & { logic: import('./BaseCharGenLogic.js').BaseCharGenLogic }} partial
 * @param {string} rulesetKey
 * @returns {CharGenRegistryEntry}
 */
function mergeCharGenRegistryEntry(partial, rulesetKey) {
  const keyLower = rulesetKey.toLowerCase();
  const defaults = {
    needsPreload: true,
    displayName: '',
    packs: {
      itemPackId: `twodsix.${keyLower}-srd-items`,
      itemPackFallbackId: 'twodsix.ce-srd-items',
      speciesPackId: null,
      speciesPackFallbackId: null,
    },
    speciesCharCaps: { min: 1, max: 15 },
    resolveCharacteristicsUiRules: () => ({ ...DEFAULT_CHARACTERISTICS_UI_RULES }),
  };
  const merged = foundry.utils.mergeObject(defaults, partial, { inplace: false });
  merged.packs = foundry.utils.mergeObject(defaults.packs, partial.packs ?? {}, { inplace: false });
  merged.speciesCharCaps = foundry.utils.mergeObject(
    defaults.speciesCharCaps,
    partial.speciesCharCaps ?? {},
    { inplace: false },
  );
  if (typeof merged.displayName !== 'string') {
    merged.displayName = '';
  }
  return /** @type {CharGenRegistryEntry} */ (merged);
}

function validateCharGenRegistryEntry(key, entry) {
  if (!entry?.logic || typeof entry.logic.run !== 'function') {
    console.warn(`twodsix | registerChargenRuleset(${key}): entry.logic with run() is required`);
    return false;
  }
  if (entry.needsPreload === true && typeof entry.logic.loadData !== 'function') {
    console.warn(`twodsix | registerChargenRuleset(${key}): needsPreload=true requires logic.loadData(ruleset).`);
    return false;
  }
  if (entry.resolveCharacteristicsUiRules != null && typeof entry.resolveCharacteristicsUiRules !== 'function') {
    console.warn(`twodsix | registerChargenRuleset(${key}): resolveCharacteristicsUiRules must be function when provided.`);
    return false;
  }
  if (entry.getActorNotesLines != null && typeof entry.getActorNotesLines !== 'function') {
    console.warn(`twodsix | registerChargenRuleset(${key}): getActorNotesLines must be function when provided.`);
    return false;
  }
  if (entry.getActorSpeciesLabel != null && typeof entry.getActorSpeciesLabel !== 'function') {
    console.warn(`twodsix | registerChargenRuleset(${key}): getActorSpeciesLabel must be function when provided.`);
    return false;
  }
  if (entry.packs != null && typeof entry.packs !== 'object') {
    console.warn(`twodsix | registerChargenRuleset(${key}): packs must be object when provided.`);
    return false;
  }
  if (entry.speciesCharCaps != null && (typeof entry.speciesCharCaps !== 'object'
    || typeof entry.speciesCharCaps.min !== 'number'
    || typeof entry.speciesCharCaps.max !== 'number')) {
    console.warn(`twodsix | registerChargenRuleset(${key}): speciesCharCaps must be {min: number, max: number} when provided.`);
    return false;
  }
  return true;
}

/**
 * Register or replace a chargen ruleset (also exposed on the `twodsix.registerCharGen` hook payload).
 * Safe to call from another module's `Hooks.once('init')` with a higher `order` than the twodsix system init.
 * @param {string} key - Ruleset key (e.g. `'CE'`, `'MYBOOK'`)
 * @param {Partial<CharGenRegistryEntry> & { logic: import('./BaseCharGenLogic.js').BaseCharGenLogic }} entry
 */
export function registerChargenRuleset(key, entry) {
  if (!key || typeof key !== 'string') {
    console.warn('twodsix | registerChargenRuleset: invalid key', key);
    return;
  }
  const canonicalKey = canonicalizeChargenRulesetKey(key);
  if (!canonicalKey) {
    console.warn('twodsix | registerChargenRuleset: invalid key', key);
    return;
  }
  if (canonicalKey !== key) {
    console.warn(`twodsix | registerChargenRuleset: normalized ruleset key "${key}" -> "${canonicalKey}".`);
  }
  if (!validateCharGenRegistryEntry(canonicalKey, entry)) {
    return;
  }
  CHARGEN_REGISTRY[canonicalKey] = mergeCharGenRegistryEntry(entry, canonicalKey);
  refreshChargenSupportedRuleSets();
}

/**
 * Call during `Hooks.once('init')` so modules can register chargen via `Hooks.callAll('twodsix.registerCharGen', api)`.
 */
export function initializeCharGenRegistry() {
  try {
    // noinspection JSCheckFunctionSignatures
    Hooks.callAll('twodsix.registerCharGen', { registerChargenRuleset });
  } catch (err) {
    console.error('twodsix | twodsix.registerCharGen hook failed during init.', err);
  }
}

// ─── DISPATCH FUNCTIONS ────────────────────────────────────────────────────────

/**
 * Get the character generation logic instance for a ruleset.
 * @param {string} ruleset - Ruleset key (e.g., 'CE', 'CU')
 * @returns {import('./BaseCharGenLogic.js').BaseCharGenLogic}
 * @throws {Error} If the ruleset is not registered
 */
export function getCharGenLogic(ruleset) {
  const entry = getCharGenRegistryEntry(ruleset);
  if (!entry) {
    throw new Error(`twodsix | Character generation is not available for ruleset "${ruleset ?? ''}".`);
  }
  return entry.logic;
}

/**
 * Dispatch character generation for the given ruleset.
 * @param {import('./CharGenApp.js').CharGenApp} app
 * @param {string} ruleset
 */
export async function dispatchCharGen(app, ruleset) {
  const logic = getCharGenLogic(ruleset);
  await logic.run(app);
}

/**
 * Pre-load career data for rulesets that need it before the UI starts.
 * @param {string} ruleset
 */
export async function preloadCharGenData(ruleset) {
  const key = canonicalizeChargenRulesetKey(ruleset);
  if (!isChargenRulesetSupported(key)) {
    return;
  }
  const entry = CHARGEN_REGISTRY[key];
  if (entry.needsPreload) {
    await entry.logic.loadData(key);
  }
}
