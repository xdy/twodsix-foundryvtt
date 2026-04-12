/**
 * TradeGenerator.js
 * Core trade generation logic for 2d6-based systems (Cepheus Engine, etc.)
 * Implements trade good selection, price calculation, and report formatting.
 *
 * @module TradeGenerator
 */

import { COMPONENT_SUBTYPES } from '../config.js';
import { applyBrokerCommission, getBrokerInfo } from './trade/TradeGeneratorBroker.js';
import { COMMON_GOODS, STARPORT_BONUSES, TRADE_GOODS } from './trade/TradeGeneratorConstants.js';
import {
  calculateGoodPricing,
  calculatePricesFromChecks,
  clampCheck,
  getIllegalGoodsSaleModifier,
  getPriceModifierTable,
  getStarportTrafficModifier,
  getZoneSafetyModifier,
  rollDice,
  simulateBrokerCheck
} from './trade/TradeGeneratorPricing.js';

/**
 * Apply capSameWorld and broker commission to a pricing result.
 * Returns the broker-adjusted purchase and sale price objects.
 */
function priceWithBroker(pricing, basePrice, capSameWorld, commissionPercent) {
  const cappedSalePrice =
    capSameWorld && pricing.salePrice > pricing.purchasePrice
      ? pricing.purchasePrice
      : pricing.salePrice;
  const purchaseAdjusted = applyBrokerCommission(basePrice, pricing.purchasePrice, commissionPercent);
  const saleAdjusted = applyBrokerCommission(basePrice, cappedSalePrice, commissionPercent);
  return { purchaseAdjusted, saleAdjusted };
}

/**
 * Generate trade information for a world, including available goods, prices, and summary info.
 * @param worldData - Data about the world and trade context (trade codes, starport, modifiers, etc.)
 * @param {object} [commonGoodsDMs] - Optional DM table for common goods
 * @returns TradeGenerationResult with all generated trade data for the world.
 */
export function generateTradeInformation(worldData, commonGoodsDMs = null) {
  if (!worldData) {
    throw new Error('TradeGenerator: worldData is required');
  }
  const tradeCodes = worldData.tradeCodes || [];
  const starportBonus = STARPORT_BONUSES[worldData.starport] || 0;
  const traderSkill = worldData.traderSkill ?? 0;
  const useLocalBroker = worldData.useLocalBroker ?? false;
  const localBrokerSkill = worldData.localBrokerSkill ?? 0;
  const supplierModifier = worldData.supplierModifier ?? 0;
  const buyerMod = worldData.buyerModifier ?? 0;
  const capSameWorld = worldData.capSameWorld ?? false;

  const restrictTradeGoodsToCodes = worldData.restrictTradeGoodsToCodes ?? false;
  const includeIllegalGoods = worldData.includeIllegalGoods ?? false;
  // Normalize zone to lowercase: treat 'none', empty, or undefined as 'green'
  const rawZone = (worldData.zone || '').toLowerCase();
  const zone = (rawZone && rawZone !== 'none') ? rawZone : 'green';

  // Get current ruleset from game settings to determine which price table to use
  const ruleset = (game.settings?.get('twodsix', 'ruleset')) || 'CE';
  const priceTable = getPriceModifierTable(ruleset);

  const brokerInfo = getBrokerInfo(useLocalBroker, traderSkill, localBrokerSkill, worldData.starport);
  const effectiveBrokerSkill = brokerInfo.effectiveSkill;
  const commissionPercent = brokerInfo.commissionPercent;

  // Calculate traffic and zone modifiers for this world
  const purchaseTrafficMod = getStarportTrafficModifier(worldData.starport, true, ruleset);
  const saleTrafficMod = getStarportTrafficModifier(worldData.starport, false, ruleset);
  const purchaseZoneMod = getZoneSafetyModifier(zone, true, ruleset);
  const saleZoneMod = getZoneSafetyModifier(zone, false, ruleset);

  const tradeCodeSet = new Set(tradeCodes);
  const isTradeCodeMatched = good => {
    const purchaseMatch = Object.keys(good.purchaseDM).some((code) => tradeCodeSet.has(code));
    const saleMatch = Object.keys(good.saleDM).some((code) => tradeCodeSet.has(code));
    return purchaseMatch || saleMatch;
  };

  // Simulate supplier finding (good supply situation bonus is 0-2, reported in UI but not applied to checks)
  const supplierBonus = Math.floor(Math.random() * 3);

  // Select which goods are available to buy (D66 roll logic)
  const isBlackMarket = worldData.isBlackMarket ?? false;
  const numRolls = Math.floor(Math.random() * 6) + 1; // 1D6
  const availableGoodsTonnage = new Map(); // Map of index -> extra multiplier

  // SRD D66 table: Roll numRolls times. Ignore 61-65 unless black market.
  // D66 maps to 36 entries: 11-16 (1-6), 21-26 (7-12), ... 61-66 (31-36).
  // Legal goods occupy rolls 1-24, illegal goods 25-29 (D66 61-65), unusual cargo 30+ (D66 66).
  const D66_TOTAL = 36;
  const D66_LEGAL_END = 24;    // Rolls 1-24 → legal goods
  const D66_ILLEGAL_END = 29;  // Rolls 25-29 → illegal goods
  const legalIndices = TRADE_GOODS.map((_, i) => i).filter(i => !TRADE_GOODS[i].illegal && !TRADE_GOODS[i].unusual);
  const illegalIndices = TRADE_GOODS.map((_, i) => i).filter(i => TRADE_GOODS[i].illegal);

  // Black market suppliers stock illegal goods that match the world's trade codes.
  if (isBlackMarket) {
    illegalIndices.forEach(idx => {
      if (isTradeCodeMatched(TRADE_GOODS[idx])) {
        availableGoodsTonnage.set(idx, (availableGoodsTonnage.get(idx) || 0) + 1);
      }
    });
  }

  // Roll 1D6 random goods from the full table (following SRD D66 rules)
  for (let i = 0; i < numRolls; i++) {
    const roll = Math.floor(Math.random() * D66_TOTAL) + 1;
    let goodIndex = -1;
    if (roll <= D66_LEGAL_END) {
      goodIndex = (roll - 1 < legalIndices.length) ? legalIndices[roll - 1] : -1;
    } else if (roll <= D66_ILLEGAL_END) {
      const illegalRoll = roll - D66_LEGAL_END - 1;
      if ((isBlackMarket || includeIllegalGoods) && illegalRoll < illegalIndices.length) {
        goodIndex = illegalIndices[illegalRoll];
      }
    } else {
      // D66 66: Unusual Cargo
      goodIndex = TRADE_GOODS.findIndex(g => g.unusual);
    }

    // Unusual goods intentionally bypass trade code restriction (they are generic/untyped)
    if (goodIndex !== -1 && restrictTradeGoodsToCodes && !TRADE_GOODS[goodIndex]?.unusual
        && !isTradeCodeMatched(TRADE_GOODS[goodIndex])) {
      goodIndex = -1;
    }

    if (goodIndex !== -1) {
      availableGoodsTonnage.set(goodIndex, (availableGoodsTonnage.get(goodIndex) || 0) + 1);
    }
  }

  // Base purchase/sale checks (2d6 + trader skill - opponent skill + situational + traffic + zone)
  const basePurchaseCheck = simulateBrokerCheck(
    effectiveBrokerSkill,
    -supplierModifier,
    purchaseTrafficMod,
    purchaseZoneMod
  );
  const baseSaleCheck = simulateBrokerCheck(
    effectiveBrokerSkill,
    -buyerMod,
    saleTrafficMod,
    saleZoneMod
  );

  // Single pass through all goods to build both lists
  const rolledGoods = [];
  const saleGoods = [];
  const unusualGoods = [];
  const purchasePriceByName = new Map();
  let unusualFound = false;

  TRADE_GOODS.forEach((good, index) => {
    const tonnageMultiplier = availableGoodsTonnage.get(index) || 0;
    const isAvailable = tonnageMultiplier > 0;
    if (good.unusual) {
      if (isAvailable) {
        unusualFound = true;
        unusualGoods.push({ name: good.name, quantity: rollDice(good.quantity) * tonnageMultiplier });
      }
      return;
    }

    // For illegal goods, add bonus to sale check
    const illegalSaleMod = good.illegal ? getIllegalGoodsSaleModifier(good.illegal, zone, ruleset) : 0;
    const adjustedSaleCheck = clampCheck(baseSaleCheck + illegalSaleMod);

    const pricing = calculateGoodPricing(good, tradeCodes, basePurchaseCheck, adjustedSaleCheck, ruleset);
    const { purchaseAdjusted, saleAdjusted } = priceWithBroker(pricing, good.basePrice, capSameWorld, commissionPercent);

    if (isAvailable) {
      const rolledQty = rollDice(good.quantity) * tonnageMultiplier;
      rolledGoods.push({
        name: good.name,
        basePrice: good.basePrice,
        quantityFormula: good.quantity,
        rolledQuantity: rolledQty,
        purchasePriceModPercent: purchaseAdjusted.modPercent,
        purchasePrice: purchaseAdjusted.price,
        purchaseCommission: purchaseAdjusted.commission,
        salePriceModPercent: saleAdjusted.modPercent,
        salePrice: saleAdjusted.price,
        saleCommission: saleAdjusted.commission,
        purchaseDM: good.purchaseDM,
        saleDM: good.saleDM,
        illegal: good.illegal
      });

      purchasePriceByName.set(good.name, purchaseAdjusted.price);
    }

    // Add to sale list if not illegal (or if illegal goods are included).
    // Use the uncapped sale price for the sale list (cap only applies to purchase-side goods above).
    if (!good.illegal || includeIllegalGoods) {
      const purchasePrice = purchasePriceByName.get(good.name);
      const uncappedSale = applyBrokerCommission(good.basePrice, pricing.salePrice, commissionPercent);
      let salePriceAdjusted = uncappedSale.price;
      let salePriceModPercentAdjusted = uncappedSale.modPercent;

      // Cap sale price at purchase price for same-world resale prevention
      if (capSameWorld && purchasePrice !== undefined && salePriceAdjusted > purchasePrice) {
        salePriceAdjusted = purchasePrice;
        salePriceModPercentAdjusted = Math.round((salePriceAdjusted / good.basePrice) * 100);
      }

      saleGoods.push({
        good,
        salePrice: salePriceAdjusted,
        salePriceModPercent: salePriceModPercentAdjusted
      });
    }
  });

  // Supplier/port bonuses are reported for future supplier-finding rules.
  const availableGoodsCount = Array.from(availableGoodsTonnage.keys()).filter((index) => !TRADE_GOODS[index]?.unusual).length;
  let supplierInfo = game.i18n.format("TWODSIX.Trade.SupplierInfoSummary", {
    count: availableGoodsCount,
    starportBonus,
    supplierBonus
  });
  if (unusualFound) {
    supplierInfo += ` ${game.i18n.localize("TWODSIX.Trade.SupplierInfoUnusual")}`;
  }

  // Also roll for common goods (no trade-code DMs, just base checks)
  const commonGoodsRolled = COMMON_GOODS.map((good) => {
    const rolledQuantity = rollDice(good.quantity);
    let pricing;
    if (commonGoodsDMs && commonGoodsDMs[good.name]) {
      const dms = commonGoodsDMs[good.name];
      const purchaseDM = dms.purchaseDM || 0;
      const saleDM = dms.saleDM || 0;
      const purchaseCheck = clampCheck(basePurchaseCheck + purchaseDM - saleDM);
      const saleCheck = clampCheck(baseSaleCheck + saleDM - purchaseDM);
      pricing = calculatePricesFromChecks(good.basePrice, purchaseCheck, saleCheck, ruleset);
    } else {
      pricing = calculatePricesFromChecks(good.basePrice, basePurchaseCheck, baseSaleCheck, ruleset);
    }
    const { purchaseAdjusted, saleAdjusted } = priceWithBroker(pricing, good.basePrice, capSameWorld, commissionPercent);

    return {
      good,
      rolledQuantity,
      purchasePrice: purchaseAdjusted.price,
      purchasePriceModPercent: purchaseAdjusted.modPercent,
      purchaseCommission: purchaseAdjusted.commission,
      salePrice: saleAdjusted.price,
      salePriceModPercent: saleAdjusted.modPercent,
      saleCommission: saleAdjusted.commission
    };
  });

  return {
    goods: rolledGoods,
    saleGoods,
    unusualGoods,
    commonGoods: COMMON_GOODS,
    commonGoodsRolled,
    supplierInfo,
    brokerInfo,
    purchaseSkillCheck: {
      result: basePurchaseCheck,
      priceModifier: 0, // Per-good DMs applied individually, not factored into base check
      percentage: priceTable[basePurchaseCheck]?.purchase || priceTable[8].purchase
    },
    saleSkillCheck: {
      result: baseSaleCheck,
      priceModifier: 0, // No trade-code DMs for sale base check (applied per good)
      percentage: priceTable[baseSaleCheck]?.sale || priceTable[8].sale
    }
  };
}

/**
 * Create cargo component items on a world (or ship-like) actor from trade generation results.
 * Creates items for all goods: purchasable goods get quantity and buy/sell prices,
 * sale-only goods get quantity 0 with sale price for reference.
 * Clears all existing cargo items on the actor before creating new ones.
 *
 * Uses structured cargo fields:
 *   price           = base (list) price per ton
 *   buyPricePerTon  = what the supplier charges per ton
 *   sellPricePerTon = what this world's buyers will pay per ton
 *   buyPriceMod     = purchase price modifier %
 *   sellPriceMod    = sale price modifier %
 *   purchasePrice   = total paid (buyPricePerTon * quantity)
 *   quantity        = tons available (0 for sale-only reference items)
 *
 * @param actor - The Foundry actor (world, ship, etc.) to add cargo items to
 * @param tradeInfo - The TradeGenerationResult (with rows from buildTradeReportRows)
 * @returns Promise resolving to the number of cargo items created
 */
export async function createCargoItemsOnActor(actor, tradeInfo) {
  // Clear all existing cargo items on this actor first
  const existingCargo = actor.items?.filter((i) => i.type === 'component' && i.system?.subtype === COMPONENT_SUBTYPES.CARGO) || [];
  if (existingCargo.length > 0) {
    const idsToDelete = existingCargo.map((i) => i.id);
    await actor.deleteEmbeddedDocuments('Item', idsToDelete);
  }

  const rows = tradeInfo.rows || buildTradeReportRows(tradeInfo);
  const itemsData = [];

  for (const row of rows) {
    const buyPerTon = row.buyPricePerTon ?? 0;
    const sellPerTon = row.sellPricePerTon ?? 0;
    const isPurchasable = buyPerTon > 0 && row.quantity != null;
    const hasSalePrice = sellPerTon > 0;

    // Skip rows with no useful data at all (unless unusual via quantity check)
    if (!isPurchasable && !hasSalePrice && !row.quantity) {
      continue;
    }

    // qty: full quantity for purchasable or unusual goods, 0 for sale-only references
    const qty = isPurchasable ? row.quantity : (hasSalePrice ? 0 : row.quantity || 0);
    const buyMod = row.buyPriceMod ?? 100;
    const sellMod = row.sellPriceMod ?? 100;
    const basePrice = buyPerTon > 0 ? Math.round(buyPerTon / (buyMod / 100)) : Math.round(sellPerTon / (sellMod / 100));

    itemsData.push({
      name: game.i18n.localize(row.name) || 'Cargo',
      img: "systems/twodsix/assets/icons/components/cargo.svg",
      type: 'component',
      system: {
        subtype: COMPONENT_SUBTYPES.CARGO,
        status: 'operational',
        price: basePrice,
        buyPricePerTon: buyPerTon,
        sellPricePerTon: sellPerTon,
        buyPriceMod: buyMod,
        sellPriceMod: sellMod,
        purchasePrice: buyPerTon * qty,
        isIllegal: row.illegal || false,
        quantity: qty,
        weight: 1
      }
    });
  }

  if (itemsData.length === 0) {
    return 0;
  }

  await actor.createEmbeddedDocuments('Item', itemsData);
  return itemsData.length;
}

/**
 * Build and format trade report rows for display, given a TradeGenerationResult.
 * Handles price formatting, illegal marks, and percent formatting for UI.
 * @param tradeInfo - TradeGenerationResult or compatible object
 * @returns Array of row objects for report rendering
 */
export function buildTradeReportRows(tradeInfo) {
  const formatCr = num => {
    return num.toLocaleString(game.i18n.lang, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };
  const availableByName = new Map(tradeInfo.goods.map((good) => [good.name, good]));
  const rows = [];
  tradeInfo.commonGoodsRolled.forEach((item) => {
    rows.push({
      name: item.good.name,
      illegal: false,
      buyPrice: item.purchasePrice,
      buyMod: item.purchasePriceModPercent,
      buyCommission: item.purchaseCommission,
      sellPrice: item.salePrice,
      sellMod: item.salePriceModPercent,
      sellCommission: item.saleCommission,
      quantity: item.rolledQuantity
    });
  });
  tradeInfo.saleGoods.forEach((item) => {
    const available = availableByName.get(item.good.name);
    rows.push({
      name: item.good.name,
      illegal: item.good.illegal,
      buyPrice: available?.purchasePrice,
      buyMod: available?.purchasePriceModPercent,
      buyCommission: available?.purchaseCommission,
      sellPrice: item.salePrice,
      sellMod: item.salePriceModPercent,
      sellCommission: item.saleCommission,
      quantity: available?.rolledQuantity
    });
  });
  // Unusual goods: blank prices, rolled quantity, draggable
  if (tradeInfo.unusualGoods) {
    tradeInfo.unusualGoods.forEach((unusual) => {
      rows.push({
        name: unusual.name,
        illegal: false,
        buyPrice: undefined,
        buyMod: undefined,
        sellPrice: undefined,
        sellMod: undefined,
        quantity: unusual.quantity
      });
    });
  }
  return rows.map((row) => {
    const buyPricePerTon = row.buyPrice ?? 0;
    const sellPricePerTon = row.sellPrice ?? 0;
    const buyPriceMod = row.buyMod ?? 100;
    const sellPriceMod = row.sellMod ?? 100;
    const buyCommission = row.buyCommission ?? 0;
    const sellCommission = row.sellCommission ?? 0;

    let _json;
    try {
      _json = JSON.stringify({
        name: row.name,
        illegal: row.illegal,
        quantity: row.quantity,
        buyPricePerTon,
        sellPricePerTon,
        buyPriceMod,
        sellPriceMod,
        buyCommission,
        sellCommission
      });
    } catch (e) {
      console.error('TradeGenerator: Failed to serialize trade report row:', e, row);
      _json = '{}';
    }

    return {
      ...row,
      illegalMark: row.illegal ? "*" : "",
      buyPricePerTon,
      sellPricePerTon,
      buyPriceMod,
      sellPriceMod,
      buyCommission,
      sellCommission,
      buyPrice: row.buyPrice !== undefined ? `${formatCr(row.buyPrice)} ${game.i18n.localize("TWODSIX.Trade.CrPerTon")}` : "",
      buyMod: row.buyMod !== undefined ? `${row.buyMod}%` : "",
      sellPrice: row.sellPrice !== undefined ? `${formatCr(row.sellPrice)} ${game.i18n.localize("TWODSIX.Trade.CrPerTon")}` : "",
      sellMod: row.sellMod !== undefined ? `${row.sellMod}%` : "",
      _json
    };
  });
}
