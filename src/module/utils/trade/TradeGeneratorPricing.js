/**
 * TradeGeneratorPricing.js
 * Pricing math, situational modifiers, and broker-check simulation for trade generation.
 * No state — pure functions over the constants in TradeGeneratorConstants.js.
 *
 * @module TradeGeneratorPricing
 */

import {
  CDEE_FAMILY_RULESETS,
  CHECK_MAX,
  CHECK_MIN,
  PRICE_MODIFIERS_CDEE,
  PRICE_MODIFIERS_CE,
  STARPORT_PURCHASE_MODS,
  STARPORT_PURCHASE_MODS_CLU,
  STARPORT_SALE_MODS,
  STARPORT_SALE_MODS_CLU,
  TRAFFIC_MOD_RULESETS,
  ZONE_PURCHASE_MODS,
  ZONE_SALE_MODS,
} from './TradeGeneratorConstants.js';

/**
 * Get the appropriate price modifier table for the current ruleset.
 */
export function getPriceModifierTable(ruleset, customTable = null) {
  if (customTable && typeof customTable === 'object') {
    return customTable;
  }
  if (CDEE_FAMILY_RULESETS.includes(ruleset)) {
    return PRICE_MODIFIERS_CDEE;
  }
  // Default to CE for all other rulesets (CE, CT, CEATOM, etc.)
  return PRICE_MODIFIERS_CE;
}

/**
 * Calculate starport traffic modifier for purchase/sale prices.
 * High traffic = more competition = different price dynamics.
 */
export function getStarportTrafficModifier(starport, isPurchase, ruleset) {
  if (!TRAFFIC_MOD_RULESETS.includes(ruleset)) {
    return 0;
  }

  const port = (starport || 'X').toUpperCase();

  if (isPurchase) {
    const mods = ruleset === 'CLU' ? STARPORT_PURCHASE_MODS_CLU : STARPORT_PURCHASE_MODS;
    return mods[port] || 0;
  } else {
    const mods = ruleset === 'CLU' ? STARPORT_SALE_MODS_CLU : STARPORT_SALE_MODS;
    return mods[port] || 0;
  }
}

/**
 * Calculate zone/safety modifier for purchase/sale prices.
 * Dangerous zones = risk premium = higher prices.
 */
export function getZoneSafetyModifier(zone, isPurchase, ruleset) {
  if (!TRAFFIC_MOD_RULESETS.includes(ruleset)) {
    return 0;
  }

  const safetyZone = (zone || 'Green').toLowerCase();

  if (isPurchase) {
    return ZONE_PURCHASE_MODS[safetyZone] || 0;
  } else {
    return ZONE_SALE_MODS[safetyZone] || 0;
  }
}

/**
 * Calculate illegal goods sale bonus.
 * Per CDEE/CLU rules: "DM+1 or DM+2" for illegal sale.
 */
export function getIllegalGoodsSaleModifier(isIllegal, zone, ruleset) {
  if (!TRAFFIC_MOD_RULESETS.includes(ruleset)) {
    return 0;
  }
  if (!isIllegal) {
    return 0;
  }
  const safetyZone = (zone || 'Green').toLowerCase();
  return safetyZone === 'red' ? 2 : 1;
}

/**
 * Roll dice for a formula like "2D6" or "1D6*5".
 * Foundry's Roll.evaluateSync() cannot handle the *N multiplier syntax used in trade quantity
 * formulas, so we parse and evaluate manually.
 */
export function rollDice(formula) {
  const match = formula.match(/^(\d+)D(\d+)(?:\*(\d+))?$/);
  if (!match) {
    throw new Error(`TradeGenerator: unrecognised dice formula "${formula}"`);
  }
  const numDice = parseInt(match[1]);
  const dieSize = parseInt(match[2]);
  const multiplier = match[3] ? parseInt(match[3]) : 1;
  let total = 0;
  for (let i = 0; i < numDice; i++) {
    total += Math.floor(Math.random() * dieSize) + 1;
  }
  return total * multiplier;
}

/**
 * Get the largest trade code modifier from a list of trade codes.
 */
export function getLargestTradeCodeModifier(codes, modifiers) {
  let largest = 0;
  for (const code of codes) {
    if (modifiers[code] && modifiers[code] > largest) {
      largest = modifiers[code];
    }
  }
  return largest;
}

export function clampCheck(value) {
  return Math.max(CHECK_MIN, Math.min(CHECK_MAX, value));
}

export function clampCheckForRuleset(value, ruleset, clampRange = null) {
  if (clampRange && Number.isFinite(clampRange.min) && Number.isFinite(clampRange.max)) {
    return Math.max(clampRange.min, Math.min(clampRange.max, value));
  }
  return clampCheck(value);
}

/**
 * Parse a price-roll dice expression like '2d6' or '3d6' into a numeric dice count.
 * Defaults to 2 for unrecognised input.
 * @param {string} expr
 * @returns {number}
 */
export function parsePriceRollDiceCount(expr) {
  const match = String(expr || '').toLowerCase().match(/^(\d+)d6$/);
  if (!match) {
    return 2;
  }
  const count = Number.parseInt(match[1], 10);
  return Number.isFinite(count) && count > 0 ? count : 2;
}

/**
 * Simulate a Broker skill check result (Nd6 + skill + modifiers), clamped per ruleset.
 * The dice count is ruleset-controlled via `priceRollDice` ('2d6' or '3d6'); defaults to 2D6.
 * @param {number} [traderSkill=0]
 * @param {number} [modifier=0]
 * @param {number} [trafficMod=0]
 * @param {number} [zoneMod=0]
 * @param {object} [options]
 * @param {string} [options.ruleset='CE']
 * @param {{min: number, max: number}|null} [options.clampRange=null]
 * @param {string} [options.priceRollDice='2d6']
 * @returns {number}
 */
export function simulateBrokerCheck(traderSkill = 0, modifier = 0, trafficMod = 0, zoneMod = 0, { ruleset = 'CE', clampRange = null, priceRollDice = '2d6' } = {}) {
  const numDice = parsePriceRollDiceCount(priceRollDice);
  let dice = 0;
  for (let i = 0; i < numDice; i++) {
    dice += Math.floor(Math.random() * 6) + 1;
  }
  return clampCheckForRuleset(dice + traderSkill + modifier + trafficMod + zoneMod, ruleset, clampRange);
}

/**
 * Calculate the final price of goods given base price and modifier percentage.
 */
export function calculatePrice(basePrice, modifierPercent) {
  return Math.round(basePrice * (modifierPercent / 100));
}

/**
 * Look up a price-table row for a given check value, applying the ruleset offset
 * and falling back to the "neutral" key if the check is out of range.
 * @param {Record<number, {purchase: number, sale: number}>} table
 * @param {number} check
 * @param {number} offset - Added to `check` before lookup (key = check + offset)
 * @returns {{purchase: number, sale: number}}
 */
export function lookupPriceModifier(table, check, offset = 0) {
  const indexedKey = check + offset;
  if (table[indexedKey]) {
    return table[indexedKey];
  }
  const fallbackKey = 8 + offset;
  return table[fallbackKey] || table[8];
}

/**
 * Calculate purchase and sale prices from skill check results.
 * Used for both trade goods (with DMs) and common goods (no DMs).
 * @param {number} basePrice
 * @param {number} purchaseCheck
 * @param {number} saleCheck
 * @param {string} ruleset
 * @param {object} [options]
 * @param {object|null} [options.customPriceTable=null]
 * @param {number} [options.priceTableOffset=0]
 * @returns {{purchaseCheck: number, saleCheck: number, purchasePriceData: object, salePriceData: object, purchasePrice: number, salePrice: number, purchasePriceModPercent: number, salePriceModPercent: number}}
 */
export function calculatePricesFromChecks(basePrice, purchaseCheck, saleCheck, ruleset, { customPriceTable = null, priceTableOffset = 0 } = {}) {
  const priceModifiers = getPriceModifierTable(ruleset, customPriceTable);
  const purchasePriceData = lookupPriceModifier(priceModifiers, purchaseCheck, priceTableOffset);
  const salePriceData = lookupPriceModifier(priceModifiers, saleCheck, priceTableOffset);
  const purchasePrice = calculatePrice(basePrice, purchasePriceData.purchase);
  const salePrice = calculatePrice(basePrice, salePriceData.sale);

  return {
    purchaseCheck,
    saleCheck,
    purchasePriceData,
    salePriceData,
    purchasePrice,
    salePrice,
    purchasePriceModPercent: purchasePriceData.purchase,
    salePriceModPercent: salePriceData.sale
  };
}

/**
 * Calculate purchase and sale prices for a good given base checks.
 */
export function calculateGoodPricing(good, tradeCodes, basePurchaseCheck, baseSaleCheck, ruleset, pricingOverrides = {}) {
  const { clampRange = null, customPriceTable = null, priceTableOffset = 0 } = pricingOverrides;
  const purchaseDM = getLargestTradeCodeModifier(tradeCodes, good.purchaseDM);
  const saleDM = getLargestTradeCodeModifier(tradeCodes, good.saleDM);
  const purchaseCheck = clampCheckForRuleset(basePurchaseCheck + purchaseDM - saleDM, ruleset, clampRange);
  const saleCheck = clampCheckForRuleset(baseSaleCheck + saleDM - purchaseDM, ruleset, clampRange);
  return calculatePricesFromChecks(good.basePrice, purchaseCheck, saleCheck, ruleset, { customPriceTable, priceTableOffset });
}
