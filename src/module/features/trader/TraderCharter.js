/**
 * TraderCharter.js
 * Ship chartering logic.
 */

import { buildTradeReportRows, } from '../../utils/TradeGenerator.js';
import {
  CARGO_SALE_PRICE_MULTIPLIER,
  CHARTER_RATE,
  FREIGHT_RATE,
  FUEL_COST,
  FUEL_SKIM_RATE,
  PASSENGER_REVENUE
} from './TraderConstants.js';
import { advanceDate, getAbsoluteDay, getFreeCargoSpace, getFreeLowBerths, getFreeStaterooms, } from './TraderState.js';
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
    window: { title: 'Charter Ship' },
    content,
    ok: {
      label: 'Accept Charter',
      callback: (event, button) => {
        const form = button.closest('.dialog-content')?.querySelector('form') ?? button.form;
        return {
          cargo: Math.min(maxCargo, Math.max(0, parseInt(form.querySelector('[name=charterCargo]').value) || 0)),
          staterooms: Math.min(maxStaterooms, Math.max(0, parseInt(form.querySelector('[name=charterStaterooms]').value) || 0)),
          lowBerths: Math.min(maxLowBerths, Math.max(0, parseInt(form.querySelector('[name=charterLowBerths]').value) || 0)),
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
  const { getCurrentWorld } = await import('./TraderState.js');
  const { getTradeInfo } = await import('./TraderAtWorld.js');
  const world = getCurrentWorld(s);

  // --- Force-sell speculative cargo ---
  const cargoSpaceNeeded = (mode === 'all') ? s.cargo.reduce((sum, c) => sum + c.tons, 0) : charterCargo - getFreeCargoSpace(s);
  if ((mode === 'all' || cargoSpaceNeeded > 0) && s.cargo.length > 0) {
    const tradeInfo = getTradeInfo(app, world);
    const rows = buildTradeReportRows(tradeInfo);
    const salePriceMap = new Map();
    for (const r of rows) {
      if (r.sellPricePerTon > 0) {
        salePriceMap.set(r.name, r.sellPricePerTon);
      }
    }

    // Sell all cargo lots
    while (s.cargo.length > 0) {
      const lot = s.cargo[0];
      const salePrice = salePriceMap.get(lot.name) || Math.round(lot.purchasePricePerTon * CARGO_SALE_PRICE_MULTIPLIER);
      const revenue = lot.tons * salePrice;
      s.credits += revenue;
      s.totalRevenue += revenue;
      await app.logEvent(`Charter eviction: sold ${lot.tons}t ${game.i18n.localize(lot.name)} at Cr${salePrice.toLocaleString()}/t. Revenue: Cr${revenue.toLocaleString()}.`);
      s.cargo.splice(0, 1);
    }
  }

  // --- Dump freight ---
  const freightToEvict = (mode === 'all') ? s.freight : Math.max(0, charterCargo - getFreeCargoSpace(s));
  if (freightToEvict > 0 && s.freight > 0) {
    const evicted = Math.min(s.freight, freightToEvict);
    const refund = evicted * FREIGHT_RATE;
    s.freight -= evicted;
    s.credits -= refund;
    s.totalRevenue -= refund;
    await app.logEvent(`Charter eviction: dumped ${evicted}t freight. Refunded Cr${refund.toLocaleString()}.`);
  }

  // --- Evict high passengers (staterooms) ---
  const stateroomsNeeded = (mode === 'all') ? (s.passengers.high + s.passengers.middle) : charterStaterooms - getFreeStaterooms(s);
  if (stateroomsNeeded > 0) {
    // Evict high passengers first, then middle
    const highEvict = Math.min(s.passengers.high, stateroomsNeeded);
    if (highEvict > 0) {
      const refund = highEvict * PASSENGER_REVENUE.high;
      s.passengers.high -= highEvict;
      s.credits -= refund;
      s.totalRevenue -= refund;
      await app.logEvent(`Charter eviction: evicted ${highEvict} high passenger(s). Refunded Cr${refund.toLocaleString()}.`);
    }

    const remainingNeeded = stateroomsNeeded - highEvict;
    if (remainingNeeded > 0) {
      const midEvict = Math.min(s.passengers.middle, remainingNeeded);
      if (midEvict > 0) {
        const refund = midEvict * PASSENGER_REVENUE.middle;
        s.passengers.middle -= midEvict;
        s.credits -= refund;
        s.totalRevenue -= refund;
        await app.logEvent(`Charter eviction: evicted ${midEvict} middle passenger(s). Refunded Cr${refund.toLocaleString()}.`);
      }
    }
  }

  // --- Evict low passengers ---
  const lowBerthsNeeded = (mode === 'all') ? s.passengers.low : charterLowBerths - getFreeLowBerths(s);
  if (lowBerthsNeeded > 0 && s.passengers.low > 0) {
    const lowEvict = Math.min(s.passengers.low, lowBerthsNeeded);
    const refund = lowEvict * PASSENGER_REVENUE.low;
    s.passengers.low -= lowEvict;
    s.credits -= refund;
    s.totalRevenue -= refund;
    await app.logEvent(`Charter eviction: evicted ${lowEvict} low passenger(s). Refunded Cr${refund.toLocaleString()}.`);
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
    await app.logEvent('No space selected for charter.');
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
  let confirmMsg = `Charter ${cargo}t cargo, ${staterooms} stateroom(s), ${lowBerths} low berth(s) for 2 weeks. Fee: Cr${fee.toLocaleString()}.`;
  if (needsEviction) {
    confirmMsg += ' WARNING: This will evict current passengers/freight and force-sell speculative cargo to make room.';
  }
  const confirmed = await app._choose(confirmMsg, [
    { value: 'confirm', label: 'Accept charter' },
    { value: 'cancel', label: 'Cancel' },
  ]);
  if (confirmed === 'cancel') {
    return;
  }

  // 5. Evict if needed
  if (needsEviction) {
    await evictForCharter(app, cargo, staterooms, lowBerths, mode);
  }

  // 6. Apply charter state
  s.credits += fee;
  s.totalRevenue += fee;
  s.chartered = true;
  s.charterCargo = cargo;
  s.charterStaterooms = staterooms;
  s.charterLowBerths = lowBerths;
  s.charterExpiryDay = getAbsoluteDay(s.gameDate) + 14;

  await app.logEvent(`Ship chartered to ${s.destinationName}. ${cargo}t cargo, ${staterooms} stateroom(s), ${lowBerths} low berth(s). Fee: Cr${fee.toLocaleString()}. Charter expires day ${s.charterExpiryDay}. Credits: Cr${s.credits.toLocaleString()}.`);

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
 * Used by charter to avoid manual refuel interaction.
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
      s.credits -= fullCost;
      s.totalExpenses += fullCost;
      s.ship.currentFuel += fuelNeeded;
      s.ship.fuelIsRefined = true;
      await app.logEvent(`Auto-refueled ${fuelNeeded}t refined fuel for charter departure. Cost: Cr${fullCost.toLocaleString()}.`);
      return;
    } else {
      const affordable = Math.max(0, Math.floor(s.credits / FUEL_COST.refined));
      if (affordable > 0) {
        const cost = affordable * FUEL_COST.refined;
        s.credits -= cost;
        s.totalExpenses += cost;
        s.ship.currentFuel += affordable;
        s.ship.fuelIsRefined = true;
        await app.logEvent(`Auto-refueled ${affordable}t refined fuel (partial) for charter departure. Cost: Cr${cost.toLocaleString()}.`);
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
      s.credits -= fullCost;
      s.totalExpenses += fullCost;
      s.ship.currentFuel += remainingNeeded;
      s.ship.fuelIsRefined = false;
      await app.logEvent(`Auto-refueled ${remainingNeeded}t unrefined fuel for charter departure. Cost: Cr${fullCost.toLocaleString()}.`);
      return;
    } else {
      const affordable = Math.max(0, Math.floor(s.credits / FUEL_COST.unrefined));
      if (affordable > 0) {
        const cost = affordable * FUEL_COST.unrefined;
        s.credits -= cost;
        s.totalExpenses += cost;
        s.ship.currentFuel += affordable;
        s.ship.fuelIsRefined = false;
        await app.logEvent(`Auto-refueled ${affordable}t unrefined fuel (partial) for charter departure. Cost: Cr${cost.toLocaleString()}.`);
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
    await app.logEvent(`Auto-refueled ${finalRemaining}t from gas giant for charter departure. Time: ${skimTime} hours.`);
    return;
  }

  if (s.ship.currentFuel < jumpFuel) {
    await app.logEvent('WARNING: Unable to fully refuel for charter departure! Proceeding with insufficient fuel.');
  }
}

/**
 * Compute charter fee based on available capacity.
 */
export function computeCharterFee(state, cargo, staterooms, lowBerths) {
  const c = cargo ?? getFreeCargoSpace(state);
  const s = staterooms ?? getFreeStaterooms(state);
  const l = lowBerths ?? getFreeLowBerths(state);
  return c * CHARTER_RATE.cargoPerTon
    + s * CHARTER_RATE.highPassage
    + l * CHARTER_RATE.lowPassage;
}
