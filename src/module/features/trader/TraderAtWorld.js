/**
 * TraderAtWorld.js
 * Logic for actions available while docked at a world.
 */

import { buildTradeReportRows, generateTradeInformation } from '../../utils/TradeGenerator.js';
import { SEARCH_METHOD } from './BaseTraderRuleset.js';
import { getReachableWorlds } from './SubsectorLoader.js';
import {
  BULK_LS_CARGO_ID,
  BULK_LS_LUXURY_COST,
  BULK_LS_NORMAL_COST,
  CHEAT_FREE_FUEL_DAYS,
  FREIGHT_AVAILABILITY,
  FREIGHT_RATE,
  FUEL_CHEAT_MULTIPLIER,
  FUEL_COST,
  FUEL_SKIM_RATE,
  HOURS_PER_DAY,
  MAIL_CONTRACT_THRESHOLD,
  MAIL_PAYMENT,
  PASSENGER_AVAILABILITY,
  PASSENGER_REVENUE,
  PORT_FEE_BASE
} from './TraderConstants.js';
import { getTraderRuleset } from './TraderRulesetRegistry.js';
import {
  addExpense,
  addRevenue,
  advanceDate,
  getAbsoluteDay,
  getFreeCargoSpace,
  getFreeLowBerths,
  getFreeStaterooms,
  getMonthNumber,
  getWorldCache,
  PHASE,
  subtractRevenue,
  updateMortgageFromShip,
} from './TraderState.js';
import {
  canRefuelAtWorld,
  collectWorldsFromFolder,
  deduplicateWorlds,
  getRefuelOptions,
  getWorldCoordinate,
  hexDistance,
  isLocalMode,
  traderDebug,
  worldsInJumpRange
} from './TraderUtils.js';

/**
 * Get the best available broker skill (crew vs hired)
 * @param {import('./TraderState.js').TraderState} s - TraderState
 * @param {string} starport - Current starport class
 * @returns {number}
 */
function getEffectiveBrokerSkillForWorld(s, starport) {
  const ruleset = getTraderRuleset(s.ruleset);
  const crewSkill = ruleset.getPriceRollSkill(s.crew);
  if (!s.useLocalBroker) {
    return crewSkill;
  }
  const maxSkill = ruleset.getBrokerMaxSkill(starport);
  const hiredSkill = Math.min(s.localBrokerSkill, maxSkill);
  return Math.max(crewSkill, hiredSkill);
}

/**
 * Build the action list for the current AT_WORLD step.
 * @param {import('./TraderApp.js').TraderApp} app
 * @param {import('../../entities/TwodsixActor').default} world
 * @param {Record<string, string>} ACTION
 * @param {ReturnType<typeof getWorldCache>} cache
 * @returns {Promise<Array<{value: string, label: string}>>}
 */
async function buildAtWorldActions(app, world, ACTION, cache) {
  const s = app.state;
  const actions = [];

  if (s.destinationHex) {
    actions.push({ value: ACTION.CHOOSE_DESTINATION, label: game.i18n.format('TWODSIX.Trader.Actions.ChooseDestinationCurrent', { destination: s.destinationName }) });
  } else {
    actions.push({ value: ACTION.CHOOSE_DESTINATION, label: game.i18n.localize('TWODSIX.Trader.Actions.ChooseDestination') });
  }

  actions.push({ value: ACTION.HIRE_BROKER, label: game.i18n.localize('TWODSIX.Trader.Actions.HireBroker') });

  if (!cache.foundSupplier) {
    actions.push({ value: ACTION.FIND_SUPPLIER, label: game.i18n.localize('TWODSIX.Trader.Actions.FindSupplier') });
  }
  if (s.cargo.length > 0 && !cache.foundBuyer) {
    actions.push({ value: ACTION.FIND_BUYER, label: game.i18n.localize('TWODSIX.Trader.Actions.FindBuyer') });
  }

  const paxMarketEmpty = cache.passengers !== null
    && cache.passengers.high === 0 && cache.passengers.middle === 0 && cache.passengers.low === 0;
  const paxShipFull = getFreeStaterooms(s) <= 0 && getFreeLowBerths(s) <= 0;
  if (cache.foundSupplier && !paxMarketEmpty && !paxShipFull) {
    actions.push({ value: ACTION.PASSENGERS, label: game.i18n.localize('TWODSIX.Trader.Actions.SeekPassengers') });
  }

  const freightMarketEmpty = cache.freight !== null && cache.freight === 0;
  if (cache.foundSupplier && !freightMarketEmpty && getFreeCargoSpace(s) > 0) {
    actions.push({ value: ACTION.FREIGHT, label: game.i18n.localize('TWODSIX.Trader.Actions.SeekFreight') });
  }

  if (cache.foundSupplier && s.ship.armed && getFreeCargoSpace(s) >= 5) {
    actions.push({ value: ACTION.MAIL, label: game.i18n.localize('TWODSIX.Trader.Actions.SeekMail') });
  }
  if (cache.foundSupplier && getFreeCargoSpace(s) > 0 && s.credits > 0 && !cache.noGoodsAvailable) {
    actions.push({ value: ACTION.BUY, label: game.i18n.localize('TWODSIX.Trader.Actions.BuyGoods') });
  }
  if (cache.foundBuyer && s.cargo.length > 0) {
    actions.push({ value: ACTION.SELL, label: game.i18n.localize('TWODSIX.Trader.Actions.SellGoods') });
  }

  const hasBulkInCargo = s.cargo.some(c => getBulkLifeSupportCargoId(c) !== null);
  if (getFreeCargoSpace(s) > 0 && s.credits >= Math.min(BULK_LS_NORMAL_COST, BULK_LS_LUXURY_COST)) {
    actions.push({ value: ACTION.BUY_BULK_LS, label: game.i18n.localize('TWODSIX.Trader.Actions.BuyBulkLifeSupport') });
  }
  if (hasBulkInCargo) {
    actions.push({ value: ACTION.SELL_BULK_LS, label: game.i18n.localize('TWODSIX.Trader.Actions.SellBulkLifeSupport') });
  }

  if (s.ship.currentFuel < s.ship.fuelCapacity) {
    const refuelNote = canRefuelAtWorld(world) ? "" : " ⚠️";
    actions.push({ value: ACTION.REFUEL, label: game.i18n.localize('TWODSIX.Trader.Actions.Refuel') + refuelNote });
  }

  if (s.destinationHex && !cache.privateMessagesTaken) {
    actions.push({ value: ACTION.PRIVATE_MESSAGES, label: game.i18n.localize('TWODSIX.Trader.Actions.PrivateMessages') });
  }

  const illegalLabel = s.includeIllegalGoods ? 'TWODSIX.Trader.Actions.DisableIllegal' : 'TWODSIX.Trader.Actions.EnableIllegal';
  actions.push({ value: ACTION.TOGGLE_ILLEGAL, label: game.i18n.localize(illegalLabel) });

  if (s.destinationHex && !s.chartered) {
    const { computeCharterFee } = await import('./TraderCharter.js');
    const charterFee = computeCharterFee(s);
    actions.push({
      value: ACTION.CHARTER,
      label: game.i18n.format('TWODSIX.Trader.Actions.AcceptCharter', { destination: s.destinationName, fee: charterFee.toLocaleString() }),
    });
  }

  actions.push({ value: ACTION.OTHER_ACTIVITIES, label: game.i18n.localize('TWODSIX.Trader.Actions.OtherActivities') });
  actions.push({ value: ACTION.DEPART, label: game.i18n.localize('TWODSIX.Trader.Actions.Depart') });

  return actions;
}

/**
 * Main function to handle the AT_WORLD phase loop.
 * @param {import('./TraderApp.js').TraderApp} app - The application instance
 * @param {import('../../entities/TwodsixActor').default} world - Current world actor
 * @param {string} ACTION - Action identifiers (imported from TraderLogic or passed in)
 */
export async function atWorldPhase(app, world, ACTION) {
  const s = app.state;
  traderDebug('TraderAtWorld', ` atWorldPhase starting`, { world: world?.name, hex: s.currentWorldHex });

  while (s.phase === PHASE.AT_WORLD) {
    traderDebug('TraderAtWorld', ` atWorldPhase loop iteration`, { phase: s.phase, destinationHex: s.destinationHex });
    // Check charter expiry
    if (s.chartered && s.charterExpiryDay && getAbsoluteDay(s.gameDate, s.milieu) >= s.charterExpiryDay) {
      s.chartered = false;
      s.charterCargo = 0;
      s.charterStaterooms = 0;
      s.charterLowBerths = 0;
      s.charterExpiryDay = null;
      await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.CharterEnded'));
    }

    const cache = getWorldCache(s);

    const actions = await buildAtWorldActions(app, world, ACTION, cache);

    const action = await app._choose(
      game.i18n.format('TWODSIX.Trader.Prompts.AtWorld', { world: s.currentWorldName }),
      actions
    );
    traderDebug('TraderAtWorld', ` atWorldPhase choice resolved: ${action}`);

    if (!action) {
      console.warn('Twodsix | Trader: atWorldPhase - no action selected or choice cancelled.');
      break;
    }

    switch (action) {
      case ACTION.CHOOSE_DESTINATION:
        await chooseDestination(app);
        break;
      case ACTION.PASSENGERS:
        await seekPassengers(app, world);
        break;
      case ACTION.FREIGHT:
        await seekFreight(app, world);
        break;
      case ACTION.MAIL:
        await seekMail(app);
        break;
      case ACTION.BUY:
        await buyGoods(app, world);
        break;
      case ACTION.SELL:
        await sellGoods(app, world);
        break;
      case ACTION.HIRE_BROKER:
        await hireBroker(app, world);
        break;
      case ACTION.FIND_SUPPLIER:
        await findSupplier(app, world);
        break;
      case ACTION.FIND_BUYER:
        await findBuyer(app, world);
        break;
      case ACTION.BUY_BULK_LS:
        await buyBulkLifeSupport(app);
        break;
      case ACTION.SELL_BULK_LS:
        await sellBulkLifeSupport(app);
        break;
      case ACTION.REFUEL:
        await refuel(app, world);
        break;
      case ACTION.PRIVATE_MESSAGES:
        await takePrivateMessages(app);
        break;
      case ACTION.TOGGLE_ILLEGAL:
        s.includeIllegalGoods = !s.includeIllegalGoods;
        cache.tradeInfo = null; // Invalidate trade info
        await app.logEvent(s.includeIllegalGoods ? game.i18n.localize('TWODSIX.Trader.Log.BlackMarketActivated') : game.i18n.localize('TWODSIX.Trader.Log.BlackMarketDeactivated'));
        break;
      case ACTION.CHARTER: {
        const { acceptCharter } = await import('./TraderCharter.js');
        await acceptCharter(app);
        break;
      }
      case ACTION.OTHER_ACTIVITIES:
        await otherActivities(app);
        break;
      case ACTION.DEPART: {
        const { depart } = await import('./TraderTransit.js');
        await depart(app);
        break;
      }
    }
  }
}

/**
 * Resolve a numeric choice safely with fallback to 0.
 * @param {import('./TraderApp.js').TraderApp} app
 * @param {string} prompt
 * @param {Array<{value: string, label: string}>} options
 * @param {string|number|null} [maxValue=null]
 * @returns {Promise<number>}
 */
async function chooseIntOption(app, prompt, options, maxValue = null) {
  const raw = await app._choose(prompt, options, maxValue);
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getBulkLifeSupportCargoId(cargoItem) {
  if (cargoItem?.cargoId) {
    return cargoItem.cargoId;
  }
  const normalName = game.i18n.localize('TWODSIX.Trader.BulkLSNormal');
  const luxuryName = game.i18n.localize('TWODSIX.Trader.BulkLSLuxury');
  if (cargoItem?.name === normalName) {
    return BULK_LS_CARGO_ID.NORMAL;
  }
  if (cargoItem?.name === luxuryName) {
    return BULK_LS_CARGO_ID.LUXURY;
  }
  return null;
}

// ─── Seek Passengers ──────────────────────────────────────────

export async function seekPassengers(app, world) {
  const s = app.state;
  const cache = getWorldCache(s);

  // Roll availability once per visit, then reuse the same figures
  if (!cache.passengers) {
    const starport = world?.system?.starport || 'X';
    const avail = PASSENGER_AVAILABILITY[starport] || PASSENGER_AVAILABILITY.X;
    cache.passengers = {
      high: Math.max(0, await app._roll(avail.high)),
      middle: Math.max(0, await app._roll(avail.middle)),
      low: Math.max(0, await app._roll(avail.low)),
    };
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.PassengerMarket", {
      high: cache.passengers.high,
      mid: cache.passengers.middle,
      low: cache.passengers.low,
      world: s.currentWorldName
    }));
  }

  const { high: highAvail, middle: midAvail, low: lowAvail } = cache.passengers;

  if (highAvail === 0 && midAvail === 0 && lowAvail === 0) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.NoPassengersAvailable'));
    return;
  }

  // High passengers
  await bookPassengerClass(app, 'high', highAvail, getFreeStaterooms(s), PASSENGER_REVENUE.high, 'TWODSIX.Trader.Prompts.HighPassengers');

  // Middle passengers (capacity re-evaluated inside)
  await bookPassengerClass(app, 'middle', cache.passengers.middle, getFreeStaterooms(s), PASSENGER_REVENUE.middle, 'TWODSIX.Trader.Prompts.MiddlePassengers');

  // Low passengers
  await bookPassengerClass(app, 'low', cache.passengers.low, getFreeLowBerths(s), PASSENGER_REVENUE.low, 'TWODSIX.Trader.Prompts.LowPassengers');
}

/**
 * Helper to book a specific class of passengers.
 */
async function bookPassengerClass(app, classKey, available, capacity, revenuePerHead, promptKey) {
  const s = app.state;
  const cache = getWorldCache(s);

  if (available > 0 && capacity > 0) {
    const maxBook = Math.min(available, capacity);
    const options = [];
    for (let i = 0; i <= maxBook; i++) {
      options.push({ value: String(i), label: `${i} ${classKey} passengers (Cr${(i * revenuePerHead).toLocaleString()})` });
    }
    const count = await chooseIntOption(app, game.i18n.localize(promptKey), options, maxBook);
    if (count > 0) {
      s.passengers[classKey] += count;
      cache.passengers[classKey] -= count;
      const rev = count * revenuePerHead;
      await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.BookedPassengers", {
        count: count,
        type: classKey,
        revenue: rev.toLocaleString()
      }));
    }
  }
}

// ─── Seek Freight ─────────────────────────────────────────────

export async function seekFreight(app, world) {
  const s = app.state;
  const cache = getWorldCache(s);

  // Roll freight availability once per visit
  if (cache.freight === null) {
    const starport = world?.system?.starport || 'X';
    const formula = FREIGHT_AVAILABILITY[starport] || '0';
    cache.freight = Math.max(0, await app._roll(formula));
  }

  const available = cache.freight;
  const freeSpace = getFreeCargoSpace(s);

  if (available === 0 || freeSpace === 0) {
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.NoFreightAvailable", {
      offered: available,
      free: freeSpace
    }));
    return;
  }

  const maxTons = Math.min(available, freeSpace);
  const options = [];
  // Offer in increments for large amounts
  const step = maxTons > 20 ? 5 : 1;
  for (let i = 0; i <= maxTons; i += step) {
    options.push({ value: String(i), label: `${i} tons (Cr${(i * FREIGHT_RATE).toLocaleString()})` });
  }
  if (maxTons % step !== 0) {
    options.push({ value: String(maxTons), label: `${maxTons} tons (Cr${(maxTons * FREIGHT_RATE).toLocaleString()})` });
  }

  const tons = await chooseIntOption(app,
    game.i18n.format('TWODSIX.Trader.Prompts.Freight', { available, freeSpace }),
    options,
    maxTons
  );

  if (tons > 0) {
    s.freight += tons;
    cache.freight -= tons;
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.LoadedFreight", {
      tons: tons,
      revenue: (tons * FREIGHT_RATE).toLocaleString()
    }));
  }
}

// ─── Seek Mail ────────────────────────────────────────────────

export async function seekMail(app) {
  const s = app.state;
  if (s.hasMail) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.AlreadyCarryingMail'));
    return;
  }

  const cache = getWorldCache(s);
  if (cache.mailChecked) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.AlreadyCheckedMail'));
    return;
  }

  // Simple roll: 2D6 >= MAIL_CONTRACT_THRESHOLD to get mail contract; checked once per world visit
  const roll = await app._roll('2D6');
  cache.mailChecked = true;
  if (roll >= MAIL_CONTRACT_THRESHOLD) {
    s.hasMail = true;
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.MailContractSecured", { revenue: MAIL_PAYMENT.toLocaleString() }));
  } else {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.NoMailAvailable'));
  }
}

// ─── Buy Goods (Speculative Trade) ───────────────────────────

/** Return the cached trade info for the current world, generating it on first call. */
export function getTradeInfo(app, world) {
  const s = app.state;
  const cache = getWorldCache(s);
  if (!cache.tradeInfo) {
    const ruleset = getTraderRuleset(s.ruleset);
    const worldData = {
      name: world?.name || s.currentWorldName,
      tradeCodes: world?.system?.tradeCodes?.split(/\s+/) || [],
      starport: world?.system?.starport || 'X',
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
    cache.tradeInfo = generateTradeInformation(worldData, ruleset.getCommonGoodsDMs());
  }
  return cache.tradeInfo;
}

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

  // Filter to goods that have a buy price and that we can afford at least 1 ton
  const buyable = rows.filter(r => r.buyPricePerTon > 0 && r.quantity > 0 && r.buyPricePerTon <= s.credits);

  if (!buyable.length) {
    cache.noGoodsAvailable = true;
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.NoAffordableGoods'));
    return;
  }

  // Let player pick which good to buy
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

  // Pick quantity
  const maxTons = Math.min(good.quantity, freeSpace, Math.floor(s.credits / good.buyPricePerTon));
  const qtyOptions = [];
  for (let i = 1; i <= maxTons; i++) {
    qtyOptions.push({ value: String(i), label: `${i} tons — Cr${(i * good.buyPricePerTon).toLocaleString()}` });
  }

  const qty = await chooseIntOption(app,
    game.i18n.format('TWODSIX.Trader.Prompts.BuyQuantity', { good: game.i18n.localize(good.name) }),
    qtyOptions,
    maxTons
  );

  if (qty > 0) {
    const cost = qty * good.buyPricePerTon;
    const commission = qty * (good.buyCommission || 0);
    const totalCost = cost + commission;
    if (s.credits < totalCost) {
      await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.InsufficientCreditsBroker", { total: totalCost.toLocaleString() }));
      return;
    }
    addExpense(s, totalCost);
    s.cargo.push({
      name: good.name,
      tons: qty,
      purchasePricePerTon: good.buyPricePerTon,
      purchaseWorld: s.currentWorldName,
      commissionPaid: commission,
    });
    let logMsg = game.i18n.format("TWODSIX.Trader.Log.BoughtGoods", {
      qty: qty,
      type: game.i18n.localize(good.name),
      price: good.buyPricePerTon.toLocaleString(),
      total: totalCost.toLocaleString()
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

// ─── Sell Goods ──────────────────────────────────────────────

export async function sellGoods(app, world) {
  const s = app.state;

  if (!s.cargo.length) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.NoCargoToSell'));
    return;
  }

  // Use the same cached trade info as buyGoods (prices fixed for this visit)
  const tradeInfo = getTradeInfo(app, world);
  const rows = buildTradeReportRows(tradeInfo);

  // Build sale price lookup
  const salePriceMap = new Map();
  const saleCommissionMap = new Map();
  for (const r of rows) {
    if (r.sellPricePerTon > 0) {
      salePriceMap.set(r.name, r.sellPricePerTon);
      saleCommissionMap.set(r.name, r.sellCommission || 0);
    }
  }

  // Let player pick cargo to sell
  const sellOptions = s.cargo.map((c, idx) => {
    const isSameWorld = c.purchaseWorld === s.currentWorldName;
    const salePrice = isSameWorld ? c.purchasePricePerTon : salePriceMap.get(c.name);
    const saleCommission = isSameWorld ? 0 : (saleCommissionMap.get(c.name) || 0);

    let label = `${game.i18n.localize(c.name)} (${c.tons}t)`;
    if (isSameWorld) {
      label += ` — Cr${salePrice.toLocaleString()}/t (Full Refund/Cancel)`;
    } else if (salePrice !== undefined) {
      const profit = salePrice - c.purchasePricePerTon - saleCommission;
      const profitStr = profit >= 0 ? `+Cr${profit.toLocaleString()}` : `-Cr${Math.abs(profit).toLocaleString()}`;
      label += ` — Cr${salePrice.toLocaleString()}/t [${profitStr}/t after commission]`;
    } else {
      label += ` — (No buyer found at this port)`;
    }
    return {
      value: String(idx),
      label,
      salePrice,
      saleCommission,
      isSameWorld,
    };
  });
  sellOptions.unshift({ value: 'none', label: game.i18n.localize('TWODSIX.Trader.Actions.NoSell') });

  const chosenIdx = await app._choose(game.i18n.localize('TWODSIX.Trader.Prompts.SellGoods'), sellOptions);
  if (chosenIdx === 'none') {
    return;
  }

  const idx = Number.parseInt(chosenIdx, 10);
  const cargo = s.cargo[idx];
  if (!cargo || sellOptions.find(o => o.value === chosenIdx)?.salePrice === undefined) {
    if (cargo) {
      await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.NoBuyerFound", { good: game.i18n.localize(cargo.name) }));
    }
    return;
  }

  const option = sellOptions.find(o => o.value === chosenIdx);
  const salePrice = option.salePrice;
  const isSameWorld = option.isSameWorld;
  const commission = isSameWorld ? 0 : cargo.tons * (option.saleCommission || 0);
  const revenue = cargo.tons * salePrice;
  const netRevenue = revenue - commission;
  const cost = cargo.tons * cargo.purchasePricePerTon;
  const profit = netRevenue - cost;

  addRevenue(s, netRevenue);
  s.cargo.splice(idx, 1);

  const profitStr = isSameWorld ? 'Transaction cancelled (Refunded)' : (profit >= 0 ? `Profit: Cr${profit.toLocaleString()}` : `Loss: Cr${Math.abs(profit).toLocaleString()}`);
  let logMsg = isSameWorld ? `Cancelled purchase of ${cargo.tons}t ${game.i18n.localize(cargo.name)} at Cr${salePrice.toLocaleString()}/t.` : `Sold ${cargo.tons}t ${game.i18n.localize(cargo.name)} at Cr${salePrice.toLocaleString()}/t.`;
  if (commission > 0) {
    logMsg += ` Paid Cr${commission.toLocaleString()} broker commission.`;
  }
  logMsg += ` Net Revenue: Cr${netRevenue.toLocaleString()}. ${profitStr}. Credits: Cr${s.credits.toLocaleString()}.`;
  await app.logEvent(logMsg);
}

// ─── Bulk Life Support ───────────────────────────────────────

export async function buyBulkLifeSupport(app) {
  const s = app.state;
  const freeSpace = getFreeCargoSpace(s);

  if (freeSpace <= 0) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.NoFreeCargoSpaceBulk'));
    return;
  }

  const options = [];
  if (s.credits >= BULK_LS_NORMAL_COST) {
    options.push({ value: 'normal', label: `${game.i18n.localize('TWODSIX.Trader.BulkLSNormal')} — Cr${BULK_LS_NORMAL_COST.toLocaleString()}/t` });
  }
  if (s.credits >= BULK_LS_LUXURY_COST) {
    options.push({ value: 'luxury', label: `${game.i18n.localize('TWODSIX.Trader.BulkLSLuxury')} — Cr${BULK_LS_LUXURY_COST.toLocaleString()}/t` });
  }
  options.push({ value: 'none', label: game.i18n.localize('TWODSIX.Trader.Actions.NoBuy') });

  const type = await app._choose(game.i18n.localize('TWODSIX.Trader.Prompts.BuyBulkLS'), options);
  if (type === 'none') {
    return;
  }

  const costPerTon = type === 'normal' ? BULK_LS_NORMAL_COST : BULK_LS_LUXURY_COST;
  const itemName = type === 'normal' ? 'TWODSIX.Trader.BulkLSNormal' : 'TWODSIX.Trader.BulkLSLuxury';

  const maxTons = Math.min(freeSpace, Math.floor(s.credits / costPerTon));
  const qtyOptions = [];
  for (let i = 1; i <= maxTons; i++) {
    qtyOptions.push({ value: String(i), label: `${i} tons — Cr${(i * costPerTon).toLocaleString()}` });
  }

  const qty = await chooseIntOption(app,
    game.i18n.format('TWODSIX.Trader.Prompts.BuyQuantity', { good: game.i18n.localize(itemName) }),
    qtyOptions,
    maxTons
  );

  if (qty > 0) {
    const totalCost = qty * costPerTon;
    addExpense(s, totalCost);

    const localizedName = game.i18n.localize(itemName);
    const cargoId = type === 'normal' ? BULK_LS_CARGO_ID.NORMAL : BULK_LS_CARGO_ID.LUXURY;
    const existing = s.cargo.find(c => getBulkLifeSupportCargoId(c) === cargoId);
    if (existing) {
      existing.tons += qty;
    } else {
      s.cargo.push({
        cargoId,
        name: localizedName,
        tons: qty,
        purchasePricePerTon: costPerTon,
        purchaseWorld: s.currentWorldName,
      });
    }
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.BoughtGoods", {
      qty: qty,
      type: game.i18n.localize(itemName),
      price: costPerTon.toLocaleString(),
      total: totalCost.toLocaleString()
    }) + ` Credits: Cr${s.credits.toLocaleString()}.`);
  }
}

export async function sellBulkLifeSupport(app) {
  const s = app.state;
  const bulkCargo = s.cargo.filter(c => getBulkLifeSupportCargoId(c) !== null);

  if (!bulkCargo.length) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.NoBulkSuppliesToSell'));
    return;
  }

  const options = bulkCargo.map((c, idx) => {
    const isSameWorld = c.purchaseWorld === s.currentWorldName;
    const label = isSameWorld
      ? `${c.name} (${c.tons}t) — Cr${c.purchasePricePerTon.toLocaleString()}/t (Refund/Cancel)`
      : `${c.name} (${c.tons}t) — Cr${c.purchasePricePerTon.toLocaleString()}/t (100% value)`;
    return {
      value: String(idx),
      label,
      isSameWorld,
    };
  });
  options.push({ value: 'none', label: game.i18n.localize('TWODSIX.Trader.Actions.NoSell') });

  const chosenIdx = await app._choose(game.i18n.localize('TWODSIX.Trader.Prompts.SellBulkLS'), options);
  if (chosenIdx === 'none') {
    return;
  }

  const chosenBulkIdx = Number.parseInt(chosenIdx, 10);
  const originalCargoIdx = s.cargo.indexOf(bulkCargo[chosenBulkIdx]);
  const cargo = s.cargo[originalCargoIdx];

  const qtyOptions = [];
  // Add option to sell the entire stack, including fractional tonnage
  qtyOptions.push({
    value: String(cargo.tons),
    label: `${cargo.tons} tons (All) — Cr${(cargo.tons * cargo.purchasePricePerTon).toLocaleString()}`,
  });

  // Add integer options if applicable
  for (let i = 1; i < cargo.tons; i++) {
    qtyOptions.push({ value: String(i), label: `${i} ton${i > 1 ? 's' : ''} — Cr${(i * cargo.purchasePricePerTon).toLocaleString()}` });
  }

  const qty = parseFloat(await app._choose(
    game.i18n.format('TWODSIX.Trader.Prompts.BuyQuantity', { good: game.i18n.localize(cargo.name) }),
    qtyOptions,
    String(cargo.tons)
  ));

  if (qty > 0) {
    const revenue = qty * cargo.purchasePricePerTon;
    addRevenue(s, revenue);

    if (qty === cargo.tons) {
      s.cargo.splice(originalCargoIdx, 1);
    } else {
      cargo.tons -= qty;
    }

    const isSameWorld = cargo.purchaseWorld === s.currentWorldName;
    const logMsg = isSameWorld
      ? `Cancelled purchase of ${qty}t ${game.i18n.localize(cargo.name)} at Cr${cargo.purchasePricePerTon.toLocaleString()}/t (Full refund).`
      : `Sold ${qty}t ${game.i18n.localize(cargo.name)} at Cr${cargo.purchasePricePerTon.toLocaleString()}/t. Revenue: Cr${revenue.toLocaleString()}.`;

    await app.logEvent(`${logMsg} Credits: Cr${s.credits.toLocaleString()}.`);
  }
}

// ─── Find Supplier/Buyer ──────────────────────────────────────

export async function findBuyer(app, world) {
  await searchForTrade(app, world, 'buyer');
}

export async function findSupplier(app, world) {
  await searchForTrade(app, world, 'supplier');
}

/** Unified search logic for suppliers and buyers. */
async function searchForTrade(app, world, type) {
  const s = app.state;
  const ruleset = getTraderRuleset(s.ruleset);
  const cache = getWorldCache(s);
  const starport = world?.system?.starport || 'X';
  const worldTL = parseInt(world?.system?.uwp?.substring(8, 9), 16) || 0;

  // Options for search method
  const methods = ruleset.getSearchMethods(worldTL, starport);
  const options = methods.map(m => ({
    value: m,
    label: `${m.charAt(0).toUpperCase() + m.slice(1)} (${game.i18n.localize(ruleset.getSearchSkillLabel(m))}, 1D6 days)`
  }));

  const method = await app._choose(
    game.i18n.format('TWODSIX.Trader.Prompts.FindTradeMethod', {
      type: game.i18n.localize(`TWODSIX.Trader.Search.${type.charAt(0).toUpperCase() + type.slice(1)}`)
    }),
    options
  );
  if (!method) {
    return;
  }

  // Handle month reset for search penalty
  const currentMonth = getMonthNumber(s.gameDate, s.milieu);
  if (cache.lastSearchMonth !== currentMonth) {
    cache.searchAttempts = 0;
    cache.lastSearchMonth = currentMonth;
  }

  const penalty = -cache.searchAttempts;
  cache.searchAttempts++;

  let skill = 0;
  let timeHours = 0;
  let bonus = 0;
  let skillName = game.i18n.localize(ruleset.getSearchSkillLabel(method));

  if (method === SEARCH_METHOD.ONLINE) {
    skill = ruleset.getSearchSkillLevel(s.crew, method);
    bonus = 0;
    timeHours = await app._roll('1D6');
  } else {
    skill = ruleset.getSearchSkillLevel(s.crew, method);
    if (method === SEARCH_METHOD.STANDARD) {
      // For standard search, we might be using a hired broker
      skill = getEffectiveBrokerSkillForWorld(s, starport);
    }
    bonus = ruleset.getSearchStarportBonus(starport);
    timeHours = (await app._roll('1D6')) * HOURS_PER_DAY;
  }

  advanceDate(s.gameDate, timeHours);
  const localizedType = game.i18n.localize(`TWODSIX.Trader.Search.${type.charAt(0).toUpperCase() + type.slice(1)}`);
  const localizedMethod = game.i18n.localize(`TWODSIX.Trader.Search.Method.${method}`);
  const timeStr = timeHours >= HOURS_PER_DAY
    ? game.i18n.format("TWODSIX.Trader.Time.Days", { days: Math.floor(timeHours / HOURS_PER_DAY) })
    : game.i18n.format("TWODSIX.Trader.Time.Hours", { hours: timeHours });
  await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.Searching", {
    type: localizedType,
    method: localizedMethod,
    timeStr
  }));

  const checkRoll = await app._roll(`2D6+${skill}+${bonus}${penalty !== 0 ? penalty : ''}`);
  const success = checkRoll >= ruleset.getSearchThreshold();

  if (success) {
    if (type === 'supplier') {
      cache.foundSupplier = true;
      if (method === SEARCH_METHOD.BLACK_MARKET) {
        cache.foundBlackMarketSupplier = true;
      }
      if (method === SEARCH_METHOD.ONLINE) {
        cache.foundOnlineSupplier = true;
      }
      if (method === SEARCH_METHOD.PRIVATE) {
        cache.foundPrivateSupplier = true;
      }
    } else {
      cache.foundBuyer = true;
      if (method === SEARCH_METHOD.PRIVATE) {
        cache.foundPrivateBuyer = true;
      }
    }

    const details = [];
    details.push(game.i18n.format("TWODSIX.Trader.Search.DetailSkill", { skillName, skill }));
    if (bonus !== 0) {
      details.push(game.i18n.format("TWODSIX.Trader.Search.DetailStarport", {
        starport,
        bonus: (bonus > 0 ? '+' : '') + bonus
      }));
    }
    if (penalty < 0) {
      details.push(game.i18n.format("TWODSIX.Trader.Search.DetailPenalty", { penalty }));
    }

    const key = type === 'supplier' ? "TWODSIX.Trader.Search.SuppliersFound" : "TWODSIX.Trader.Search.BuyersFound";
    await app.logEvent(game.i18n.format(key, { details: details.join(', ') }));

    cache.tradeInfo = null;
  } else {
    const localizedType = game.i18n.localize(`TWODSIX.Trader.Search.${type.charAt(0).toUpperCase() + type.slice(1)}`);
    const localizedMethod = game.i18n.localize(`TWODSIX.Trader.Search.Method.${method}`);
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.SearchFailed", {
      type: localizedType,
      method: localizedMethod
    }));
  }
}

export async function hireBroker(app, world) {
  const s = app.state;
  const ruleset = getTraderRuleset(s.ruleset);
  const starport = world?.system?.starport || 'X';
  const maxSkill = ruleset.getBrokerMaxSkill(starport);

  if (maxSkill <= 0) {
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.NoBrokersAvailable", { starport }));
    return;
  }

  const options = [];
  for (let i = 1; i <= maxSkill; i++) {
    const commission = ruleset.getBrokerCommission(i);
    options.push({
      value: String(i),
      label: game.i18n.format('TWODSIX.Trader.Actions.HireBrokerSkill', { skill: i, commission })
    });
  }
  options.push({ value: '0', label: game.i18n.localize('TWODSIX.Trader.Actions.HireBrokerNone') });

  const prompt = game.i18n.format("TWODSIX.Trader.Prompts.HireBroker", { starport, maxSkill });
  const chosen = await chooseIntOption(app, prompt, options);

  if (chosen > 0) {
    s.useLocalBroker = true;
    s.localBrokerSkill = chosen;
    const commission = ruleset.getBrokerCommission(chosen);
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.HiredBroker", { skill: chosen, commission }));
    const cache = getWorldCache(s);
    cache.tradeInfo = null;
  } else {
    s.useLocalBroker = false;
    s.localBrokerSkill = 0;
    await app.logEvent(game.i18n.localize("TWODSIX.Trader.Log.HandlePersonally"));
    const cache = getWorldCache(s);
    cache.tradeInfo = null;
  }
}

// ─── Refuel ──────────────────────────────────────────────────

/**
 * Apply a fuel purchase to the ship state.
 * @param {object} s - Trader state
 * @param {number} tons - Tons of fuel to add
 * @param {number} costPerTon - Cost per ton
 * @param {boolean} isRefined - Whether the fuel is refined
 */
export function applyFuelPurchase(s, tons, costPerTon, isRefined) {
  const cost = tons * costPerTon;
  addExpense(s, cost);
  s.ship.currentFuel += tons;
  s.ship.fuelIsRefined = isRefined;
  return cost;
}

/**
 * Calculate how many tons of fuel can be afforded at the given cost.
 * @param {number} credits - Available credits
 * @param {number} costPerTon - Cost per ton
 * @returns {number} Affordable tons (floored)
 */
export function affordableFuel(credits, costPerTon) {
  return Math.max(0, Math.floor(credits / costPerTon));
}

export async function refuel(app, world) {
  const s = app.state;
  const fuelNeeded = s.ship.fuelCapacity - s.ship.currentFuel;

  if (fuelNeeded <= 0) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.FuelFull'));
    return;
  }

  const { starport, hasGasGiant } = getRefuelOptions(world);
  const options = [];

  // Starport refined fuel (Class A or B)
  if (['A', 'B'].includes(starport)) {
    const fullCost = fuelNeeded * FUEL_COST.refined;
    if (s.credits >= fullCost) {
      options.push({
        value: 'refined',
        label: game.i18n.format('TWODSIX.Trader.Prompts.RefuelRefinedOption', {
          needed: fuelNeeded,
          cost: fullCost.toLocaleString(),
        }),
      });
    } else {
      const affordable = affordableFuel(s.credits, FUEL_COST.refined);
      if (affordable > 0) {
        options.push({
          value: 'refined_partial',
          label: game.i18n.format('TWODSIX.Trader.Prompts.RefuelRefinedPartialOption', {
            affordable,
            needed: fuelNeeded,
            cost: (affordable * FUEL_COST.refined).toLocaleString(),
          }),
        });
      }
    }
  }

  if (['A', 'B', 'C', 'D'].includes(starport)) {
    const fullCost = fuelNeeded * FUEL_COST.unrefined;
    if (s.credits >= fullCost) {
      options.push({
        value: 'unrefined',
        label: game.i18n.format('TWODSIX.Trader.Prompts.RefuelUnrefinedOption', {
          needed: fuelNeeded,
          cost: fullCost.toLocaleString(),
        }),
      });
    } else {
      const affordable = affordableFuel(s.credits, FUEL_COST.unrefined);
      if (affordable > 0) {
        options.push({
          value: 'unrefined_partial',
          label: game.i18n.format('TWODSIX.Trader.Prompts.RefuelUnrefinedPartialOption', {
            affordable,
            needed: fuelNeeded,
            cost: (affordable * FUEL_COST.unrefined).toLocaleString(),
          }),
        });
      }
    }
  }

  // Gas giant (free, unrefined)
  if (hasGasGiant) {
    options.push({
      value: 'gasgiant',
      label: game.i18n.format('TWODSIX.Trader.Prompts.RefuelGasGiantOption', { needed: fuelNeeded }),
    });
  }

  // CHEAT option
  if (!canRefuelAtWorld(world)) {
    const cheatCost = fuelNeeded * FUEL_COST.refined * FUEL_CHEAT_MULTIPLIER;
    if (s.credits >= cheatCost) {
      options.push({
        value: 'cheat',
        label: game.i18n.format('TWODSIX.Trader.Cheat.BuyFuel', { tons: fuelNeeded, cost: cheatCost.toLocaleString(), multiplier: FUEL_CHEAT_MULTIPLIER }),
      });
    }
    options.push({
      value: 'cheat_free',
      label: game.i18n.format('TWODSIX.Trader.Cheat.ScroungeFuel', { tons: fuelNeeded, days: CHEAT_FREE_FUEL_DAYS }),
    });
  }

  options.push({ value: 'none', label: game.i18n.localize('TWODSIX.Trader.Actions.NoRefuel') });

  const choice = await app._choose(
    game.i18n.format('TWODSIX.Trader.Prompts.Refuel', { needed: fuelNeeded }),
    options
  );

  if (choice === 'refined') {
    const cost = applyFuelPurchase(s, fuelNeeded, FUEL_COST.refined, true);
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.PurchasedFuel", {
      tons: fuelNeeded,
      quality: game.i18n.localize('TWODSIX.Trader.OtherActivities.Refined'),
      cost: cost.toLocaleString(),
      credits: s.credits.toLocaleString()
    }));
  } else if (choice === 'refined_partial') {
    const tons = affordableFuel(s.credits, FUEL_COST.refined);
    const cost = applyFuelPurchase(s, tons, FUEL_COST.refined, true);
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.PurchasedFuelPartial", {
      tons,
      quality: game.i18n.localize('TWODSIX.Trader.OtherActivities.Refined'),
      cost: cost.toLocaleString(),
      credits: s.credits.toLocaleString(),
      current: s.ship.currentFuel,
      capacity: s.ship.fuelCapacity
    }));
  } else if (choice === 'unrefined') {
    const cost = applyFuelPurchase(s, fuelNeeded, FUEL_COST.unrefined, false);
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.PurchasedFuel", {
      tons: fuelNeeded,
      quality: game.i18n.localize('TWODSIX.Trader.OtherActivities.Unrefined'),
      cost: cost.toLocaleString(),
      credits: s.credits.toLocaleString()
    }));
  } else if (choice === 'unrefined_partial') {
    const tons = affordableFuel(s.credits, FUEL_COST.unrefined);
    const cost = applyFuelPurchase(s, tons, FUEL_COST.unrefined, false);
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.PurchasedFuelPartial", {
      tons,
      quality: game.i18n.localize('TWODSIX.Trader.OtherActivities.Unrefined'),
      cost: cost.toLocaleString(),
      credits: s.credits.toLocaleString(),
      current: s.ship.currentFuel,
      capacity: s.ship.fuelCapacity
    }));
  } else if (choice === 'gasgiant') {
    const skimTime = Math.ceil(fuelNeeded / FUEL_SKIM_RATE) * (await app._roll('1d6'));
    s.ship.currentFuel = s.ship.fuelCapacity;
    s.ship.fuelIsRefined = false;
    advanceDate(s.gameDate, skimTime);
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.SkimmedFuel", {
      tons: fuelNeeded,
      time: skimTime
    }));
  } else if (choice === 'cheat') {
    const cost = applyFuelPurchase(s, fuelNeeded, FUEL_COST.refined * FUEL_CHEAT_MULTIPLIER, false);
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.CheatRefueled", {
      tons: fuelNeeded,
      world: world?.name || game.i18n.localize('TWODSIX.Trader.App.Unknown'),
      cost: cost.toLocaleString(),
      credits: s.credits.toLocaleString()
    }));
  } else if (choice === 'cheat_free') {
    s.ship.currentFuel = s.ship.fuelCapacity;
    s.ship.fuelIsRefined = false;
    advanceDate(s.gameDate, CHEAT_FREE_FUEL_DAYS * HOURS_PER_DAY);
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.CheatScrounged", {
      tons: fuelNeeded,
      world: world?.name || game.i18n.localize('TWODSIX.Trader.App.Unknown'),
      days: CHEAT_FREE_FUEL_DAYS
    }));
  }
  await accruePortFees(app);
}

export async function takePrivateMessages(app) {
  const s = app.state;
  const cache = getWorldCache(s);

  if (cache.privateMessageAccepted) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.PrivateMessagesAlreadyAccepted'));
    return;
  }

  cache.privateMessagesTaken = true;

  const roll = await app._roll('2D6');
  const honorarium = roll * 10;
  let crewName = game.i18n.localize('TWODSIX.Trader.Messages.GenericCrewMember');
  if (s.crew.length > 0) {
    const crewIndex = (await app._roll(`1d${s.crew.length}`)) - 1;
    const crewMember = s.crew[crewIndex];
    crewName = crewMember?.name || crewName;
  }

  addRevenue(s, honorarium);
  cache.privateMessageAccepted = true;
  cache.privateMessageCredits = honorarium;

  await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.PrivateMessagesAccepted", {
    name: crewName,
    honorarium: honorarium.toLocaleString(),
    credits: s.credits.toLocaleString()
  }));
}

export async function accruePortFees(app) {
  const s = app.state;
  const cache = getWorldCache(s);
  const currentDay = getAbsoluteDay(s.gameDate, s.milieu);
  const daysSpent = currentDay - cache.arrivalDay + 1;

  if (daysSpent > cache.portFeesPaidDays) {
    const extraDays = daysSpent - cache.portFeesPaidDays;
    const cost = extraDays * PORT_FEE_BASE;
    addExpense(s, cost);
    cache.portFeesPaidDays = daysSpent;
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.AdditionalPortFees", {
      days: extraDays,
      cost: cost.toLocaleString(),
      credits: s.credits.toLocaleString()
    }));
  }
}

// ─── Destination Helpers ─────────────────────────────────────

export async function chooseDestination(app) {
  const s = app.state;
  const cache = getWorldCache(s);
  const { reachable, options } = await getReachableDestinations(app);

  if (!reachable.length) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.NoWorldsInRange'));
    return;
  }

  if (s.destinationHex) {
    options.unshift({ value: 'clear', label: game.i18n.localize('TWODSIX.Trader.Actions.ClearDestination') });
  }

  const chosen = await app._choose(game.i18n.localize('TWODSIX.Trader.Prompts.ChooseDestination'), options, null);

  if (chosen === 'clear') {
    if (cache.privateMessageAccepted && cache.privateMessageCredits > 0) {
      const confirm = await app._choose(
        game.i18n.format('TWODSIX.Trader.Log.ChangeDestForfeit', { credits: cache.privateMessageCredits.toLocaleString() }),
        [
          { value: 'confirm', label: game.i18n.localize('TWODSIX.Trader.Actions.ClearDestinationConfirm') },
          { value: 'cancel', label: game.i18n.localize('Cancel') },
        ]
      );
      if (confirm === 'cancel') {
        return;
      }
      const forfeitedCredits = cache.privateMessageCredits;
      subtractRevenue(s, forfeitedCredits);
      cache.privateMessageAccepted = false;
      cache.privateMessageCredits = 0;
      await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.DestinationClearedForfeited", { credits: forfeitedCredits.toLocaleString() }));
    }
    s.destinationHex = '';
    s.destinationName = '';
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.DestinationCleared'));
    return;
  }

  const dest = reachable.find(w => getWorldCoordinate(w) === chosen);
  if (!dest) {
    return;
  }

  if (cache.privateMessageAccepted && cache.privateMessageCredits > 0 && s.destinationHex !== chosen) {
    const confirm = await app._choose(
      game.i18n.format('TWODSIX.Trader.Log.ChangeDestForfeit', { credits: cache.privateMessageCredits.toLocaleString() }),
      [
        { value: 'confirm', label: game.i18n.localize('TWODSIX.Trader.Actions.ChangeDestinationConfirm') },
        { value: 'cancel', label: game.i18n.localize('Cancel') },
      ]
    );
    if (confirm === 'cancel') {
      return;
    }
    const forfeitedCredits = cache.privateMessageCredits;
    subtractRevenue(s, forfeitedCredits);
    cache.privateMessageAccepted = false;
    cache.privateMessageCredits = 0;
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.PrivateMessageForfeited", { credits: forfeitedCredits.toLocaleString() }));
  }

  s.destinationHex = chosen;
  s.destinationGlobalHex = dest.globalHex || dest.hex || '';
  s.destinationName = dest.name;
  await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.DestinationSelected", { world: dest.name }));
}

export async function getReachableDestinations(app) {
  const s = app.state;
  const reachable = await getReachableWorlds(s);
  const { options } = buildDestinationOptions(s, reachable);

  if (reachable.length === 0 && isLocalMode(s) && s.rootFolderId) {
    const rootFolder = game.folders.get(s.rootFolderId);
    if (rootFolder) {
      const worlds = collectWorldsFromFolder(rootFolder);
      if (worlds.length !== s.worlds.length) {
        s.worlds = worlds;
        const result = buildDestinationOptions(s);
        const reachable2 = result.reachable;
        const options2 = result.options;
        if (reachable2.length > 0) {
          await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.NoWorldsInRangeLocal', { count: reachable2.length }));
        }
        await app._saveState();
        return { reachable: reachable2, options: options2 };
      }
    }
  }

  return { reachable, options };
}

export function buildDestinationOptions(state, reachableWorlds = null) {
  const currentHex = state.currentWorldHex;
  const reachable = reachableWorlds ?? worldsInJumpRange(currentHex, state.ship.jumpRating, state.worlds);

  // Deduplicate reachable worlds by name and coordinate for cleaner UI
  const uniqueReachable = deduplicateWorlds(reachable);

  const options = uniqueReachable.map(w => {
    const targetHex = getWorldCoordinate(w);
    const displayHex = w.system?.coordinates || targetHex;
    const dist = hexDistance(currentHex, targetHex);
    const refuelNote = canRefuelAtWorld(w) ? "" : " ⚠️";
    return {
      value: targetHex,
      label: `${w.name} (${displayHex}) — ${w.system?.uwp} [${w.system?.tradeCodes}] — ${dist} parsec(s)${refuelNote}`,
    };
  });
  return { reachable: uniqueReachable, options };
}

// ─── Other Activities ─────────────────────────────────────────

/**
 * Present a looping "Other activities | Continue" choice so the player can log
 * any number of other-activity records before the phase resumes automatically.
 * Used by the IN_TRANSIT and ARRIVING phases in TraderTransit.js.
 * @param {import('./TraderApp.js').TraderApp} app
 * @param {string} continueLabel - Label for the "proceed" option
 */
export async function runOtherActivitiesLoop(app, continueLabel) {
  while (true) {
    const choice = await app._choose(
      game.i18n.localize('TWODSIX.Trader.Prompts.OtherActivitiesOrContinue'),
      [
        { value: 'other', label: game.i18n.localize('TWODSIX.Trader.Actions.OtherActivities') },
        { value: 'continue', label: continueLabel },
      ]
    );
    if (choice !== 'other') {
      break;
    }
    await otherActivities(app);
  }
}

function removeBulkLifeSupport(s, name, tons) {
  let remaining = tons;
  const cargoId = name === game.i18n.localize('TWODSIX.Trader.BulkLSNormal')
    ? BULK_LS_CARGO_ID.NORMAL
    : BULK_LS_CARGO_ID.LUXURY;
  for (let i = s.cargo.length - 1; i >= 0 && remaining > 0; i--) {
    if (s.cargo[i].name === name || s.cargo[i].cargoId === cargoId) {
      const take = Math.min(s.cargo[i].tons, remaining);
      s.cargo[i].tons -= take;
      remaining -= take;
      if (s.cargo[i].tons <= 0) {
        s.cargo.splice(i, 1);
      }
    }
  }
}

export async function otherActivities(app) {
  const { OtherActivitiesApp, buildShipFromActor } = await import('./OtherActivitiesApp.js');
  const dlg = new OtherActivitiesApp({ state: app.state });
  dlg.render(true);
  const result = await dlg.awaitResult();
  if (!result) {
    return;
  }

  const s = app.state;

  if (result.newShipActorId) {
    const shipActor = game.actors.get(result.newShipActorId);
    if (shipActor) {
      const rebuilt = buildShipFromActor(shipActor, s.ship);
      s.ship = {
        ...rebuilt,
        currentFuel: Math.min(s.ship.currentFuel ?? 0, rebuilt.fuelCapacity ?? 0),
        fuelIsRefined: s.ship.fuelIsRefined,
      };
      updateMortgageFromShip(s);
    }
  }

  s.crew = result.newCrew;
  s.cargo = result.newCargo;

  if (result.creditsDelta !== 0) {
    if (result.creditsDelta > 0) {
      addRevenue(s, result.creditsDelta);
    } else {
      addExpense(s, -result.creditsDelta);
    }
  }

  s.freight = Math.max(0, (s.freight || 0) + result.freightDelta);

  if (result.bulkNormalDelta > 0) {
    s.cargo.push({
      cargoId: BULK_LS_CARGO_ID.NORMAL,
      name: game.i18n.localize('TWODSIX.Trader.BulkLSNormal'),
      tons: result.bulkNormalDelta,
      purchasePricePerTon: 0,
      purchaseWorld: s.currentWorldName
    });
  } else if (result.bulkNormalDelta < 0) {
    removeBulkLifeSupport(s, game.i18n.localize('TWODSIX.Trader.BulkLSNormal'), -result.bulkNormalDelta);
  }
  if (result.bulkLuxuryDelta > 0) {
    s.cargo.push({
      cargoId: BULK_LS_CARGO_ID.LUXURY,
      name: game.i18n.localize('TWODSIX.Trader.BulkLSLuxury'),
      tons: result.bulkLuxuryDelta,
      purchasePricePerTon: 0,
      purchaseWorld: s.currentWorldName
    });
  } else if (result.bulkLuxuryDelta < 0) {
    removeBulkLifeSupport(s, game.i18n.localize('TWODSIX.Trader.BulkLSLuxury'), -result.bulkLuxuryDelta);
  }

  s.passengers.high = Math.max(0, s.passengers.high + result.paxDelta.high);
  s.passengers.middle = Math.max(0, s.passengers.middle + result.paxDelta.middle);
  s.passengers.low = Math.max(0, s.passengers.low + result.paxDelta.low);

  if (result.fuelDelta) {
    const refined = result.fuelDelta.refined || 0;
    const unrefined = result.fuelDelta.unrefined || 0;
    if (refined !== 0 || unrefined !== 0) {
      const currentFuel = s.ship.currentFuel || 0;
      const fuelIsRefined = s.ship.fuelIsRefined ?? true;
      const newAmount = Math.max(0, currentFuel + refined + unrefined);

      // Have to do something, this is something:
      // unrefined fuel makes the whole tank unrefined.
      // adding refined to empty makes it refined.
      // adding refined to unrefined stays unrefined.
      let newRefined = fuelIsRefined;
      if (unrefined > 0) {
        newRefined = false;
      } else if (currentFuel === 0 && refined > 0) {
        newRefined = true;
      } else if (newAmount === 0) {
        newRefined = true;
      }

      s.ship.currentFuel = newAmount;
      s.ship.fuelIsRefined = newRefined;
    }
  }

  if (result.days > 0) {
    advanceDate(s.gameDate, result.days * HOURS_PER_DAY);
  }

  await app.logEvent(result.summary);
}
