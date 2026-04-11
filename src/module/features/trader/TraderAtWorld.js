/**
 * TraderAtWorld.js
 * Logic for actions available while docked at a world.
 */

import { LOCAL_BROKER_COMMISSION, STARPORT_BROKER_MAX } from '../../utils/trade/TradeGeneratorConstants.js';
import { buildTradeReportRows, generateTradeInformation } from '../../utils/TradeGenerator.js';
import { createWorldActors } from './SubsectorLoader.js';
import {
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
  PORT_FEE_BASE,
  STARPORT_SUPPLIER_BONUS
} from './TraderConstants.js';
import {
  advanceDate,
  getAbsoluteDay,
  getCrewBrokerSkill,
  getCrewComputersSkill,
  getCrewStreetwiseSkill,
  getFreeCargoSpace,
  getFreeLowBerths,
  getFreeStaterooms,
  getMonthNumber,
  getWorldCache,
  PHASE,
} from './TraderState.js';
import { canRefuelAtWorld, getRefuelOptions, getWorldCoordinate, hexDistance, traderDebug } from './TraderUtils.js';
import { CACHE_KEY_WORLDS, getCachedData, getOrCreateCacheJournal } from './TravellerMapCache.js';

/**
 * Get the best available broker skill (crew vs hired)
 * @param {import('./TraderState.js').TraderState} s - TraderState
 * @param {string} starport - Current starport class
 * @returns {number}
 */
function getEffectiveBrokerSkillForWorld(s, starport) {
  const crewSkill = getCrewBrokerSkill(s.crew);
  if (!s.useLocalBroker) {
    return crewSkill;
  }
  const maxSkill = STARPORT_BROKER_MAX[starport] || 0;
  const hiredSkill = Math.min(s.localBrokerSkill, maxSkill);
  return Math.max(crewSkill, hiredSkill);
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
      await app.logEvent('Charter period has ended. Ship space is now available.');
    }

    const cache = getWorldCache(s);

    // Build available actions
    const actions = [];

    // Choose destination (always available, at top)
    if (s.destinationHex) {
      actions.push({ value: ACTION.CHOOSE_DESTINATION, label: game.i18n.format('TWODSIX.Trader.Actions.ChooseDestinationCurrent', { destination: s.destinationName }) });
    } else {
      actions.push({ value: ACTION.CHOOSE_DESTINATION, label: game.i18n.localize('TWODSIX.Trader.Actions.ChooseDestination') });
    }

    // Local Broker
    actions.push({ value: ACTION.HIRE_BROKER, label: game.i18n.localize('TWODSIX.Trader.Actions.HireBroker') });

    // Find Supplier/Buyer
    if (!cache.foundSupplier) {
      actions.push({ value: ACTION.FIND_SUPPLIER, label: game.i18n.localize('TWODSIX.Trader.Actions.FindSupplier') });
    }

    if (s.cargo.length > 0 && !cache.foundBuyer) {
      actions.push({ value: ACTION.FIND_BUYER, label: game.i18n.localize('TWODSIX.Trader.Actions.FindBuyer') });
    }

    // Passengers: hide if market was checked and is empty, or if ship has no berth/stateroom capacity
    const paxMarketEmpty = cache.passengers !== null
      && cache.passengers.high === 0 && cache.passengers.middle === 0 && cache.passengers.low === 0;
    const paxShipFull = getFreeStaterooms(s) <= 0 && getFreeLowBerths(s) <= 0;
    if (cache.foundSupplier && !paxMarketEmpty && !paxShipFull) {
      actions.push({ value: ACTION.PASSENGERS, label: game.i18n.localize('TWODSIX.Trader.Actions.SeekPassengers') });
    }

    // Freight: hide if market was checked and is empty, or if there is no free cargo space
    const freightMarketEmpty = cache.freight !== null && cache.freight === 0;
    if (cache.foundSupplier && !freightMarketEmpty && getFreeCargoSpace(s) > 0) {
      actions.push({ value: ACTION.FREIGHT, label: game.i18n.localize('TWODSIX.Trader.Actions.SeekFreight') });
    }

    if (cache.foundSupplier && s.ship.armed && getFreeCargoSpace(s) >= 5) {
      actions.push({ value: ACTION.MAIL, label: game.i18n.localize('TWODSIX.Trader.Actions.SeekMail') });
    }

    // Buy goods: hide if no cargo space, no credits, or market previously found empty
    if (cache.foundSupplier && getFreeCargoSpace(s) > 0 && s.credits > 0 && !cache.noGoodsAvailable) {
      actions.push({ value: ACTION.BUY, label: game.i18n.localize('TWODSIX.Trader.Actions.BuyGoods') });
    }

    if (cache.foundBuyer && s.cargo.length > 0) {
      actions.push({ value: ACTION.SELL, label: game.i18n.localize('TWODSIX.Trader.Actions.SellGoods') });
    }

    // Buy/Sell bulk life support: always available at worlds if credits/space/cargo permit
    const hasBulkInCargo = s.cargo.some(c => c.name === game.i18n.localize('TWODSIX.Trader.BulkLSNormal') || c.name === game.i18n.localize('TWODSIX.Trader.BulkLSLuxury'));
    if (getFreeCargoSpace(s) > 0 && s.credits >= Math.min(BULK_LS_NORMAL_COST, BULK_LS_LUXURY_COST)) {
      actions.push({ value: ACTION.BUY_BULK_LS, label: game.i18n.localize('TWODSIX.Trader.Actions.BuyBulkLifeSupport') });
    }
    if (hasBulkInCargo) {
      actions.push({ value: ACTION.SELL_BULK_LS, label: game.i18n.localize('TWODSIX.Trader.Actions.SellBulkLifeSupport') });
    }

    // Refuel: hide if tanks are already full
    if (s.ship.currentFuel < s.ship.fuelCapacity) {
      const refuelNote = canRefuelAtWorld(world) ? "" : " ⚠️";
      actions.push({ value: ACTION.REFUEL, label: game.i18n.localize('TWODSIX.Trader.Actions.Refuel') + refuelNote });
    }

    // Private messages: once per world visit, requires destination
    if (s.destinationHex && !cache.privateMessagesTaken) {
      actions.push({ value: ACTION.PRIVATE_MESSAGES, label: game.i18n.localize('TWODSIX.Trader.Actions.PrivateMessages') });
    }

    // Toggle illegal goods
    const illegalLabel = s.includeIllegalGoods ? 'TWODSIX.Trader.Actions.DisableIllegal' : 'TWODSIX.Trader.Actions.EnableIllegal';
    actions.push({ value: ACTION.TOGGLE_ILLEGAL, label: game.i18n.localize(illegalLabel) });

    // Accept charter: requires destination and not currently chartered
    if (s.destinationHex && !s.chartered) {
      // Lazy load computeCharterFee to avoid circular dependency
      const { computeCharterFee } = await import('./TraderCharter.js');
      const charterFee = computeCharterFee(s);
      actions.push({
        value: ACTION.CHARTER,
        label: game.i18n.format('TWODSIX.Trader.Actions.AcceptCharter', { destination: s.destinationName, fee: charterFee.toLocaleString() }),
      });
    }

    actions.push({ value: ACTION.OTHER_ACTIVITIES, label: game.i18n.localize('TWODSIX.Trader.Actions.OtherActivities') });

    actions.push({ value: ACTION.DEPART, label: game.i18n.localize('TWODSIX.Trader.Actions.Depart') });

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
        await app.logEvent(s.includeIllegalGoods ? 'Black market contacts activated. Illegal goods may now be available.' : 'Black market contacts deactivated.');
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
    await app.logEvent(
      `Passenger market: ${cache.passengers.high} high, ${cache.passengers.middle} middle, `
      + `${cache.passengers.low} low available at ${s.currentWorldName}.`
    );
  }

  const { high: highAvail, middle: midAvail, low: lowAvail } = cache.passengers;

  if (highAvail === 0 && midAvail === 0 && lowAvail === 0) {
    await app.logEvent('No passengers are available at this port.');
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
    const count = parseInt(await app._choose(game.i18n.localize(promptKey), options, maxBook));
    if (count > 0) {
      s.passengers[classKey] += count;
      cache.passengers[classKey] -= count;
      const rev = count * revenuePerHead;
      await app.logEvent(`Booked ${count} ${classKey} passenger(s). Revenue on delivery: Cr${rev.toLocaleString()}.`);
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
    await app.logEvent(`No freight available (${available} tons offered, ${freeSpace} tons free cargo space).`);
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

  const tons = parseInt(await app._choose(
    game.i18n.format('TWODSIX.Trader.Prompts.Freight', { available, freeSpace }),
    options,
    maxTons
  ));

  if (tons > 0) {
    s.freight += tons;
    cache.freight -= tons;
    await app.logEvent(`Loaded ${tons} tons of freight. Revenue on delivery: Cr${(tons * FREIGHT_RATE).toLocaleString()}.`);
  }
}

// ─── Seek Mail ────────────────────────────────────────────────

export async function seekMail(app) {
  const s = app.state;
  if (s.hasMail) {
    await app.logEvent('Already carrying mail for this trip.');
    return;
  }

  const cache = getWorldCache(s);
  if (cache.mailChecked) {
    await app.logEvent('Already checked for mail contracts this visit — no new contracts available.');
    return;
  }

  // Simple roll: 2D6 >= MAIL_CONTRACT_THRESHOLD to get mail contract; checked once per world visit
  const roll = await app._roll('2D6');
  cache.mailChecked = true;
  if (roll >= MAIL_CONTRACT_THRESHOLD) {
    s.hasMail = true;
    await app.logEvent(`Mail contract secured! Cr${MAIL_PAYMENT.toLocaleString()} on delivery. (5 tons reserved)`);
  } else {
    await app.logEvent('No mail contracts available at this time.');
  }
}

// ─── Buy Goods (Speculative Trade) ───────────────────────────

/** Return the cached trade info for the current world, generating it on first call. */
export function getTradeInfo(app, world) {
  const s = app.state;
  const cache = getWorldCache(s);
  if (!cache.tradeInfo) {
    const worldData = {
      name: world?.name || s.currentWorldName,
      tradeCodes: world?.system?.tradeCodes?.split(/\s+/) || [],
      starport: world?.system?.starport || 'X',
      zone: world?.system?.travelZone || 'Green',
      population: world?.system?.population || 0,
      traderSkill: getCrewBrokerSkill(s.crew),
      useLocalBroker: s.useLocalBroker,
      localBrokerSkill: s.localBrokerSkill,
      supplierModifier: 0,
      buyerModifier: 0,
      capSameWorld: false,
      includeIllegalGoods: cache.foundBlackMarketSupplier || s.includeIllegalGoods || false,
      isBlackMarket: cache.foundBlackMarketSupplier,
    };
    cache.tradeInfo = generateTradeInformation(worldData);
  }
  return cache.tradeInfo;
}

export async function buyGoods(app, world) {
  const s = app.state;
  const cache = getWorldCache(s);
  const freeSpace = getFreeCargoSpace(s);

  if (freeSpace <= 0) {
    await app.logEvent('No free cargo space for speculative goods.');
    return;
  }

  if (s.credits <= 0) {
    await app.logEvent('Insufficient credits to purchase goods.');
    return;
  }

  const tradeInfo = getTradeInfo(app, world);
  const rows = buildTradeReportRows(tradeInfo);

  // Filter to goods that have a buy price and that we can afford at least 1 ton
  const buyable = rows.filter(r => r.buyPricePerTon > 0 && r.quantity > 0 && r.buyPricePerTon <= s.credits);

  if (!buyable.length) {
    cache.noGoodsAvailable = true;
    await app.logEvent('No affordable goods available from suppliers.');
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

  const qty = parseInt(await app._choose(
    game.i18n.format('TWODSIX.Trader.Prompts.BuyQuantity', { good: game.i18n.localize(good.name) }),
    qtyOptions,
    maxTons
  ));

  if (qty > 0) {
    const cost = qty * good.buyPricePerTon;
    const commission = qty * (good.buyCommission || 0);
    const totalCost = cost + commission;
    if (s.credits < totalCost) {
      await app.logEvent(`Insufficient credits to cover purchase price and broker commission (Total needed: Cr${totalCost.toLocaleString()}).`);
      return;
    }
    s.credits -= totalCost;
    s.totalExpenses += totalCost;
    s.cargo.push({
      name: good.name,
      tons: qty,
      purchasePricePerTon: good.buyPricePerTon,
      purchaseWorld: s.currentWorldName,
      commissionPaid: commission,
    });
    let logMsg = `Bought ${qty}t ${game.i18n.localize(good.name)} at Cr${good.buyPricePerTon.toLocaleString()}/t.`;
    if (commission > 0) {
      logMsg += ` Paid Cr${commission.toLocaleString()} broker commission.`;
    }
    logMsg += ` Total: Cr${totalCost.toLocaleString()}. Credits: Cr${s.credits.toLocaleString()}.`;
    await app.logEvent(logMsg);
  }
}

// ─── Sell Goods ──────────────────────────────────────────────

export async function sellGoods(app, world) {
  const s = app.state;

  if (!s.cargo.length) {
    await app.logEvent('No cargo to sell.');
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

  const idx = parseInt(chosenIdx);
  const cargo = s.cargo[idx];
  if (!cargo || sellOptions.find(o => o.value === chosenIdx)?.salePrice === undefined) {
    if (cargo) {
      await app.logEvent(`No buyer found for ${game.i18n.localize(cargo.name)}.`);
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

  s.credits += netRevenue;
  s.totalRevenue += netRevenue;
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
    await app.logEvent('No free cargo space for bulk supplies.');
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

  const qty = parseInt(await app._choose(
    game.i18n.format('TWODSIX.Trader.Prompts.BuyQuantity', { good: game.i18n.localize(itemName) }),
    qtyOptions,
    maxTons
  ));

  if (qty > 0) {
    const totalCost = qty * costPerTon;
    s.credits -= totalCost;
    s.totalExpenses += totalCost;

    const localizedName = game.i18n.localize(itemName);
    const existing = s.cargo.find(c => c.name === localizedName);
    if (existing) {
      existing.tons += qty;
    } else {
      s.cargo.push({
        name: localizedName,
        tons: qty,
        purchasePricePerTon: costPerTon,
        purchaseWorld: s.currentWorldName,
      });
    }
    await app.logEvent(`Bought ${qty}t ${game.i18n.localize(itemName)} at Cr${costPerTon.toLocaleString()}/t. Total: Cr${totalCost.toLocaleString()}. Credits: Cr${s.credits.toLocaleString()}.`);
  }
}

export async function sellBulkLifeSupport(app) {
  const s = app.state;
  const bulkCargo = s.cargo.filter(c => c.name === game.i18n.localize('TWODSIX.Trader.BulkLSNormal') || c.name === game.i18n.localize('TWODSIX.Trader.BulkLSLuxury'));

  if (!bulkCargo.length) {
    await app.logEvent('No bulk life support supplies to sell.');
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

  const originalCargoIdx = s.cargo.indexOf(bulkCargo[parseInt(chosenIdx)]);
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
    s.credits += revenue;
    s.totalRevenue += revenue;

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
  const cache = getWorldCache(s);
  const starport = world?.system?.starport || 'X';
  const worldTL = parseInt(world?.system?.uwp?.substring(8, 9), 16) || 0;

  // Options for search method
  const options = [
    { value: 'standard', label: 'Standard (Broker skill, 1D6 days)' },
    { value: 'blackmarket', label: 'Black Market (Streetwise skill, 1D6 days)' },
  ];
  if (worldTL >= 8) {
    options.push({ value: 'online', label: 'Online (Computers skill, 1D6 hours, TL 8+)' });
  }

  const method = await app._choose(`Find ${type}: Choose search method`, options);
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
  let skillName = '';

  if (method === 'standard') {
    skill = getEffectiveBrokerSkillForWorld(s, starport);
    bonus = STARPORT_SUPPLIER_BONUS[starport] || 0;
    timeHours = (await app._roll('1D6')) * HOURS_PER_DAY;
    skillName = 'Broker';
  } else if (method === 'blackmarket') {
    skill = getCrewStreetwiseSkill(s.crew);
    bonus = STARPORT_SUPPLIER_BONUS[starport] || 0;
    timeHours = (await app._roll('1D6')) * HOURS_PER_DAY;
    skillName = 'Streetwise';
  } else if (method === 'online') {
    skill = getCrewComputersSkill(s.crew);
    bonus = 0;
    timeHours = await app._roll('1D6');
    skillName = 'Computers';
  }

  advanceDate(s.gameDate, timeHours);
  const timeStr = timeHours >= HOURS_PER_DAY ? `${Math.floor(timeHours / HOURS_PER_DAY)} day(s)` : `${timeHours} hour(s)`;
  await app.logEvent(`Searching for ${type}s via ${method} method... ${timeStr} pass.`);

  const checkRoll = await app._roll(`2D6+${skill}+${bonus}${penalty !== 0 ? penalty : ''}`);
  const success = checkRoll >= 8;

  if (success) {
    if (type === 'supplier') {
      cache.foundSupplier = true;
      if (method === 'blackmarket') {
        cache.foundBlackMarketSupplier = true;
      }
      if (method === 'online') {
        cache.foundOnlineSupplier = true;
      }
    } else {
      cache.foundBuyer = true;
    }

    let msg = `${type.charAt(0).toUpperCase() + type.slice(1)}s found! (${skillName} skill-${skill}`;
    if (bonus > 0) {
      msg += `, Starport ${starport} bonus +${bonus}`;
    }
    if (penalty < 0) {
      msg += `, Search penalty ${penalty}`;
    }
    msg += ')';
    await app.logEvent(msg);

    cache.tradeInfo = null;
  } else {
    await app.logEvent(`Failed to find any ${type}s using the ${method} method.`);
  }
}

export async function hireBroker(app, world) {
  const s = app.state;
  const starport = world?.system?.starport || 'X';
  const maxSkill = STARPORT_BROKER_MAX[starport] || 0;

  if (maxSkill <= 0) {
    await app.logEvent(`No local brokers available at this ${starport}-class starport.`);
    return;
  }

  const options = [];
  for (let i = 1; i <= maxSkill; i++) {
    const commission = LOCAL_BROKER_COMMISSION[i];
    options.push({ value: String(i), label: `Skill-${i} Broker (${commission}% commission)` });
  }
  options.push({ value: '0', label: 'Do not hire (use own skill)' });

  const chosen = parseInt(await app._choose(`Hire a local broker (Starport ${starport} max skill: ${maxSkill})`, options));

  if (chosen > 0) {
    s.useLocalBroker = true;
    s.localBrokerSkill = chosen;
    const commission = LOCAL_BROKER_COMMISSION[chosen];
    await app.logEvent(`Hired local Skill-${chosen} broker. They will take a ${commission}% commission on all trades.`);
    const cache = getWorldCache(s);
    cache.tradeInfo = null;
  } else {
    s.useLocalBroker = false;
    s.localBrokerSkill = 0;
    await app.logEvent('Decided to handle trades personally.');
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
  s.credits -= cost;
  s.totalExpenses += cost;
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
    await app.logEvent('Fuel tanks are already full.');
    return;
  }

  const { starport, hasGasGiant } = getRefuelOptions(world);
  const options = [];

  // Starport refined fuel (Class A or B)
  if (['A', 'B'].includes(starport)) {
    const fullCost = fuelNeeded * FUEL_COST.refined;
    if (s.credits >= fullCost) {
      options.push({ value: 'refined', label: `Refined fuel (${fuelNeeded}t) — Cr${fullCost.toLocaleString()}` });
    } else {
      const affordable = affordableFuel(s.credits, FUEL_COST.refined);
      if (affordable > 0) {
        options.push({
          value: 'refined_partial',
          label: `Refined fuel — WARNING: can only afford ${affordable}t of ${fuelNeeded}t needed (Cr${(affordable * FUEL_COST.refined).toLocaleString()})`,
        });
      }
    }
  }

  if (['A', 'B', 'C', 'D'].includes(starport)) {
    const fullCost = fuelNeeded * FUEL_COST.unrefined;
    if (s.credits >= fullCost) {
      options.push({ value: 'unrefined', label: `Unrefined fuel (${fuelNeeded}t) — Cr${fullCost.toLocaleString()}` });
    } else {
      const affordable = affordableFuel(s.credits, FUEL_COST.unrefined);
      if (affordable > 0) {
        options.push({
          value: 'unrefined_partial',
          label: `Unrefined fuel — WARNING: can only afford ${affordable}t of ${fuelNeeded}t needed (Cr${(affordable * FUEL_COST.unrefined).toLocaleString()})`,
        });
      }
    }
  }

  // Gas giant (free, unrefined)
  if (hasGasGiant) {
    options.push({ value: 'gasgiant', label: `Skim gas giant (${fuelNeeded}t) — Free (unrefined)` });
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

  if (choice === 'none') {
    return;
  }

  if (choice === 'refined') {
    const cost = applyFuelPurchase(s, fuelNeeded, FUEL_COST.refined, true);
    await app.logEvent(`Purchased ${fuelNeeded}t refined fuel. Cost: Cr${cost.toLocaleString()}. Credits: Cr${s.credits.toLocaleString()}.`);
  } else if (choice === 'refined_partial') {
    const tons = affordableFuel(s.credits, FUEL_COST.refined);
    const cost = applyFuelPurchase(s, tons, FUEL_COST.refined, true);
    await app.logEvent(`Purchased ${tons}t refined fuel (partial load). Cost: Cr${cost.toLocaleString()}. Credits: Cr${s.credits.toLocaleString()}. Fuel: ${s.ship.currentFuel}/${s.ship.fuelCapacity}t.`);
  } else if (choice === 'unrefined') {
    const cost = applyFuelPurchase(s, fuelNeeded, FUEL_COST.unrefined, false);
    await app.logEvent(`Purchased ${fuelNeeded}t unrefined fuel. Cost: Cr${cost.toLocaleString()}. Credits: Cr${s.credits.toLocaleString()}.`);
  } else if (choice === 'unrefined_partial') {
    const tons = affordableFuel(s.credits, FUEL_COST.unrefined);
    const cost = applyFuelPurchase(s, tons, FUEL_COST.unrefined, false);
    await app.logEvent(`Purchased ${tons}t unrefined fuel (partial load). Cost: Cr${cost.toLocaleString()}. Credits: Cr${s.credits.toLocaleString()}. Fuel: ${s.ship.currentFuel}/${s.ship.fuelCapacity}t.`);
  } else if (choice === 'gasgiant') {
    const skimTime = Math.ceil(fuelNeeded / FUEL_SKIM_RATE) * (await app._roll('1d6'));
    s.ship.currentFuel = s.ship.fuelCapacity;
    s.ship.fuelIsRefined = false;
    advanceDate(s.gameDate, skimTime);
    await app.logEvent(`Skimmed ${fuelNeeded}t fuel from gas giant. Time: ${skimTime} hours. Fuel is unrefined.`);
  } else if (choice === 'cheat') {
    const cost = applyFuelPurchase(s, fuelNeeded, FUEL_COST.refined * FUEL_CHEAT_MULTIPLIER, false);
    await app.logEvent(`CHEAT: Magically refueled ${fuelNeeded}t at ${world?.name || 'unknown world'}. Cost: Cr${cost.toLocaleString()}. Fuel is unrefined. Credits: Cr${s.credits.toLocaleString()}.`);
  } else if (choice === 'cheat_free') {
    s.ship.currentFuel = s.ship.fuelCapacity;
    s.ship.fuelIsRefined = false;
    advanceDate(s.gameDate, CHEAT_FREE_FUEL_DAYS * HOURS_PER_DAY);
    await app.logEvent(`CHEAT: Scrounged ${fuelNeeded}t fuel at ${world?.name || 'unknown world'}. Took ${CHEAT_FREE_FUEL_DAYS} days. Fuel is unrefined.`);
  }
  await accruePortFees(app);
}

export async function takePrivateMessages(app) {
  const s = app.state;
  const cache = getWorldCache(s);

  if (cache.privateMessageAccepted) {
    await app.logEvent('Private messages already accepted this visit. Cannot accept again.');
    return;
  }

  cache.privateMessagesTaken = true;

  const roll = await app._roll('2D6');
  const honorarium = roll * 10;
  const crewIndex = (await app._roll('1d' + s.crew.length)) - 1;
  const crewMember = s.crew[crewIndex];
  const crewName = crewMember?.name || 'a crew member';

  s.credits += honorarium;
  s.totalRevenue += honorarium;
  cache.privateMessageAccepted = true;
  cache.privateMessageCredits = honorarium;

  await app.logEvent(`${crewName} was approached to carry private messages. Honorarium: Cr${honorarium.toLocaleString()}. Credits: Cr${s.credits.toLocaleString()}.`);
}

export async function accruePortFees(app) {
  const s = app.state;
  const cache = getWorldCache(s);
  const currentDay = getAbsoluteDay(s.gameDate, s.milieu);
  const daysSpent = currentDay - cache.arrivalDay + 1;

  if (daysSpent > cache.portFeesPaidDays) {
    const extraDays = daysSpent - cache.portFeesPaidDays;
    const cost = extraDays * PORT_FEE_BASE;
    s.credits -= cost;
    s.totalExpenses += cost;
    cache.portFeesPaidDays = daysSpent;
    await app.logEvent(`Additional port fees for ${extraDays} extra day(s): Cr${cost.toLocaleString()}. Credits: Cr${s.credits.toLocaleString()}.`);
  }
}

// ─── Destination Helpers ─────────────────────────────────────

export async function chooseDestination(app) {
  const s = app.state;
  const cache = getWorldCache(s);
  const { reachable, options } = await getReachableDestinations(app);

  if (!reachable.length) {
    await app.logEvent('No worlds within jump range!');
    return;
  }

  if (s.destinationHex) {
    options.unshift({ value: 'clear', label: game.i18n.localize('TWODSIX.Trader.Actions.ClearDestination') });
  }

  const chosen = await app._choose(game.i18n.localize('TWODSIX.Trader.Prompts.ChooseDestination'), options, null);

  if (chosen === 'clear') {
    if (cache.privateMessageAccepted && cache.privateMessageCredits > 0) {
      const confirm = await app._choose(
        `Changing destination will forfeit the private message payment (Cr${cache.privateMessageCredits.toLocaleString()}). Continue?`,
        [
          { value: 'confirm', label: 'Yes, clear destination and forfeit payment' },
          { value: 'cancel', label: 'Cancel' },
        ]
      );
      if (confirm === 'cancel') {
        return;
      }
      const forfeitedCredits = cache.privateMessageCredits;
      s.credits -= forfeitedCredits;
      s.totalRevenue -= forfeitedCredits;
      cache.privateMessageAccepted = false;
      cache.privateMessageCredits = 0;
      await app.logEvent(`Destination cleared. Private message payment forfeited: Cr${forfeitedCredits.toLocaleString()}.`);
    }
    s.destinationHex = '';
    s.destinationName = '';
    await app.logEvent('Destination cleared.');
    return;
  }

  const dest = reachable.find(w => getWorldCoordinate(w) === chosen);
  if (!dest) {
    return;
  }

  if (cache.privateMessageAccepted && cache.privateMessageCredits > 0 && s.destinationHex !== chosen) {
    const confirm = await app._choose(
      `Changing destination will forfeit the private message payment (Cr${cache.privateMessageCredits.toLocaleString()}). Continue?`,
      [
        { value: 'confirm', label: 'Yes, change destination and forfeit payment' },
        { value: 'cancel', label: 'Cancel' },
      ]
    );
    if (confirm === 'cancel') {
      return;
    }
    s.credits -= cache.privateMessageCredits;
    s.totalRevenue -= cache.privateMessageCredits;
    const forfeitedCredits = cache.privateMessageCredits;
    cache.privateMessageAccepted = false;
    cache.privateMessageCredits = 0;
    await app.logEvent(`Private message payment forfeited: Cr${forfeitedCredits.toLocaleString()}.`);
  }

  s.destinationHex = chosen;
  s.destinationGlobalHex = dest.globalHex || dest.hex || '';
  s.destinationName = dest.name;
  await app.logEvent(`Selected ${dest.name} as destination.`);
}

export async function getReachableDestinations(app) {
  const s = app.state;
  const currentHex = s.currentWorldHex;
  let { reachable, options } = buildDestinationOptions(s);

  if (reachable.length === 0 && s.cacheJournalName) {
    const journal = await getOrCreateCacheJournal(s.cacheJournalName);
    const allWorldsCache = await getCachedData(journal, CACHE_KEY_WORLDS) ?? {};
    const nearbyWorlds = [];

    for (const subKey in allWorldsCache) {
      const worlds = allWorldsCache[subKey];
      for (const w of worlds) {
        const targetHex = w.globalHex || w.hex;
        if (targetHex !== currentHex && hexDistance(currentHex, targetHex) <= s.ship.jumpRating) {
          w.subsectorKey = subKey;
          nearbyWorlds.push(w);
        }
      }
    }

    if (nearbyWorlds.length > 0) {
      await app.logEvent(`No known worlds within jump range! Checking ${s.cacheJournalName}... found ${nearbyWorlds.length} potential destinations.`);
      const newActors = await createWorldActors(nearbyWorlds, currentHex, journal);
      if (newActors.length > 0) {
        for (const na of newActors) {
          if (!s.worlds.find(w => w.id === na.id)) {
            s.worlds.push(na);
          }
        }
        const result = buildDestinationOptions(s);
        reachable = result.reachable;
        options = result.options;
      }
    }
  }

  return { reachable, options };
}

export function buildDestinationOptions(state) {
  const currentHex = state.currentWorldHex;
  const reachable = worldsInJumpRange(currentHex, state.ship.jumpRating, state.worlds);
  const options = reachable.map(w => {
    const targetHex = getWorldCoordinate(w);
    const displayHex = w.system?.coordinates || targetHex;
    const dist = hexDistance(currentHex, targetHex);
    const refuelNote = canRefuelAtWorld(w) ? "" : " ⚠️";
    return {
      value: targetHex,
      label: `${w.name} (${displayHex}) — ${w.system?.uwp} [${w.system?.tradeCodes}] — ${dist} parsec(s)${refuelNote}`,
    };
  });
  return { reachable, options };
}

/** Internal helper for worlds in jump range. */
function worldsInJumpRange(currentHex, jumpRating, worlds) {
  return worlds.filter(w => {
    const targetHex = getWorldCoordinate(w);
    return targetHex !== currentHex && hexDistance(currentHex, targetHex) <= jumpRating;
  });
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
  for (let i = s.cargo.length - 1; i >= 0 && remaining > 0; i--) {
    if (s.cargo[i].name === name) {
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
    }
  }

  s.crew = result.newCrew;
  s.cargo = result.newCargo;

  if (result.creditsDelta !== 0) {
    s.credits += result.creditsDelta;
    if (result.creditsDelta > 0) {
      s.totalRevenue += result.creditsDelta;
    } else {
      s.totalExpenses += -result.creditsDelta;
    }
  }

  s.freight = Math.max(0, (s.freight || 0) + result.freightDelta);

  if (result.bulkNormalDelta > 0) {
    s.cargo.push({ name: game.i18n.localize('TWODSIX.Trader.BulkLSNormal'), tons: result.bulkNormalDelta, purchasePricePerTon: 0, purchaseWorld: s.currentWorldName });
  } else if (result.bulkNormalDelta < 0) {
    removeBulkLifeSupport(s, game.i18n.localize('TWODSIX.Trader.BulkLSNormal'), -result.bulkNormalDelta);
  }
  if (result.bulkLuxuryDelta > 0) {
    s.cargo.push({ name: game.i18n.localize('TWODSIX.Trader.BulkLSLuxury'), tons: result.bulkLuxuryDelta, purchasePricePerTon: 0, purchaseWorld: s.currentWorldName });
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
