/**
 * Speculative trade (buy/sell) and cached trade info for the current world visit.
 */

import { buildTradeReportRows, generateTradeInformation } from '../../../utils/TradeGenerator.js';
import { getTraderRuleset } from '../TraderRulesetRegistry.js';
import { addExpense, addRevenue, getFreeCargoSpace, getWorldCache } from '../TraderState.js';
import { chooseIntOption } from './atWorldShared.js';

/**
 * Shared helper: determine whether one cargo lot is sellable at the current world.
 * Returns sale metadata consumed by sellGoods, forceSellAllSellableCargo, and hasSellableCargoAtWorld.
 * @param {object} cargo - Cargo item from state.cargo
 * @param {import('../TraderState.js').TraderState} s
 * @param {ReturnType<typeof getWorldCache>} cache
 * @param {import('../BaseTraderRuleset.js').BaseTraderRuleset} ruleset
 * @param {Map<string, number>} salePriceMap - Trade good name → sell price per ton
 * @param {Map<string, number>} saleCommissionMap - Trade good name → sell commission per ton
 * @returns {{ isSameWorld: boolean, illegalSaleBlocked: boolean, salePrice: number|undefined, saleCommission: number }}
 */
function getCargoSaleInfo(cargo, s, cache, ruleset, salePriceMap, saleCommissionMap) {
  const isSameWorld = cargo.purchaseWorld === s.currentWorldName;
  const requiresBlackMarketBuyer = ruleset.requiresBlackMarketBuyerForIllegalSales();
  const missingIllegalBuyer = !!(cargo.isIllegal && requiresBlackMarketBuyer && !cache.foundBlackMarketBuyer);
  const illegalSaleBlocked = !!(cargo.isIllegal
    && (!s.includeIllegalGoods || cache.illegalSalesBlocked || missingIllegalBuyer));
  const salePrice = illegalSaleBlocked
    ? undefined
    : (isSameWorld ? cargo.purchasePricePerTon : salePriceMap.get(cargo.name));
  const saleCommission = isSameWorld ? 0 : (saleCommissionMap.get(cargo.name) || 0);
  return { isSameWorld, illegalSaleBlocked, salePrice, saleCommission };
}

/**
 * Return the cached trade info for the current world, generating it on first call.
 * @param {import('../TraderApp.js').TraderApp} app
 * @param {import('../../entities/TwodsixActor').default} world
 */
export function getTradeInfo(app, world) {
  const s = app.state;
  const cache = getWorldCache(s);
  const ruleset = getTraderRuleset(s.ruleset);
  const starport = world?.system?.starport || 'X';
  const rulesetOptions = ruleset.getTradeGenerationOptions(
    starport,
    s.localBrokerSkill,
    { world, useLocalBroker: s.useLocalBroker, illegal: s.localBrokerIllegal },
  );
  const priceRuleset = rulesetOptions.priceRuleset;
  const tradeGoods = rulesetOptions.tradeGoods;
  const cacheRuleset = cache.tradeInfo?.rulesetKey;
  const cachePriceRuleset = cache.tradeInfo?.priceRulesetKey;
  const cacheTradeGoodsKey = cache.tradeInfo?.tradeGoodsKey;
  const tradeGoodsKey = tradeGoods.map(good => good.name).join('|');
  if (
    !cache.tradeInfo
    || cacheRuleset !== s.ruleset
    || cachePriceRuleset !== priceRuleset
    || cacheTradeGoodsKey !== tradeGoodsKey
  ) {
    const tradeCodes = world?.system?.tradeCodes?.split(/\s+/) || [];
    const worldData = {
      name: world?.name || s.currentWorldName,
      tradeCodes,
      starport,
      zone: world?.system?.travelZone || 'Green',
      population: world?.system?.population || 0,
      traderSkill: ruleset.getPriceRollSkill(s.crew),
      useLocalBroker: s.useLocalBroker,
      localBrokerSkill: s.localBrokerSkill,
      supplierModifier: 0,
      buyerModifier: 0,
      capSameWorld: false,
      includeIllegalGoods: cache.foundBlackMarketSupplier || s.includeIllegalGoods || false,
      isBlackMarket: cache.foundBlackMarketSupplier,
    };
    const generationKey = [
      'tradeInfo',
      s.currentWorldHex,
      s.ruleset,
      priceRuleset,
      tradeGoodsKey,
      tradeCodes.join(' '),
      starport,
      worldData.zone,
      worldData.traderSkill,
      s.useLocalBroker ? s.localBrokerSkill : 'crew',
      s.localBrokerIllegal ? 'illegalBroker' : 'legalBroker',
      worldData.includeIllegalGoods ? 'illegal' : 'legal',
      worldData.isBlackMarket ? 'blackMarket' : 'standard',
    ].join('|');
    cache.tradeInfo = app.rememberGeneratedValue
      ? app.rememberGeneratedValue(generationKey, () => generateTradeInformation(worldData, ruleset.getCommonGoodsDMs(), rulesetOptions))
      : generateTradeInformation(worldData, ruleset.getCommonGoodsDMs(), rulesetOptions);
    cache.tradeInfo.rulesetKey = s.ruleset;
    cache.tradeInfo.priceRulesetKey = priceRuleset;
    cache.tradeInfo.tradeGoodsKey = tradeGoodsKey;
  }
  return cache.tradeInfo;
}

/**
 * @param {import('../TraderApp.js').TraderApp} app
 * @param {import('../../entities/TwodsixActor').default} world
 */
export async function buyGoods(app, world) {
  const s = app.state;
  const cache = getWorldCache(s);
  const freeSpace = getFreeCargoSpace(s);

  if (freeSpace <= 0) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.NoCargoSpaceSpeculative'));
    return;
  }

  if (s.credits <= 0) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.InsufficientCreditsSpeculative'));
    return;
  }

  const tradeInfo = getTradeInfo(app, world);
  const rows = buildTradeReportRows(tradeInfo);

  const buyable = rows.filter(r => r.buyPricePerTon > 0 && r.quantity > 0 && r.buyPricePerTon <= s.credits);

  if (!buyable.length) {
    cache.noGoodsAvailable = true;
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.NoAffordableGoods'));
    return;
  }

  const goodOptions = buyable.map(r => ({
    value: r.name,
    label: `${game.i18n.localize(r.name)} — Cr${r.buyPricePerTon.toLocaleString()}/t, ${r.quantity}t avail`,
  }));
  goodOptions.unshift({ value: 'none', label: game.i18n.localize('TWODSIX.Trader.Actions.NoBuy') });

  const chosen = await app._choose(game.i18n.localize('TWODSIX.Trader.Prompts.BuyGoods'), goodOptions);
  if (chosen === 'none') {
    return;
  }

  const good = buyable.find(r => r.name === chosen);
  if (!good) {
    return;
  }

  const maxTons = Math.min(good.quantity, freeSpace, Math.floor(s.credits / good.buyPricePerTon));
  const qtyOptions = [];
  for (let i = 1; i <= maxTons; i++) {
    qtyOptions.push({ value: String(i), label: `${i} tons — Cr${(i * good.buyPricePerTon).toLocaleString()}` });
  }

  const qty = await chooseIntOption(app,
    game.i18n.format('TWODSIX.Trader.Prompts.BuyQuantity', { good: game.i18n.localize(good.name) }),
    qtyOptions,
    maxTons,
  );

  if (qty > 0) {
    const cost = qty * good.buyPricePerTon;
    const commission = qty * (good.buyCommission || 0);
    const totalCost = cost + commission;
    if (s.credits < totalCost) {
      await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.InsufficientCreditsBroker', { total: totalCost.toLocaleString() }));
      return;
    }
    addExpense(s, totalCost);
    s.cargo.push({
      name: good.name,
      tons: qty,
      purchasePricePerTon: good.buyPricePerTon,
      purchaseWorld: s.currentWorldName,
      commissionPaid: commission,
      isIllegal: good.illegal || false,
    });
    let logMsg = game.i18n.format('TWODSIX.Trader.Log.BoughtGoods', {
      qty: qty,
      type: game.i18n.localize(good.name),
      price: good.buyPricePerTon.toLocaleString(),
      total: totalCost.toLocaleString(),
    });
    await app.logEvent(logMsg + ` Credits: Cr${s.credits.toLocaleString()}.`);

    const ruleset = getTraderRuleset(s.ruleset);
    if (ruleset.shouldRollCargoTag()) {
      await ruleset.rollCargoTag(app);
    }
    if (ruleset.shouldRollProblemWithDeal()) {
      await ruleset.rollProblemWithDeal(app);
    }
  }
}

/**
 * @param {import('../TraderApp.js').TraderApp} app
 * @param {import('../../entities/TwodsixActor').default} world
 */
export async function sellGoods(app, world) {
  const s = app.state;
  const cache = getWorldCache(s);
  const ruleset = getTraderRuleset(s.ruleset);

  if (!s.cargo.length) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.NoCargoToSell'));
    return;
  }

  const tradeInfo = getTradeInfo(app, world);
  const rows = buildTradeReportRows(tradeInfo);

  const salePriceMap = new Map();
  const saleCommissionMap = new Map();
  for (const r of rows) {
    if (r.sellPricePerTon > 0) {
      salePriceMap.set(r.name, r.sellPricePerTon);
      saleCommissionMap.set(r.name, r.sellCommission || 0);
    }
  }

  const sellOptions = s.cargo.map((c, idx) => {
    const { isSameWorld, illegalSaleBlocked, salePrice, saleCommission } = getCargoSaleInfo(c, s, cache, ruleset, salePriceMap, saleCommissionMap);

    let label = `${game.i18n.localize(c.name)} (${c.tons}t)`;
    if (illegalSaleBlocked) {
      label += ` — (${game.i18n.localize('TWODSIX.Trader.Log.IllegalSalesBlocked')})`;
    } else if (isSameWorld) {
      label += game.i18n.format('TWODSIX.Trader.Log.SellOptionSameWorld', {
        price: salePrice.toLocaleString(),
      });
    } else if (salePrice !== undefined) {
      const profit = salePrice - c.purchasePricePerTon - saleCommission;
      const profitStr = profit >= 0 ? `+Cr${profit.toLocaleString()}` : `-Cr${Math.abs(profit).toLocaleString()}`;
      label += game.i18n.format('TWODSIX.Trader.Log.SellOptionWithProfitAfterCommission', {
        price: salePrice.toLocaleString(),
        profit: profitStr,
      });
    } else {
      label += ` — (${game.i18n.localize('TWODSIX.Trader.Log.NoBuyerFoundAtPort')})`;
    }
    return {
      value: String(idx),
      label,
      salePrice,
      saleCommission,
      isSameWorld,
      illegalSaleBlocked,
    };
  });
  sellOptions.unshift({ value: 'none', label: game.i18n.localize('TWODSIX.Trader.Actions.NoSell') });

  const chosenIdx = await app._choose(game.i18n.localize('TWODSIX.Trader.Prompts.SellGoods'), sellOptions);
  if (chosenIdx === 'none') {
    return;
  }

  const idx = Number.parseInt(chosenIdx, 10);
  const cargo = s.cargo[idx];
  const selectedOption = sellOptions.find(o => o.value === chosenIdx);
  if (!cargo || selectedOption?.salePrice === undefined) {
    if (cargo) {
      const logKey = selectedOption?.illegalSaleBlocked
        ? 'TWODSIX.Trader.Log.IllegalSalesBlocked'
        : 'TWODSIX.Trader.Log.NoBuyerFound';
      await app.logEvent(game.i18n.format(logKey, { good: game.i18n.localize(cargo.name) }));
    }
    return;
  }

  const option = selectedOption;
  const salePrice = option.salePrice;
  const isSameWorld = option.isSameWorld;
  const commission = isSameWorld ? 0 : cargo.tons * (option.saleCommission || 0);
  const revenue = cargo.tons * salePrice;
  const netRevenue = revenue - commission;
  const cost = cargo.tons * cargo.purchasePricePerTon;
  const profit = netRevenue - cost;

  addRevenue(s, netRevenue);
  s.cargo.splice(idx, 1);

  const profitStr = isSameWorld
    ? game.i18n.localize('TWODSIX.Trader.Log.TransactionCancelledRefunded')
    : (profit >= 0
      ? game.i18n.format('TWODSIX.Trader.Log.Profit', { profit: profit.toLocaleString() })
      : game.i18n.format('TWODSIX.Trader.Log.Loss', { loss: Math.abs(profit).toLocaleString() }));
  let logMsg = isSameWorld
    ? game.i18n.format('TWODSIX.Trader.Log.CancelledPurchase', {
      qty: cargo.tons,
      type: game.i18n.localize(cargo.name),
      price: salePrice.toLocaleString(),
    })
    : game.i18n.format('TWODSIX.Trader.Log.SoldGoods', {
      qty: cargo.tons,
      type: game.i18n.localize(cargo.name),
      price: salePrice.toLocaleString(),
      total: revenue.toLocaleString(),
    });
  if (commission > 0) {
    logMsg += game.i18n.format('TWODSIX.Trader.Log.BrokerCommissionPaid', {
      commission: commission.toLocaleString(),
    });
  }
  logMsg += game.i18n.format('TWODSIX.Trader.Log.NetRevenueCredits', {
    revenue: netRevenue.toLocaleString(),
    profitStr,
    credits: s.credits.toLocaleString(),
  });
  await app.logEvent(logMsg);
}

/**
 * Force-sell all currently sellable cargo lots (no prompt), used as a last
 * liquidation step before bankruptcy checks.
 * A lot is sellable iff:
 * - it has a buyer price at this world (or is same-world refund),
 * - and it is not blocked by illegal-sales rules.
 * @param {import('../TraderApp.js').TraderApp} app
 * @param {import('../../entities/TwodsixActor').default} world
 * @returns {Promise<{soldLots:number, netRevenue:number}>}
 */
export async function forceSellAllSellableCargo(app, world) {
  const s = app.state;
  const cache = getWorldCache(s);
  const ruleset = getTraderRuleset(s.ruleset);
  if (!Array.isArray(s.cargo) || s.cargo.length === 0) {
    return { soldLots: 0, netRevenue: 0 };
  }

  const tradeInfo = getTradeInfo(app, world);
  const rows = buildTradeReportRows(tradeInfo);
  const salePriceMap = new Map();
  const saleCommissionMap = new Map();
  for (const r of rows) {
    if (r.sellPricePerTon > 0) {
      salePriceMap.set(r.name, r.sellPricePerTon);
      saleCommissionMap.set(r.name, r.sellCommission || 0);
    }
  }

  let soldLots = 0;
  let netRevenue = 0;
  const remaining = [];
  for (const cargo of s.cargo) {
    const { isSameWorld, salePrice } = getCargoSaleInfo(cargo, s, cache, ruleset, salePriceMap, saleCommissionMap);
    if (salePrice === undefined) {
      remaining.push(cargo);
      continue;
    }
    const commission = isSameWorld ? 0 : cargo.tons * (saleCommissionMap.get(cargo.name) || 0);
    const revenue = cargo.tons * salePrice;
    const net = revenue - commission;
    addRevenue(s, net);
    soldLots += 1;
    netRevenue += net;
  }
  s.cargo = remaining;

  if (soldLots > 0) {
    await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.ForcedCargoLiquidation', {
      lots: soldLots,
      revenue: netRevenue.toLocaleString(),
      credits: s.credits.toLocaleString(),
    }));
  }
  return { soldLots, netRevenue };
}

/**
 * Determine whether any cargo lot is currently sellable at this world.
 * Uses the same gate conditions as sell/liquidation flows.
 * @param {import('../TraderApp.js').TraderApp} app
 * @param {import('../../entities/TwodsixActor').default} world
 * @returns {boolean}
 */
export function hasSellableCargoAtWorld(app, world) {
  const s = app.state;
  const cache = getWorldCache(s);
  const ruleset = getTraderRuleset(s.ruleset);
  if (!Array.isArray(s.cargo) || s.cargo.length === 0) {
    return false;
  }

  const tradeInfo = getTradeInfo(app, world);
  const rows = buildTradeReportRows(tradeInfo);
  const salePriceMap = new Map();
  for (const r of rows) {
    if (r.sellPricePerTon > 0) {
      salePriceMap.set(r.name, r.sellPricePerTon);
    }
  }

  const emptyCommissionMap = new Map();
  return s.cargo.some(cargo => {
    const { isSameWorld, illegalSaleBlocked, salePrice } = getCargoSaleInfo(cargo, s, cache, ruleset, salePriceMap, emptyCommissionMap);
    if (illegalSaleBlocked) {
      return false;
    }
    if (isSameWorld) {
      return true;
    }
    return salePrice !== undefined;
  });
}
