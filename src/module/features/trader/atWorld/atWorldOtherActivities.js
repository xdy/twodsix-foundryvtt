/**
 * Other activities dialog loop and state application.
 */

import { OtherActivitiesApp } from '../OtherActivitiesApp.js';
import { buildShipFromActor } from '../shipFromActor.js';
import { BULK_LS_CARGO_ID, HOURS_PER_DAY } from '../TraderConstants.js';
import { getTraderRuleset } from '../TraderRulesetRegistry.js';
import { addExpense, addRevenue, advanceDate, normalizeFreightState, updateMortgageFromShip, } from '../TraderState.js';
import { accruePortFees } from './atWorldRefuelPort.js';

/**
 * @param {import('../TraderState.js').TraderState} s
 * @param {string} name
 * @param {number} tons
 */
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

/**
 * Apply manual freight adjustment while keeping freight lots consistent.
 * Positive delta adds a new lot at current ruleset default rate.
 * Negative delta removes from existing lots first (FIFO), then scalar.
 * @param {import('../TraderState.js').TraderState} s
 * @param {number} delta
 */
function applyFreightDelta(s, delta) {
  const parsedDelta = Number(delta) || 0;
  if (parsedDelta === 0) {
    return;
  }
  s.freightLots = Array.isArray(s.freightLots) ? s.freightLots : [];
  if (parsedDelta > 0) {
    const ruleset = getTraderRuleset(s.ruleset);
    s.freightLots.push({ tons: parsedDelta, rate: ruleset.getFreightRate(), kind: 'manual' });
    normalizeFreightState(s);
    return;
  }
  let tonsToRemove = Math.abs(parsedDelta);
  while (tonsToRemove > 0 && s.freightLots.length > 0) {
    const lot = s.freightLots[0];
    const removed = Math.min(tonsToRemove, lot.tons);
    lot.tons -= removed;
    tonsToRemove -= removed;
    if (lot.tons <= 0) {
      s.freightLots.shift();
    }
  }
  normalizeFreightState(s);
  if (tonsToRemove > 0) {
    s.freight = Math.max(0, s.freight - tonsToRemove);
    normalizeFreightState(s);
  }
}

/**
 * @param {import('../TraderApp.js').TraderApp} app
 * @param {string} continueLabel
 */
export async function runOtherActivitiesLoop(app, continueLabel) {
  while (true) {
    const choice = await app._choose(
      game.i18n.localize('TWODSIX.Trader.Prompts.OtherActivitiesOrContinue'),
      [
        { value: 'other', label: game.i18n.localize('TWODSIX.Trader.Actions.OtherActivities') },
        { value: 'continue', label: continueLabel },
      ],
    );
    if (choice !== 'other') {
      break;
    }
    await otherActivities(app);
  }
}

/**
 * @param {import('../TraderApp.js').TraderApp} app
 */
export async function otherActivities(app) {
  if (app.isReplayingDecisions?.()) {
    return;
  }
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

  applyFreightDelta(s, result.freightDelta);

  if (result.bulkNormalDelta > 0) {
    s.cargo.push({
      cargoId: BULK_LS_CARGO_ID.NORMAL,
      name: game.i18n.localize('TWODSIX.Trader.BulkLSNormal'),
      tons: result.bulkNormalDelta,
      purchasePricePerTon: 0,
      purchaseWorld: s.currentWorldName,
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
      purchaseWorld: s.currentWorldName,
    });
  } else if (result.bulkLuxuryDelta < 0) {
    removeBulkLifeSupport(s, game.i18n.localize('TWODSIX.Trader.BulkLSLuxury'), -result.bulkLuxuryDelta);
  }

  s.passengers.high = Math.max(0, s.passengers.high + result.paxDelta.high);
  s.passengers.middle = Math.max(0, s.passengers.middle + result.paxDelta.middle);
  s.passengers.steerage = Math.max(0, (s.passengers.steerage || 0) + (result.paxDelta.steerage || 0));
  s.passengers.low = Math.max(0, s.passengers.low + result.paxDelta.low);

  if (result.fuelDelta) {
    const refined = result.fuelDelta.refined || 0;
    const unrefined = result.fuelDelta.unrefined || 0;
    if (refined !== 0 || unrefined !== 0) {
      const currentFuel = s.ship.currentFuel || 0;
      const fuelIsRefined = s.ship.fuelIsRefined ?? true;
      const newAmount = Math.max(0, currentFuel + refined + unrefined);

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
    await accruePortFees(app);
  }

  await app.logEvent(result.summary);
}
