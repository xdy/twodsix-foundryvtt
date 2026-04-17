/**
 * Shared ruleset + starting-credits defaults for trader setup dialogs.
 */

import { DEFAULT_CREW, DEFAULT_MERCHANT_TRADER } from './TraderConstants.js';
import { getDefaultTraderRulesetKey, getTraderRuleset, TRADER_SUPPORTED_RULESETS, } from './TraderRulesetRegistry.js';

/**
 * Normalize a ruleset key from setup UI (invalid keys fall back to CE).
 * @param {string} [rulesetKey]
 * @returns {string}
 */
export function resolveTraderSetupRulesetKey(rulesetKey) {
  let ruleset = rulesetKey ?? getDefaultTraderRulesetKey();
  if (!TRADER_SUPPORTED_RULESETS.includes(ruleset) && !ruleset.startsWith('custom:') && ruleset !== 'other') {
    ruleset = 'CE';
  }
  return ruleset;
}

/**
 * Default starting credits: two months of mortgage plus crew salaries (same formula as setup apps).
 * @param {string} rulesetKey
 * @returns {number}
 */
export function computeTraderDefaultStartingCredits(rulesetKey) {
  const ruleset = resolveTraderSetupRulesetKey(rulesetKey);
  const normalized = getTraderRuleset(ruleset);
  const monthlyPayment = Math.ceil(
    DEFAULT_MERCHANT_TRADER.shipCostMcr * 1000000 / normalized.getMortgageDivisor(),
  );
  const totalMonthlyCrew = DEFAULT_CREW.reduce((s, c) => s + c.salary, 0);
  return (monthlyPayment + totalMonthlyCrew) * 2;
}
