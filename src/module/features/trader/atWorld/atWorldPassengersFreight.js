/**
 * Passengers, freight, and mail while docked.
 */

import { getTraderRuleset } from '../TraderRulesetRegistry.js';
import {
  getFreeCargoSpace,
  getFreeLowBerths,
  getFreeStaterooms,
  getWorldCache,
  normalizeFreightState,
  normalizePassengers,
} from '../TraderState.js';
import { chooseIntOption } from './atWorldShared.js';

/**
 * @param {import('../TraderApp.js').TraderApp} app
 * @param {import('../../entities/TwodsixActor').default} world
 */
export async function seekPassengers(app, world) {
  const s = app.state;
  const cache = getWorldCache(s);
  const ruleset = getTraderRuleset(s.ruleset);
  const passengerRevenue = ruleset.getPassengerRevenue();

  if (!cache.passengers) {
    cache.passengers = await ruleset.generatePassengerMarket(app, s, world);
    await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.PassengerMarket', {
      high: cache.passengers.high,
      mid: cache.passengers.middle,
      steerage: cache.passengers.steerage,
      low: cache.passengers.low,
      world: s.currentWorldName,
    }));
  }

  cache.passengers = normalizePassengers(cache.passengers);
  const { high: highAvail, middle: midAvail, steerage: steerageAvail, low: lowAvail } = cache.passengers;

  if (highAvail === 0 && midAvail === 0 && steerageAvail === 0 && lowAvail === 0) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.NoPassengersAvailable'));
    return;
  }

  await bookPassengerClass(app, 'high', highAvail, getFreeStaterooms(s), passengerRevenue.high, 'TWODSIX.Trader.Prompts.HighPassengers');

  await bookPassengerClass(app, 'middle', cache.passengers.middle, getFreeStaterooms(s), passengerRevenue.middle, 'TWODSIX.Trader.Prompts.MiddlePassengers');

  if (passengerRevenue.steerage) {
    const oddSteerageBerth = s.passengers.steerage % 2 === 1 ? 1 : 0;
    await bookPassengerClass(
      app,
      'steerage',
      cache.passengers.steerage,
      getFreeStaterooms(s) * 2 + oddSteerageBerth,
      passengerRevenue.steerage,
      'TWODSIX.Trader.Prompts.SteeragePassengers',
    );
  }

  await bookPassengerClass(app, 'low', cache.passengers.low, getFreeLowBerths(s), passengerRevenue.low, 'TWODSIX.Trader.Prompts.LowPassengers');
}

/**
 * @param {import('../TraderApp.js').TraderApp} app
 * @param {string} classKey
 * @param {number} available
 * @param {number} capacity
 * @param {number} revenuePerHead
 * @param {string} promptKey
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
      await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.BookedPassengers', {
        count: count,
        type: classKey,
        revenue: rev.toLocaleString(),
      }));
    }
  }
}

/**
 * @param {import('../TraderApp.js').TraderApp} app
 * @param {import('../../entities/TwodsixActor').default} world
 */
export async function seekFreight(app, world) {
  const s = app.state;
  const cache = getWorldCache(s);
  const ruleset = getTraderRuleset(s.ruleset);
  const freightRate = ruleset.getFreightRate();

  if (cache.freight === null) {
    const freightOffer = await ruleset.generateFreightMarket(app, s, world);
    cache.freight = Math.max(0, freightOffer?.tons || 0);
    cache.freightLots = Array.isArray(freightOffer?.lots) ? freightOffer.lots : [];
  }

  const available = cache.freight;
  const freeSpace = getFreeCargoSpace(s);

  if (available === 0 || freeSpace === 0) {
    await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.NoFreightAvailable', {
      offered: available,
      free: freeSpace,
    }));
    return;
  }

  const maxTons = Math.min(available, freeSpace);
  const options = [];
  const step = maxTons > 20 ? 5 : 1;
  for (let i = 0; i <= maxTons; i += step) {
    options.push({ value: String(i), label: `${i} tons (Cr${(i * freightRate).toLocaleString()})` });
  }
  if (maxTons % step !== 0) {
    options.push({ value: String(maxTons), label: `${maxTons} tons (Cr${(maxTons * freightRate).toLocaleString()})` });
  }

  const tons = await chooseIntOption(app,
    game.i18n.format('TWODSIX.Trader.Prompts.Freight', { available, freeSpace }),
    options,
    maxTons,
  );

  if (tons > 0) {
    cache.freight -= tons;
    const availableLots = Array.isArray(cache.freightLots) ? cache.freightLots : [];
    let remaining = tons;
    s.freightLots = Array.isArray(s.freightLots) ? s.freightLots : [];
    const bookedLots = [];
    while (remaining > 0 && availableLots.length > 0) {
      const lot = availableLots[0];
      const take = Math.min(remaining, lot.tons);
      const booked = {
        tons: take,
        rate: lot.rate,
        kind: lot.kind,
      };
      s.freightLots.push(booked);
      bookedLots.push(booked);
      lot.tons -= take;
      remaining -= take;
      if (lot.tons <= 0) {
        availableLots.shift();
      }
    }
    if (remaining > 0) {
      s.freightLots.push({ tons: remaining, rate: freightRate });
    }
    normalizeFreightState(s);
    const bookedValue = bookedLots.reduce((sum, lot) => sum + (lot.rate * lot.tons), 0) + (remaining * freightRate);
    const blendedRate = Math.round(bookedValue / tons);
    await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.LoadedFreight', {
      tons: tons,
      revenue: (tons * blendedRate).toLocaleString(),
    }));
  }
}

/**
 * @param {import('../TraderApp.js').TraderApp} app
 * @param {import('../../entities/TwodsixActor').default} world
 */
export async function seekMail(app, world) {
  const s = app.state;
  const ruleset = getTraderRuleset(s.ruleset);
  if (s.hasMail) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.AlreadyCarryingMail'));
    return;
  }

  const cache = getWorldCache(s);
  if (cache.mailChecked) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.AlreadyCheckedMail'));
    return;
  }

  const mailOffer = await ruleset.generateMailOffer(app, s, world);
  cache.mailChecked = true;
  if (mailOffer?.available) {
    const containers = Math.max(1, Number(mailOffer.containers) || 1);
    const cargoPerContainer = Math.max(1, Number(mailOffer.tonsPerContainer) || 5);
    const paymentPerContainer = Math.max(0, Number(mailOffer.paymentPerContainer) || ruleset.getMailPayment());
    const maxContainersBySpace = Math.floor(getFreeCargoSpace(s) / cargoPerContainer);
    const accepted = Math.min(containers, maxContainersBySpace);
    if (accepted <= 0) {
      await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.NoMailAvailable'));
      return;
    }
    s.hasMail = true;
    s.mailContainers = accepted;
    s.mailPaymentPerContainer = paymentPerContainer;
    await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.MailContractSecured', {
      revenue: (accepted * paymentPerContainer).toLocaleString(),
    }));
  } else {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.NoMailAvailable'));
  }
}
