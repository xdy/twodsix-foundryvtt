/**
 * TradeGeneratorPricing.js
 * Pricing math, situational modifiers, and broker-check simulation for trade generation.
 * No state — pure functions over the constants in TradeGeneratorConstants.js.
 *
 * @module TradeGeneratorPricing
 */

import { PRICE_MODIFIERS_CE, PRICE_MODIFIERS_CDEE } from './TradeGeneratorConstants.js';

/**
 * Get the appropriate price modifier table for the current ruleset.
 */
export function getPriceModifierTable(ruleset) {
  // CDEE, CD, CEL, CLU, and AC use the more conservative table (11-16 differ from CE)
  if (['CDEE', 'CD', 'CEL', 'CLU', 'AC'].includes(ruleset)) {
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
  if (!['CDEE', 'CD', 'CLU', 'AC'].includes(ruleset)) {
    return 0;
  }

  const port = starport.toUpperCase();

  if (isPurchase) {
    // Purchase mods: high traffic = higher purchase prices (more demand)
    const purchaseMods = {
      'A': 2, 'B': 1, 'C': 0, 'D': -1, 'E': -2,
      'X': ruleset === 'CLU' ? -2 : -3
    };
    return purchaseMods[port] || 0;
  } else {
    // Sale mods: high traffic = lower sale prices (more sellers)
    const saleMods = ruleset === 'CLU' ? {
      'A': -3, 'B': -2, 'C': -1, 'D': 0, 'E': 0, 'X': 1
    } : {
      'A': -1, 'B': -2, 'C': 0, 'D': 0, 'E': 0, 'X': 1
    };
    return saleMods[port] || 0;
  }
}

/**
 * Calculate zone/safety modifier for purchase/sale prices.
 * Dangerous zones = risk premium = higher prices.
 */
export function getZoneSafetyModifier(zone, isPurchase, ruleset) {
  if (!['CDEE', 'CD', 'CLU', 'AC'].includes(ruleset)) {
    return 0;
  }

  const safetyZone = (zone || 'Green').toLowerCase();

  if (isPurchase) {
    const mods = { 'green': 0, 'amber': 1, 'red': 3 };
    return mods[safetyZone] || 0;
  } else {
    const mods = { 'green': 0, 'amber': 0, 'red': 2 };
    return mods[safetyZone] || 0;
  }
}

/**
 * Calculate illegal goods sale bonus.
 * Per CDEE/CLU rules: "DM+1 or DM+2" for illegal sale.
 */
export function getIllegalGoodsSaleModifier(isIllegal, zone, ruleset) {
  if (!['CDEE', 'CD', 'CLU', 'AC'].includes(ruleset)) {
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
  return Math.max(2, Math.min(16, value));
}

/**
 * Simulate a Broker skill check result (2d6 + skill + modifiers), clamped to 2-16.
 */
export function simulateBrokerCheck(traderSkill = 0, modifier = 0, trafficMod = 0, zoneMod = 0) {
  const dice = Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
  return clampCheck(dice + traderSkill + modifier + trafficMod + zoneMod);
}

/**
 * Calculate the final price of goods given base price and modifier percentage.
 */
export function calculatePrice(basePrice, modifierPercent) {
  return Math.round(basePrice * (modifierPercent / 100));
}

/**
 * Calculate purchase and sale prices from skill check results.
 * Used for both trade goods (with DMs) and common goods (no DMs).
 */
export function calculatePricesFromChecks(basePrice, purchaseCheck, saleCheck, ruleset) {
  const priceModifiers = getPriceModifierTable(ruleset);
  const purchasePriceData = priceModifiers[purchaseCheck] || priceModifiers[8];
  const salePriceData = priceModifiers[saleCheck] || priceModifiers[8];
  const purchasePrice = calculatePrice(basePrice, purchasePriceData.purchase);
  const salePrice = calculatePrice(basePrice, salePriceData.sale);

  return {
    purchaseCheck,
    saleCheck,
    purchasePriceData,
    salePriceData,
    purchasePrice,
    salePrice,
    salePriceModPercent: salePriceData.sale
  };
}

/**
 * Calculate purchase and sale prices for a good given base checks.
 */
export function calculateGoodPricing(good, tradeCodes, basePurchaseCheck, baseSaleCheck, ruleset) {
  const purchaseDM = getLargestTradeCodeModifier(tradeCodes, good.purchaseDM);
  const saleDM = getLargestTradeCodeModifier(tradeCodes, good.saleDM);
  const purchaseCheck = clampCheck(basePurchaseCheck + purchaseDM - saleDM);
  const saleCheck = clampCheck(baseSaleCheck + saleDM - purchaseDM);
  return calculatePricesFromChecks(good.basePrice, purchaseCheck, saleCheck, ruleset);
}
