/**
 * TraderRulesetRegistry.js
 * Registry of rulesets that support the trader feature.
 */
import { BaseTraderRuleset } from './BaseTraderRuleset.js';
import { CDEERuleset } from './rulesets/cdee/CDEERuleset.js';
import { CELRuleset } from './rulesets/cel/CELRuleset.js';
import { CERuleset } from './rulesets/ce/CERuleset.js';
import { CLURuleset } from './rulesets/clu/CLURuleset.js';

// ─── CLASS INSTANCES (singletons) ──────────────────────────────────────────

const ceRuleset = new CERuleset();
const celRuleset = new CELRuleset();
const cdeeRuleset = new CDEERuleset();
const cluRuleset = new CLURuleset();

// ─── REGISTRY ──────────────────────────────────────────────────────────────

/**
 * Map of ruleset key -> trader ruleset metadata.
 */
export const TRADER_RULESET_DEFINITIONS = {
  CE: {
    key: 'CE',
    label: 'TWODSIX.Trader.Rulesets.CE',
    instance: ceRuleset,
  },
  CEL: {
    key: 'CEL',
    label: 'TWODSIX.Trader.Rulesets.CEL',
    instance: celRuleset,
  },
  CLU: {
    key: 'CLU',
    label: 'TWODSIX.Trader.Rulesets.CLU',
    instance: cluRuleset,
  },
  CDEE: {
    key: 'CDEE',
    label: 'TWODSIX.Trader.Rulesets.CDEE',
    instance: cdeeRuleset,
  },
};

/**
 * Map of ruleset key -> trader ruleset instance.
 * @type {Record<string, import('./BaseTraderRuleset.js').BaseTraderRuleset>}
 */
export const TRADER_REGISTRY = {};

/**
 * The set of ruleset keys that have trader support.
 */
export let TRADER_SUPPORTED_RULESETS = [];

export const TRADER_OTHER_RULESET = 'other';
export const TRADER_CUSTOM_PRESET_PREFIX = 'custom:';
export const TRADER_CUSTOM_PRESETS_FLAG = 'traderRulesetPresets';
export const TRADER_CUSTOM_PRESETS_VERSION = 1;

export const TRADER_RULESET_SELECTORS = [
  { method: 'getSearchMethods', group: 'search' },
  { method: 'getSearchSkillLevel', group: 'search' },
  { method: 'getSearchSkillLabel', group: 'search' },
  { method: 'getSearchStarportBonus', group: 'search' },
  { method: 'getSearchThreshold', group: 'search' },
  { method: 'getSearchPenaltyPolicy', group: 'search' },
  { method: 'getPriceRollSkill', group: 'broker' },
  { method: 'resolveEffectiveNegotiatorSkill', group: 'broker' },
  { method: 'normalizeLocalBrokerResult', group: 'broker' },
  { method: 'shouldResetLocalBrokerOnArrival', group: 'broker' },
  { method: 'getCommonGoodsDMs', group: 'general' },
  { method: 'getBrokerMaxSkill', group: 'broker' },
  { method: 'getBrokerCommission', group: 'broker' },
  { method: 'getInsolvencyPolicy', group: 'general' },
  { method: 'resolveLifeSupportPayment', group: 'general' },
  { method: 'shouldCheckSmuggling', group: 'events' },
  { method: 'doSmugglingCheck', group: 'events' },
  { method: 'shouldRollCargoTag', group: 'events' },
  { method: 'rollCargoTag', group: 'events' },
  { method: 'shouldRollProblemWithDeal', group: 'events' },
  { method: 'rollProblemWithDeal', group: 'events' },
  { method: 'getRelevantSkillNames', group: 'general' },
];

export const TRADER_RULESET_SELECTOR_METHODS = TRADER_RULESET_SELECTORS.map(selector => selector.method);

/**
 * Preset/world-setting key for the group of trade-table methods. `ConfiguredTraderRuleset` routes
 * `getCommonGoods`, `getTradeGoods`, `getCommonGoodsDMs`, `getAvailableTradeGoodsModifier`, and
 * `getPriceRulesetKey` through this single selector so one UI control picks a coherent ruleset slice.
 * Value must match an entry in {@link TRADER_RULESET_SELECTORS} and {@link traderRulesetSourceSettingKey}.
 */
export const TRADER_SELECTOR_TRADE_TABLES = 'getCommonGoodsDMs';

/**
 * Preset key for passenger revenue, freight/mail/charter rates, and life-support cost tables.
 * Despite the name, this is the selector registered as `getRelevantSkillNames` in presets.
 */
export const TRADER_SELECTOR_ECONOMIC_TABLES = 'getRelevantSkillNames';

export let TRADER_RULESET_PRESETS = {};

let configuredTraderRuleset;

function refreshTraderRegistryData() {
  Object.keys(TRADER_REGISTRY).forEach(key => delete TRADER_REGISTRY[key]);
  Object.values(TRADER_RULESET_DEFINITIONS).forEach(definition => {
    TRADER_REGISTRY[definition.key] = definition.instance;
  });
  TRADER_SUPPORTED_RULESETS = Object.keys(TRADER_RULESET_DEFINITIONS);
  TRADER_RULESET_PRESETS = buildTraderRulesetPresets();
}
refreshTraderRegistryData();

// ─── DISPATCH FUNCTIONS ────────────────────────────────────────────────────

/**
 * Get the trader ruleset instance for a ruleset key.
 * Built-in rulesets return their singleton instance. Custom and "other" rulesets
 * return a delegating facade that composes behavior from source rulesets.
 * @param {string} ruleset - Ruleset key (e.g., 'CE', 'CDEE', 'other', or a custom preset id)
 * @returns {import('./BaseTraderRuleset.js').BaseTraderRuleset} The ruleset instance
 */
export function getTraderRuleset(ruleset) {
  const requestedRuleset = ruleset || getActiveTraderRulesetKey();
  if (TRADER_REGISTRY[requestedRuleset]) {
    return TRADER_REGISTRY[requestedRuleset];
  }

  const presetSourceMap = getTraderPresetSourceMap(requestedRuleset);
  if (presetSourceMap) {
    return new ConfiguredTraderRuleset(presetSourceMap);
  }

  configuredTraderRuleset = configuredTraderRuleset || new ConfiguredTraderRuleset();
  return configuredTraderRuleset;
}

/**
 * @returns {Record<string, string>}
 */
export function buildTraderRulesetPresets() {
  return Object.fromEntries(TRADER_SUPPORTED_RULESETS.map(key => [key, buildPresetSourceMap(key)]));
}

/**
 * @param {string} ruleset
 * @returns {Record<string, string>}
 */
export function buildPresetSourceMap(ruleset) {
  return Object.fromEntries(TRADER_RULESET_SELECTOR_METHODS.map(method => [method, ruleset]));
}

/**
 * Register or replace a trader ruleset definition.
 * Safe for plugin bootstrap hooks during init.
 * @param {string} key
 * @param {{label?: string, instance: import('./BaseTraderRuleset.js').BaseTraderRuleset}} definition
 */
export function registerTraderRuleset(key, definition) {
  if (!key || typeof key !== 'string') {
    console.warn('twodsix | registerTraderRuleset: invalid key', key);
    return;
  }
  if (!definition?.instance || !(definition.instance instanceof BaseTraderRuleset)) {
    console.warn(`twodsix | registerTraderRuleset(${key}): definition.instance must extend BaseTraderRuleset`);
    return;
  }
  TRADER_RULESET_DEFINITIONS[key] = {
    key,
    label: definition.label || `TWODSIX.Trader.Rulesets.${key}`,
    instance: definition.instance,
  };
  configuredTraderRuleset = undefined;
  refreshTraderRegistryData();
}

/**
 * Allow external modules to register trader rulesets during init.
 */
export function initializeTraderRulesetRegistry() {
  // noinspection JSCheckFunctionSignatures
  Hooks.callAll('twodsix.registerTraderRuleset', { registerTraderRuleset });
}

/**
 * @param {string} method
 * @returns {string}
 */
export function traderRulesetSourceSettingKey(method) {
  return `traderRulesetSource${method.charAt(0).toUpperCase()}${method.slice(1)}`;
}

/**
 * @returns {Record<string, string>}
 */
export function getTraderRulesetSourceChoices() {
  return Object.values(TRADER_RULESET_DEFINITIONS).reduce((choices, definition) => {
    choices[definition.key] = definition.label;
    return choices;
  }, {});
}

/**
 * @returns {Record<string, string>}
 */
export function getTraderPresetChoices() {
  return {
    ...getBuiltInTraderPresetChoices(),
    ...getCustomTraderPresetChoices(),
    [TRADER_OTHER_RULESET]: 'TWODSIX.Trader.Rulesets.Other',
  };
}

/**
 * @returns {Record<string, string>}
 */
export function getBuiltInTraderPresetChoices() {
  return Object.values(TRADER_RULESET_DEFINITIONS).reduce((choices, definition) => {
    choices[definition.key] = definition.label;
    return choices;
  }, {});
}

/**
 * @returns {Record<string, string>}
 */
export function getCustomTraderPresetChoices() {
  return Object.entries(getCustomTraderPresetStore().presets).reduce((choices, [id, preset]) => {
    choices[customTraderPresetSettingValue(id)] = preset.name || id;
    return choices;
  }, {});
}

/**
 * @returns {Array<{key: string, label: string}>}
 */
export function getTraderPresetOptions() {
  return Object.entries(getTraderPresetChoices()).map(([key, label]) => ({
    key,
    label: label.startsWith?.('TWODSIX.') ? game.i18n.localize(label) : label,
  }));
}

/**
 * @returns {string}
 */
export function getDefaultTraderRulesetKey() {
  const activeRuleset = getActiveTraderRulesetKey();
  if (TRADER_REGISTRY[activeRuleset] || activeRuleset === TRADER_OTHER_RULESET || getCustomPresetId(activeRuleset)) {
    return activeRuleset;
  }
  return TRADER_REGISTRY[safeGameSettingGet('ruleset')] ? safeGameSettingGet('ruleset') : 'CE';
}

/**
 * @returns {string}
 */
export function getActiveTraderRulesetKey() {
  return safeGameSettingGet('traderRuleset') || safeGameSettingGet('ruleset') || 'CE';
}

/**
 * @returns {Record<string, string>}
 */
export function getCurrentTraderSourceMap() {
  return normalizeTraderSourceMap(Object.fromEntries(TRADER_RULESET_SELECTOR_METHODS.map(method => {
    return [method, safeGameSettingGet(traderRulesetSourceSettingKey(method))];
  })));
}

/**
 * @param {string} presetKey
 * @returns {Record<string, string>|null}
 */
export function getTraderPresetSourceMap(presetKey) {
  if (TRADER_RULESET_PRESETS[presetKey]) {
    return TRADER_RULESET_PRESETS[presetKey];
  }

  const customPresetId = getCustomPresetId(presetKey);
  if (!customPresetId) {
    return null;
  }

  const preset = getCustomTraderPresetStore().presets[customPresetId];
  return preset ? normalizeTraderSourceMap(preset.selectors) : null;
}

/**
 * @param {Record<string, string>} sourceMap
 * @returns {string|null}
 */
export function findMatchingTraderPreset(sourceMap) {
  const normalizedSourceMap = normalizeTraderSourceMap(sourceMap);
  for (const [key, presetSourceMap] of Object.entries(TRADER_RULESET_PRESETS)) {
    if (sourceMapsMatch(normalizedSourceMap, presetSourceMap)) {
      return key;
    }
  }

  for (const [id, preset] of Object.entries(getCustomTraderPresetStore().presets)) {
    if (sourceMapsMatch(normalizedSourceMap, normalizeTraderSourceMap(preset.selectors))) {
      return customTraderPresetSettingValue(id);
    }
  }

  return null;
}

/**
 * @param {Record<string, string>} sourceMap
 * @returns {Record<string, string>}
 */
export function normalizeTraderSourceMap(sourceMap = {}) {
  return Object.fromEntries(TRADER_RULESET_SELECTOR_METHODS.map(method => {
    const source = sourceMap[method];
    return [method, TRADER_REGISTRY[source] ? source : 'CE'];
  }));
}

/**
 * @param {string} id
 * @returns {string}
 */
export function customTraderPresetSettingValue(id) {
  return `${TRADER_CUSTOM_PRESET_PREFIX}${id}`;
}

/**
 * @param {string} presetKey
 * @returns {string|null}
 */
export function getCustomPresetId(presetKey) {
  return typeof presetKey === 'string' && presetKey.startsWith(TRADER_CUSTOM_PRESET_PREFIX)
    ? presetKey.slice(TRADER_CUSTOM_PRESET_PREFIX.length)
    : null;
}

/**
 * @returns {{version: number, presets: Record<string, {name: string, selectors: Record<string, string>}>}}
 */
export function getCustomTraderPresetStore() {
  const stored = getWorldTwodsixFlag(TRADER_CUSTOM_PRESETS_FLAG);
  return {
    version: stored?.version || TRADER_CUSTOM_PRESETS_VERSION,
    presets: stored?.presets || {},
  };
}

/**
 * @param {{version?: number, presets?: Record<string, {name: string, selectors: Record<string, string>}>}} store
 * @returns {Promise<void>}
 */
export async function setCustomTraderPresetStore(store) {
  await setWorldTwodsixFlag(TRADER_CUSTOM_PRESETS_FLAG, {
    version: store?.version || TRADER_CUSTOM_PRESETS_VERSION,
    presets: store?.presets || {},
  });
}

/**
 * @param {string} name
 * @returns {string}
 */
export function slugifyTraderPresetName(name) {
  const base = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'custom';
}

/**
 * @param {Record<string, string>} left
 * @param {Record<string, string>} right
 * @returns {boolean}
 */
function sourceMapsMatch(left, right) {
  return TRADER_RULESET_SELECTOR_METHODS.every(method => left[method] === right[method]);
}

/**
 * @param {string} key
 * @returns {string|undefined}
 */
function safeGameSettingGet(key) {
  try {
    return game.settings?.get('twodsix', key);
  } catch {
    return undefined;
  }
}

/**
 * World is not a ClientDocument in all supported Foundry versions, so do not
 * assume getFlag/setFlag exist during settings registration or world startup.
 * @param {string} key
 * @returns {unknown}
 */
function getWorldTwodsixFlag(key) {
  if (typeof game.world?.getFlag === 'function') {
    return game.world.getFlag('twodsix', key);
  }
  return foundry.utils.getProperty(game.world ?? {}, `flags.twodsix.${key}`);
}

/**
 * @param {string} key
 * @param {unknown} value
 * @returns {Promise<void>}
 */
async function setWorldTwodsixFlag(key, value) {
  if (typeof game.world?.setFlag === 'function') {
    await game.world.setFlag('twodsix', key, value);
    return;
  }

  if (typeof game.world?.update === 'function') {
    await game.world.update({ [`flags.twodsix.${key}`]: value });
    return;
  }

  foundry.utils.setProperty(game.world, `flags.twodsix.${key}`, value);
}

/**
 * Composes a virtual ruleset from per-topic source keys (game settings or custom preset maps).
 * Several public methods delegate through a *selector string* that is not always the same as the
 * callee method name—see {@link TRADER_SELECTOR_TRADE_TABLES} and {@link TRADER_SELECTOR_ECONOMIC_TABLES}.
 */
class ConfiguredTraderRuleset extends BaseTraderRuleset {
  /**
   * @param {Record<string, string>|null} sourceMap
   */
  constructor(sourceMap = null) {
    super();
    this.sourceMap = sourceMap ? normalizeTraderSourceMap(sourceMap) : null;
  }

  _delegate(method) {
    const configuredSource = this.sourceMap?.[method] || safeGameSettingGet(traderRulesetSourceSettingKey(method));
    const source = TRADER_REGISTRY[configuredSource] ? configuredSource : 'CE';
    return TRADER_REGISTRY[source];
  }

  getSearchMethods(worldTL, starport) {
    return this._delegate('getSearchMethods').getSearchMethods(worldTL, starport);
  }

  getSearchSkillLevel(crew, method) {
    return this._delegate('getSearchSkillLevel').getSearchSkillLevel(crew, method);
  }

  getSearchSkillLabel(method) {
    return this._delegate('getSearchSkillLabel').getSearchSkillLabel(method);
  }

  getSearchStarportBonus(starport) {
    return this._delegate('getSearchStarportBonus').getSearchStarportBonus(starport);
  }

  getSearchThreshold() {
    return this._delegate('getSearchThreshold').getSearchThreshold();
  }

  getSearchPenaltyPolicy(state, world, type, method) {
    return this._delegate('getSearchPenaltyPolicy').getSearchPenaltyPolicy(state, world, type, method);
  }

  getPriceRollSkill(crew) {
    return this._delegate('getPriceRollSkill').getPriceRollSkill(crew);
  }

  resolveEffectiveNegotiatorSkill(context) {
    return this._delegate('resolveEffectiveNegotiatorSkill').resolveEffectiveNegotiatorSkill(context);
  }

  normalizeLocalBrokerResult(result, context) {
    return this._delegate('normalizeLocalBrokerResult').normalizeLocalBrokerResult(result, context);
  }

  shouldResetLocalBrokerOnArrival() {
    return this._delegate('shouldResetLocalBrokerOnArrival').shouldResetLocalBrokerOnArrival();
  }

  getCommonGoodsDMs() {
    return this._delegate(TRADER_SELECTOR_TRADE_TABLES).getCommonGoodsDMs();
  }

  getCommonGoods() {
    return this._delegate(TRADER_SELECTOR_TRADE_TABLES).getCommonGoods();
  }

  getTradeGoods() {
    return this._delegate(TRADER_SELECTOR_TRADE_TABLES).getTradeGoods();
  }

  getAvailableTradeGoodsModifier(starport) {
    return this._delegate(TRADER_SELECTOR_TRADE_TABLES).getAvailableTradeGoodsModifier(starport);
  }

  getPriceRulesetKey() {
    return this._delegate(TRADER_SELECTOR_TRADE_TABLES).getPriceRulesetKey();
  }

  getBrokerMaxSkill(starport) {
    return this._delegate('getBrokerMaxSkill').getBrokerMaxSkill(starport);
  }

  getBrokerCommission(skillLevel) {
    return this._delegate('getBrokerCommission').getBrokerCommission(skillLevel);
  }

  getPassengerRevenue() {
    return this._delegate(TRADER_SELECTOR_ECONOMIC_TABLES).getPassengerRevenue();
  }

  getPassengerAvailability() {
    return this._delegate(TRADER_SELECTOR_ECONOMIC_TABLES).getPassengerAvailability();
  }

  getFreightAvailability() {
    return this._delegate(TRADER_SELECTOR_ECONOMIC_TABLES).getFreightAvailability();
  }

  getFreightRate() {
    return this._delegate(TRADER_SELECTOR_ECONOMIC_TABLES).getFreightRate();
  }

  getMailPayment() {
    return this._delegate(TRADER_SELECTOR_ECONOMIC_TABLES).getMailPayment();
  }

  getCharterRate() {
    return this._delegate(TRADER_SELECTOR_ECONOMIC_TABLES).getCharterRate();
  }

  getLifeSupportCosts() {
    return this._delegate(TRADER_SELECTOR_ECONOMIC_TABLES).getLifeSupportCosts();
  }

  getBulkLifeSupportCosts() {
    return this._delegate(TRADER_SELECTOR_ECONOMIC_TABLES).getBulkLifeSupportCosts();
  }

  async resolveLifeSupportPayment(app, state, context) {
    return this._delegate('resolveLifeSupportPayment').resolveLifeSupportPayment(app, state, context);
  }

  getInsolvencyPolicy(state) {
    return this._delegate('getInsolvencyPolicy').getInsolvencyPolicy(state);
  }

  shouldCheckSmuggling(cargo, world) {
    return this._delegate('shouldCheckSmuggling').shouldCheckSmuggling(cargo, world);
  }

  async doSmugglingCheck(app, world) {
    return this._delegate('doSmugglingCheck').doSmugglingCheck(app, world);
  }

  shouldRollCargoTag() {
    return this._delegate('shouldRollCargoTag').shouldRollCargoTag();
  }

  async rollCargoTag(app) {
    return this._delegate('rollCargoTag').rollCargoTag(app);
  }

  shouldRollProblemWithDeal() {
    return this._delegate('shouldRollProblemWithDeal').shouldRollProblemWithDeal();
  }

  async rollProblemWithDeal(app) {
    return this._delegate('rollProblemWithDeal').rollProblemWithDeal(app);
  }

  getRelevantSkillNames() {
    return this._delegate('getRelevantSkillNames').getRelevantSkillNames();
  }
}
