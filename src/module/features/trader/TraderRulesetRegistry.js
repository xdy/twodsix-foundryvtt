/**
 * TraderRulesetRegistry.js
 * Registry of rulesets that support the trader feature.
 */
import { CDEERuleset } from './CDEERuleset.js';
import { CERuleset } from './CERuleset.js';

// ─── CLASS INSTANCES (singletons) ──────────────────────────────────────────

const ceRuleset = new CERuleset();
const cdeeRuleset = new CDEERuleset();

// ─── REGISTRY ──────────────────────────────────────────────────────────────

/**
 * Map of ruleset key -> trader ruleset instance.
 * @type {Record<string, import('./BaseTraderRuleset.js').BaseTraderRuleset>}
 */
export const TRADER_REGISTRY = {
  CE: ceRuleset,
  CDEE: cdeeRuleset,
};

/**
 * The set of ruleset keys that have trader support.
 */
export const TRADER_SUPPORTED_RULESETS = Object.keys(TRADER_REGISTRY);

// ─── DISPATCH FUNCTIONS ────────────────────────────────────────────────────

/**
 * Get the trader ruleset instance for a ruleset key.
 * Unknown ruleset falls back to CE ruleset.
 * @param {string} ruleset - Ruleset key (e.g., 'CE', 'CDEE')
 * @returns {import('./BaseTraderRuleset.js').BaseTraderRuleset} The ruleset instance
 */
export function getTraderRuleset(ruleset) {
  return TRADER_REGISTRY[ruleset] ?? TRADER_REGISTRY.CE;
}
