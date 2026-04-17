/**
 * AT_WORLD phase: action menu and main loop.
 */

import { getTraderRuleset } from '../TraderRulesetRegistry.js';
import {
  getAbsoluteDay,
  getFreeCargoSpace,
  getFreeLowBerths,
  getFreeStaterooms,
  getTotalPassengers,
  getWorldCache,
  PHASE,
} from '../TraderState.js';
import { canAffordRefuelAtWorld, traderDebug } from '../TraderUtils.js';
import { buyBulkLifeSupport, sellBulkLifeSupport } from './atWorldBulkLifeSupport.js';
import { chooseDestination } from './atWorldDestination.js';
import { otherActivities } from './atWorldOtherActivities.js';
import { seekFreight, seekMail, seekPassengers } from './atWorldPassengersFreight.js';
import { refuel, takePrivateMessages } from './atWorldRefuelPort.js';
import { findBuyer, findSupplier, hireBroker } from './atWorldSearch.js';
import { getBulkLifeSupportCargoId } from './atWorldShared.js';
import { buyGoods, sellGoods } from './atWorldTrade.js';

/**
 * @param {import('../TraderApp.js').TraderApp} app
 * @param {import('../../entities/TwodsixActor').default} world
 * @param {Record<string, string>} ACTION
 * @param {ReturnType<typeof getWorldCache>} cache
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
  if (s.includeIllegalGoods) {
    actions.push({ value: ACTION.HIRE_ILLEGAL_BROKER, label: game.i18n.localize('TWODSIX.Trader.Actions.HireIllegalBroker') });
  }

  if (!cache.foundSupplier) {
    actions.push({ value: ACTION.FIND_SUPPLIER, label: game.i18n.localize('TWODSIX.Trader.Actions.FindSupplier') });
  }
  if (s.cargo.length > 0 && !cache.foundBuyer) {
    actions.push({ value: ACTION.FIND_BUYER, label: game.i18n.localize('TWODSIX.Trader.Actions.FindBuyer') });
  }

  const paxMarketEmpty = cache.passengers !== null && getTotalPassengers(cache.passengers) === 0;
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

  const ruleset = getTraderRuleset(s.ruleset);
  const bulkLsEnabled = ruleset.isBulkLifeSupportEnabled();
  const hasBulkInCargo = s.cargo.some(c => getBulkLifeSupportCargoId(c) !== null);
  if (bulkLsEnabled) {
    const bulkCosts = ruleset.getBulkLifeSupportCosts();
    if (getFreeCargoSpace(s) > 0 && s.credits >= Math.min(bulkCosts.normal, bulkCosts.luxury)) {
      actions.push({ value: ACTION.BUY_BULK_LS, label: game.i18n.localize('TWODSIX.Trader.Actions.BuyBulkLifeSupport') });
    }
  }
  // Always allow selling bulk LS that's already in cargo (e.g. ruleset toggled mid-journey).
  if (hasBulkInCargo) {
    actions.push({ value: ACTION.SELL_BULK_LS, label: game.i18n.localize('TWODSIX.Trader.Actions.SellBulkLifeSupport') });
  }

  if (s.ship.currentFuel < s.ship.fuelCapacity) {
    const refuelNote = canAffordRefuelAtWorld(world, s) ? '' : ' ⚠️';
    actions.push({ value: ACTION.REFUEL, label: game.i18n.localize('TWODSIX.Trader.Actions.Refuel') + refuelNote });
  }

  if (s.destinationHex && !cache.privateMessagesTaken) {
    actions.push({ value: ACTION.PRIVATE_MESSAGES, label: game.i18n.localize('TWODSIX.Trader.Actions.PrivateMessages') });
  }

  const illegalLabel = s.includeIllegalGoods ? 'TWODSIX.Trader.Actions.DisableIllegal' : 'TWODSIX.Trader.Actions.EnableIllegal';
  actions.push({ value: ACTION.TOGGLE_ILLEGAL, label: game.i18n.localize(illegalLabel) });

  if (s.destinationHex && !s.chartered) {
    const { computeCharterFee } = await import('../TraderCharter.js');
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
 * @param {import('../TraderApp.js').TraderApp} app
 * @param {import('../../entities/TwodsixActor').default} world
 * @param {Record<string, string>} ACTION
 */
export async function atWorldPhase(app, world, ACTION) {
  const s = app.state;
  traderDebug('TraderAtWorld', ` atWorldPhase starting`, { world: world?.name, hex: s.currentWorldHex });

  while (s.phase === PHASE.AT_WORLD) {
    traderDebug('TraderAtWorld', ` atWorldPhase loop iteration`, { phase: s.phase, destinationHex: s.destinationHex });
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
      actions,
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
        await seekMail(app, world);
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
      case ACTION.HIRE_ILLEGAL_BROKER:
        await hireBroker(app, world, { illegal: true });
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
        cache.tradeInfo = null;
        await app.logEvent(s.includeIllegalGoods ? game.i18n.localize('TWODSIX.Trader.Log.BlackMarketActivated') : game.i18n.localize('TWODSIX.Trader.Log.BlackMarketDeactivated'));
        break;
      case ACTION.CHARTER: {
        const { acceptCharter } = await import('../TraderCharter.js');
        await acceptCharter(app);
        break;
      }
      case ACTION.OTHER_ACTIVITIES:
        await otherActivities(app);
        break;
      case ACTION.DEPART: {
        const { depart } = await import('../TraderTransit.js');
        await depart(app);
        break;
      }
    }
  }
}
