/**
 * TraderCharter.js
 * Ship chartering logic.
 */

import { buildTradeReportRows, } from '../../utils/TradeGenerator.js';
import { accruePortFees, affordableFuel, applyFuelPurchase, getTradeInfo } from './atWorldBridge.js';
import { CARGO_SALE_PRICE_MULTIPLIER, FUEL_COST, FUEL_SKIM_RATE, } from './TraderConstants.js';
import { getTraderRuleset } from './TraderRulesetRegistry.js';
import {
  addRevenue,
  advanceDate,
  getAbsoluteDay,
  getCurrentWorld,
  getFreeCargoSpace,
  getFreeLowBerths,
  getFreeStaterooms,
  getPassengerStateroomUsage,
  normalizeFreightState,
  normalizePassengers,
} from './TraderState.js';
import { getRefuelOptions, } from './TraderUtils.js';

/**
 * Show a dialog for the player to select how much space to charter.
 */
export async function showCharterDialog(app) {
  const s = app.state;
  const freeCargo = getFreeCargoSpace(s);
  const freeStaterooms = getFreeStaterooms(s);
  const freeLowBerths = getFreeLowBerths(s);
  const maxCargo = s.ship.cargoCapacity;
  const maxStaterooms = Math.max(0, s.ship.staterooms - s.crew.length);
  const maxLowBerths = s.ship.lowBerths;

  const context = {
    destinationName: s.destinationName,
    freeCargo,
    maxCargo,
    freeStaterooms,
    maxStaterooms,
    freeLowBerths,
    maxLowBerths,
  };

  const content = await foundry.applications.handlebars.renderTemplate(
    'systems/twodsix/templates/trader/trader-charter.hbs',
    context
  );

  return foundry.applications.api.DialogV2.prompt({
    window: { title: game.i18n.localize('TWODSIX.Trader.Charter.Title') },
    content,
    ok: {
      label: game.i18n.localize('TWODSIX.Trader.Charter.Accept'),
      callback: (event, button) => {
        const parseNonNegativeInt = (value) => {
          const parsed = Number.parseInt(value, 10);
          return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
        };
        const form = button.closest('.dialog-content')?.querySelector('form') ?? button.form;
        return {
          cargo: Math.min(maxCargo, parseNonNegativeInt(form.querySelector('[name=charterCargo]').value)),
          staterooms: Math.min(maxStaterooms, parseNonNegativeInt(form.querySelector('[name=charterStaterooms]').value)),
          lowBerths: Math.min(maxLowBerths, parseNonNegativeInt(form.querySelector('[name=charterLowBerths]').value)),
          mode: form.querySelector('[name=charterMode]:checked').value,
        };
      },
    },
    rejectClose: false,
    render: (event, dialog) => {
      dialog.element.querySelectorAll('[name=charterMode]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          const mode = e.target.value;
          const cargoInput = dialog.element.querySelector('[name=charterCargo]');
          const srInput = dialog.element.querySelector('[name=charterStaterooms]');
          const lbInput = dialog.element.querySelector('[name=charterLowBerths]');
          if (mode === 'available') {
            cargoInput.value = freeCargo;
            srInput.value = freeStaterooms;
            lbInput.value = freeLowBerths;
          } else {
            cargoInput.value = maxCargo;
            srInput.value = maxStaterooms;
            lbInput.value = maxLowBerths;
          }
        });
      });
    },
  });
}

/**
 * Evict passengers, freight, and cargo to make space for a charter.
 */
export async function evictForCharter(app, charterCargo, charterStaterooms, charterLowBerths, mode) {
  const s = app.state;
  const world = getCurrentWorld(s);
  const ruleset = getTraderRuleset(s.ruleset);
  const passengerRevenue = ruleset.getPassengerRevenue();
  const freightRate = ruleset.getFreightRate();

  // --- Force-sell speculative cargo ---
  const cargoSpaceNeeded = mode === 'all'
    ? s.cargo.reduce((sum, c) => sum + c.tons, 0)
    : Math.max(0, charterCargo - getFreeCargoSpace(s));
  if (cargoSpaceNeeded > 0 && s.cargo.length > 0) {
    const tradeInfo = getTradeInfo(app, world);
    const rows = buildTradeReportRows(tradeInfo);
    const salePriceMap = new Map();
    for (const r of rows) {
      if (r.sellPricePerTon > 0) {
        salePriceMap.set(r.name, r.sellPricePerTon);
      }
    }

    let remainingCargoToSell = cargoSpaceNeeded;
    while (remainingCargoToSell > 0 && s.cargo.length > 0) {
      const lot = s.cargo[0];
      const tonsToSell = Math.min(remainingCargoToSell, lot.tons);
      const salePrice = salePriceMap.get(lot.name) || Math.round(lot.purchasePricePerTon * CARGO_SALE_PRICE_MULTIPLIER);
      const revenue = tonsToSell * salePrice;
      s.credits += revenue;
      s.totalRevenue += revenue;
      await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.CharterEvictionSold", {
        tons: tonsToSell,
        good: game.i18n.localize(lot.name),
        price: salePrice.toLocaleString(),
        revenue: revenue.toLocaleString()
      }));
      lot.tons -= tonsToSell;
      remainingCargoToSell -= tonsToSell;
      if (lot.tons <= 0) {
        s.cargo.shift();
      }
    }
  }

  // --- Dump freight ---
  normalizeFreightState(s);
  const freightToEvict = mode === 'all' ? s.freight : Math.max(0, charterCargo - getFreeCargoSpace(s));
  if (freightToEvict > 0 && s.freight > 0) {
    let remainingFreightToEvict = Math.min(s.freight, freightToEvict);
    let totalRefund = 0;
    if (s.freightLots.length > 0) {
      while (remainingFreightToEvict > 0 && s.freightLots.length > 0) {
        const lot = s.freightLots[0];
        const removedTons = Math.min(remainingFreightToEvict, lot.tons);
        totalRefund += removedTons * (lot.rate || freightRate);
        lot.tons -= removedTons;
        remainingFreightToEvict -= removedTons;
        if (lot.tons <= 0) {
          s.freightLots.shift();
        }
      }
    } else {
      totalRefund = remainingFreightToEvict * freightRate;
      remainingFreightToEvict = 0;
    }
    const evicted = Math.min(s.freight, freightToEvict);
    s.freight = Math.max(0, s.freight - evicted);
    normalizeFreightState(s);
    s.credits -= totalRefund;
    s.totalRevenue -= totalRefund;
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.CharterEvictionDumped", {
      tons: evicted,
      refund: totalRefund.toLocaleString()
    }));
  }

  // --- Evict stateroom passengers ---
  s.passengers = normalizePassengers(s.passengers);
  const stateroomsNeeded = (mode === 'all')
    ? getPassengerStateroomUsage(s.passengers)
    : charterStaterooms - getFreeStaterooms(s);
  if (stateroomsNeeded > 0) {
    // Evict high passengers first, then middle, then steerage.
    const highEvict = Math.min(s.passengers.high, stateroomsNeeded);
    if (highEvict > 0) {
      const refund = highEvict * passengerRevenue.high;
      s.passengers.high -= highEvict;
      s.credits -= refund;
      s.totalRevenue -= refund;
      await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.CharterEvictionPax", {
        count: highEvict,
        type: 'high',
        refund: refund.toLocaleString()
      }));
    }

    let remainingNeeded = stateroomsNeeded - highEvict;
    if (remainingNeeded > 0) {
      const midEvict = Math.min(s.passengers.middle, remainingNeeded);
      if (midEvict > 0) {
        const refund = midEvict * passengerRevenue.middle;
        s.passengers.middle -= midEvict;
        s.credits -= refund;
        s.totalRevenue -= refund;
        remainingNeeded -= midEvict;
        await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.CharterEvictionPax", {
          count: midEvict,
          type: 'middle',
          refund: refund.toLocaleString()
        }));
      }
    }

    if (remainingNeeded > 0 && s.passengers.steerage > 0) {
      const steerageEvict = Math.min(s.passengers.steerage, remainingNeeded * 2);
      const refund = steerageEvict * (passengerRevenue.steerage || 0);
      s.passengers.steerage -= steerageEvict;
      s.credits -= refund;
      s.totalRevenue -= refund;
      await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.CharterEvictionPax", {
        count: steerageEvict,
        type: 'steerage',
        refund: refund.toLocaleString()
      }));
    }
  }

  // --- Evict low passengers ---
  const lowBerthsNeeded = (mode === 'all') ? s.passengers.low : charterLowBerths - getFreeLowBerths(s);
  if (lowBerthsNeeded > 0 && s.passengers.low > 0) {
    const lowEvict = Math.min(s.passengers.low, lowBerthsNeeded);
    const refund = lowEvict * passengerRevenue.low;
    s.passengers.low -= lowEvict;
    s.credits -= refund;
    s.totalRevenue -= refund;
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.CharterEvictionPax", {
      count: lowEvict,
      type: 'low',
      refund: refund.toLocaleString()
    }));
  }
}

export async function acceptCharter(app) {
  const s = app.state;
  const { getCurrentWorld } = await import('./TraderState.js');
  const world = getCurrentWorld(s);

  // 1. Show charter dialog to select space
  const selection = await showCharterDialog(app);
  if (!selection) {
    return;
  }

  const { cargo, staterooms, lowBerths, mode } = selection;

  // Validate at least some space is being chartered
  if (cargo <= 0 && staterooms <= 0 && lowBerths <= 0) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.CharterNoSpace'));
    return;
  }

  // 2. Compute charter fee based on selected space
  const fee = computeCharterFee(s, cargo, staterooms, lowBerths);

  // 3. Determine if eviction is needed
  const needsEviction = (mode === 'all')
    || cargo > getFreeCargoSpace(s)
    || staterooms > getFreeStaterooms(s)
    || lowBerths > getFreeLowBerths(s);

  // 4. Confirmation
  let confirmMsg = game.i18n.format('TWODSIX.Trader.Charter.Confirm', {
    cargo,
    staterooms,
    lowBerths,
    fee: fee.toLocaleString()
  });
  if (needsEviction) {
    confirmMsg += ` ${game.i18n.localize('TWODSIX.Trader.Charter.EvictionWarning')}`;
  }
  const confirmed = await app._choose(confirmMsg, [
    { value: 'confirm', label: game.i18n.localize('TWODSIX.Trader.Charter.Accept') },
    { value: 'cancel', label: game.i18n.localize('Cancel') },
  ]);
  if (confirmed === 'cancel') {
    return;
  }

  // 5. Evict if needed
  if (needsEviction) {
    await evictForCharter(app, cargo, staterooms, lowBerths, mode);
  }

  // 6. Apply charter state
  addRevenue(s, fee);
  s.chartered = true;
  s.charterCargo = cargo;
  s.charterStaterooms = staterooms;
  s.charterLowBerths = lowBerths;
  s.charterExpiryDay = getAbsoluteDay(s.gameDate, s.milieu) + 14;

  await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.CharterStarted", {
    destination: s.destinationName,
    cargo: cargo,
    staterooms: staterooms,
    lowBerths: lowBerths,
    fee: fee.toLocaleString(),
    day: s.charterExpiryDay,
    credits: s.credits.toLocaleString()
  }));

  // 7. Auto-refuel if needed
  const jumpFuel = Math.ceil(s.ship.tonnage * s.ship.jumpRating * 0.1);
  if (s.ship.currentFuel < jumpFuel) {
    await autoRefuel(app, world, jumpFuel);
  }

  const { executeDeparture } = await import('./TraderTransit.js');
  await executeDeparture(app);
}

/**
 * Automatically refuel, picking the best available option.
 * Uses shared fuel helpers from atWorld refuel module (via atWorldBridge).
 */
export async function autoRefuel(app, world, jumpFuel) {
  const s = app.state;
  const fuelNeeded = Math.min(jumpFuel, s.ship.fuelCapacity) - s.ship.currentFuel;
  if (fuelNeeded <= 0) {
    return;
  }

  const { starport, hasGasGiant } = getRefuelOptions(world);

  // Prefer refined fuel at A/B starports
  if (['A', 'B'].includes(starport)) {
    const fullCost = fuelNeeded * FUEL_COST.refined;
    if (s.credits >= fullCost) {
      const cost = applyFuelPurchase(s, fuelNeeded, FUEL_COST.refined, true);
      await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.CharterAutoRefuelRefined", {
        tons: fuelNeeded,
        cost: cost.toLocaleString()
      }));
      return;
    } else {
      const tons = affordableFuel(s.credits, FUEL_COST.refined);
      if (tons > 0) {
        const cost = applyFuelPurchase(s, tons, FUEL_COST.refined, true);
        await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.CharterAutoRefuelRefinedPartial", {
          tons: tons,
          cost: cost.toLocaleString()
        }));
      }
    }
  }

  const remainingNeeded = Math.min(jumpFuel, s.ship.fuelCapacity) - s.ship.currentFuel;
  if (remainingNeeded <= 0) {
    return;
  }

  // Unrefined fuel at A/B/C/D starports
  if (['A', 'B', 'C', 'D'].includes(starport)) {
    const fullCost = remainingNeeded * FUEL_COST.unrefined;
    if (s.credits >= fullCost) {
      const cost = applyFuelPurchase(s, remainingNeeded, FUEL_COST.unrefined, false);
      await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.CharterAutoRefuelUnrefined", {
        tons: remainingNeeded,
        cost: cost.toLocaleString()
      }));
      return;
    } else {
      const tons = affordableFuel(s.credits, FUEL_COST.unrefined);
      if (tons > 0) {
        const cost = applyFuelPurchase(s, tons, FUEL_COST.unrefined, false);
        await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.CharterAutoRefuelUnrefinedPartial", {
          tons: tons,
          cost: cost.toLocaleString()
        }));
      }
    }
  }

  const finalRemaining = Math.min(jumpFuel, s.ship.fuelCapacity) - s.ship.currentFuel;
  if (finalRemaining <= 0) {
    return;
  }

  // Gas giant skimming
  if (hasGasGiant) {
    const skimTime = Math.ceil(finalRemaining / FUEL_SKIM_RATE) * (await app._roll('1d6'));
    s.ship.currentFuel += finalRemaining;
    s.ship.fuelIsRefined = false;
    advanceDate(s.gameDate, skimTime);
    await accruePortFees(app);
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.CharterAutoRefuelGasGiant", {
      tons: finalRemaining,
      time: skimTime
    }));
    return;
  }

  if (s.ship.currentFuel < jumpFuel) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.CharterWarningFuel'));
  }
}

/**
 * Compute charter fee based on available capacity.
 */
export function computeCharterFee(state, cargo, staterooms, lowBerths) {
  const c = cargo ?? getFreeCargoSpace(state);
  const s = staterooms ?? getFreeStaterooms(state);
  const l = lowBerths ?? getFreeLowBerths(state);
  const charterRate = getTraderRuleset(state.ruleset).getCharterRate();
  return c * charterRate.cargoPerTon
    + s * charterRate.highPassage
    + l * charterRate.lowPassage;
}
