/**
 * Refueling, private messages, and port fees.
 */

import {
  CHEAT_FREE_FUEL_DAYS,
  FUEL_CHEAT_MULTIPLIER,
  FUEL_COST,
  FUEL_SKIM_RATE,
  HOURS_PER_DAY,
} from '../TraderConstants.js';
import { getTraderRuleset } from '../TraderRulesetRegistry.js';
import { addExpense, addRevenue, advanceDate, getAbsoluteDay, getCurrentWorld, getWorldCache } from '../TraderState.js';
import { canAffordRefuelAtWorld, getRefuelOptions } from '../TraderUtils.js';

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
 * @param {number} credits - Available credits
 * @param {number} costPerTon - Cost per ton
 * @returns {number}
 */
export function affordableFuel(credits, costPerTon) {
  return Math.max(0, Math.floor(credits / costPerTon));
}

/**
 * @param {import('../TraderApp.js').TraderApp} app
 * @param {import('../../entities/TwodsixActor').default} world
 */
export async function refuel(app, world) {
  const s = app.state;
  const fuelNeeded = s.ship.fuelCapacity - s.ship.currentFuel;

  if (fuelNeeded <= 0) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.FuelFull'));
    return;
  }

  const { starport, hasGasGiant } = getRefuelOptions(world);
  const options = [];

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

  if (hasGasGiant) {
    options.push({
      value: 'gasgiant',
      label: game.i18n.format('TWODSIX.Trader.Prompts.RefuelGasGiantOption', { needed: fuelNeeded }),
    });
  }

  if (!canAffordRefuelAtWorld(world, s)) {
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
    options,
  );

  if (choice === 'refined') {
    const cost = applyFuelPurchase(s, fuelNeeded, FUEL_COST.refined, true);
    await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.PurchasedFuel', {
      tons: fuelNeeded,
      quality: game.i18n.localize('TWODSIX.Trader.OtherActivities.Refined'),
      cost: cost.toLocaleString(),
      credits: s.credits.toLocaleString(),
    }));
  } else if (choice === 'refined_partial') {
    const tons = affordableFuel(s.credits, FUEL_COST.refined);
    const cost = applyFuelPurchase(s, tons, FUEL_COST.refined, true);
    await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.PurchasedFuelPartial', {
      tons,
      quality: game.i18n.localize('TWODSIX.Trader.OtherActivities.Refined'),
      cost: cost.toLocaleString(),
      credits: s.credits.toLocaleString(),
      current: s.ship.currentFuel,
      capacity: s.ship.fuelCapacity,
    }));
  } else if (choice === 'unrefined') {
    const cost = applyFuelPurchase(s, fuelNeeded, FUEL_COST.unrefined, false);
    await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.PurchasedFuel', {
      tons: fuelNeeded,
      quality: game.i18n.localize('TWODSIX.Trader.OtherActivities.Unrefined'),
      cost: cost.toLocaleString(),
      credits: s.credits.toLocaleString(),
    }));
  } else if (choice === 'unrefined_partial') {
    const tons = affordableFuel(s.credits, FUEL_COST.unrefined);
    const cost = applyFuelPurchase(s, tons, FUEL_COST.unrefined, false);
    await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.PurchasedFuelPartial', {
      tons,
      quality: game.i18n.localize('TWODSIX.Trader.OtherActivities.Unrefined'),
      cost: cost.toLocaleString(),
      credits: s.credits.toLocaleString(),
      current: s.ship.currentFuel,
      capacity: s.ship.fuelCapacity,
    }));
  } else if (choice === 'gasgiant') {
    const skimTime = Math.ceil(fuelNeeded / FUEL_SKIM_RATE) * (await app._roll('1d6'));
    s.ship.currentFuel = s.ship.fuelCapacity;
    s.ship.fuelIsRefined = false;
    advanceDate(s.gameDate, skimTime);
    await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.SkimmedFuel', {
      tons: fuelNeeded,
      time: skimTime,
    }));
  } else if (choice === 'cheat') {
    const cost = applyFuelPurchase(s, fuelNeeded, FUEL_COST.refined * FUEL_CHEAT_MULTIPLIER, false);
    await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.CheatRefueled', {
      tons: fuelNeeded,
      world: world?.name || game.i18n.localize('TWODSIX.Trader.App.Unknown'),
      cost: cost.toLocaleString(),
      credits: s.credits.toLocaleString(),
    }));
  } else if (choice === 'cheat_free') {
    s.ship.currentFuel = s.ship.fuelCapacity;
    s.ship.fuelIsRefined = false;
    advanceDate(s.gameDate, CHEAT_FREE_FUEL_DAYS * HOURS_PER_DAY);
    await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.CheatScrounged', {
      tons: fuelNeeded,
      world: world?.name || game.i18n.localize('TWODSIX.Trader.App.Unknown'),
      days: CHEAT_FREE_FUEL_DAYS,
    }));
  }
  await accruePortFees(app);
}

/**
 * @param {import('../TraderApp.js').TraderApp} app
 */
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

  await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.PrivateMessagesAccepted', {
    name: crewName,
    honorarium: honorarium.toLocaleString(),
    credits: s.credits.toLocaleString(),
  }));
}

/**
 * @param {import('../TraderApp.js').TraderApp} app
 */
export async function accruePortFees(app) {
  const s = app.state;
  const cache = getWorldCache(s);
  const currentDay = getAbsoluteDay(s.gameDate, s.milieu);
  const daysSpent = currentDay - cache.arrivalDay + 1;
  const ruleset = getTraderRuleset(s.ruleset);
  const world = getCurrentWorld(s);

  const result = ruleset.getBerthingCost(s, world, daysSpent, cache.portFeesPaidDays);
  if (!result || !(result.cost > 0)) {
    if (result && Number.isFinite(result.newDaysCharged)) {
      cache.portFeesPaidDays = result.newDaysCharged;
    }
    return;
  }
  const priorDaysCharged = cache.portFeesPaidDays;
  const chargedThrough = Number.isFinite(result.newDaysCharged) ? result.newDaysCharged : daysSpent;
  const extraDays = Math.max(0, chargedThrough - priorDaysCharged);
  addExpense(s, result.cost);
  cache.portFeesPaidDays = chargedThrough;
  await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.AdditionalPortFees', {
    days: extraDays,
    cost: result.cost.toLocaleString(),
    credits: s.credits.toLocaleString(),
  }));
}
