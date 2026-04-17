/**
 * Shared helpers for AT_WORLD phase modules.
 */

import { BULK_LS_CARGO_ID } from '../TraderConstants.js';
import { getTraderRuleset } from '../TraderRulesetRegistry.js';

/**
 * @param {import('../TraderState.js').TraderState} s
 * @param {string} starport
 * @returns {number}
 */
export function getEffectiveBrokerSkillForWorld(s, starport) {
  const ruleset = getTraderRuleset(s.ruleset);
  const crewSkill = ruleset.getPriceRollSkill(s.crew);
  const maxSkill = ruleset.getBrokerMaxSkill(starport);
  const hiredSkill = Math.min(Number(s.localBrokerSkill) || 0, maxSkill);
  return ruleset.resolveEffectiveNegotiatorSkill({
    crewSkill,
    hiredSkill,
    useLocalBroker: s.useLocalBroker,
    starport,
    illegal: s.localBrokerIllegal === true,
  });
}

/**
 * @param {import('../TraderApp.js').TraderApp} app
 * @param {string} prompt
 * @param {Array<{value: string, label: string}>} options
 * @param {string|number|null} [maxValue=null]
 * @returns {Promise<number>}
 */
export async function chooseIntOption(app, prompt, options, maxValue = null) {
  const raw = await app._choose(prompt, options, maxValue);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Return the stable cargo type identifier for a bulk life-support cargo lot.
 * Prefers `cargoId` (set on all lots created from this commit forward).
 * Falls back to matching the localized name for legacy lots that predate `cargoId`.
 * @param {object} cargoItem
 * @returns {string|null}
 */
export function getBulkLifeSupportCargoId(cargoItem) {
  if (cargoItem?.cargoId) {
    return cargoItem.cargoId;
  }
  // Legacy fallback for cargo lots without cargoId — remove after a major version migration.
  const normalName = game.i18n.localize('TWODSIX.Trader.BulkLSNormal');
  const luxuryName = game.i18n.localize('TWODSIX.Trader.BulkLSLuxury');
  if (cargoItem?.name === normalName) {
    console.debug('Twodsix | getBulkLifeSupportCargoId: matched legacy normal bulk LS via i18n name.');
    return BULK_LS_CARGO_ID.NORMAL;
  }
  if (cargoItem?.name === luxuryName) {
    console.debug('Twodsix | getBulkLifeSupportCargoId: matched legacy luxury bulk LS via i18n name.');
    return BULK_LS_CARGO_ID.LUXURY;
  }
  return null;
}
