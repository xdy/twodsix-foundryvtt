/**
 * TraderMonthly.js
 * Logic for monthly cost accrual and journey end checks.
 */

import {
  BANKRUPTCY_LIMIT,
  BULK_LS_CAPACITY,
  LIFE_SUPPORT,
  MAINTENANCE_DAMAGE_THRESHOLD,
  MAINTENANCE_RATE,
  MORTGAGE_DIVISOR,
  MORTGAGE_TOTAL_MONTHS
} from './TraderConstants.js';
import { getMonthNumber, getTotalCrewSalary, OUTCOME } from './TraderState.js';
import { parseCurrencyToMcr } from './TraderUtils.js';

export async function accrueMonthlyCosts(app) {
  const s = app.state;
  const currentMonth = getMonthNumber(s.gameDate, s.milieu);

  if (currentMonth <= s.lastPaidMonth) {
    return;
  }

  // Pay for each month that's passed
  while (s.lastPaidMonth < currentMonth) {
    s.lastPaidMonth++;

    const crewCost = getTotalCrewSalary(s.crew);
    const lifeSupportCost = s.ship.staterooms * LIFE_SUPPORT.stateroom + s.ship.lowBerths * LIFE_SUPPORT.lowBerth;
    const shipCostMcr = Number(s.ship.shipCostMcr ?? parseCurrencyToMcr(s.ship.shipCost, true)) || 0;
    const maintenanceCost = Math.ceil(shipCostMcr * 1000000 * MAINTENANCE_RATE / 12);
    const mortgageCost = Math.ceil(shipCostMcr * 1000000 / MORTGAGE_DIVISOR);

    // Life Support supplies logic
    let actualLifeSupportCost = lifeSupportCost;
    const peopleCapacity = s.ship.staterooms * 2 + s.ship.lowBerths;
    // Tonnage needed can be fractional: 1 ton per 20 people per month
    const tonsNeeded = peopleCapacity / BULK_LS_CAPACITY;

    const normalSupplies = s.cargo.find(c => c.name === game.i18n.localize('TWODSIX.Trader.BulkLSNormal') && c.tons >= tonsNeeded);
    const luxurySupplies = s.cargo.find(c => c.name === game.i18n.localize('TWODSIX.Trader.BulkLSLuxury') && c.tons >= tonsNeeded);

    if (tonsNeeded > 0 && (normalSupplies || luxurySupplies)) {
      const lsOptions = [
        { value: 'credits', label: `Pay credits: Cr${lifeSupportCost.toLocaleString()}` },
      ];
      if (normalSupplies) {
        lsOptions.push({ value: 'normal', label: `Use ${tonsNeeded}t of normal supplies (${normalSupplies.tons}t available)` });
      }
      if (luxurySupplies) {
        lsOptions.push({ value: 'luxury', label: `Use ${tonsNeeded}t of luxury supplies (${luxurySupplies.tons}t available)` });
      }

      const lsChoice = await app._choose(
        game.i18n.localize('TWODSIX.Trader.Prompts.LifeSupportOptions'),
        lsOptions
      );

      if (lsChoice === 'normal' || lsChoice === 'luxury') {
        const supplies = lsChoice === 'normal' ? normalSupplies : luxurySupplies;
        supplies.tons = Math.max(0, supplies.tons - tonsNeeded);
        if (supplies.tons < 0.001) {
          s.cargo.splice(s.cargo.indexOf(supplies), 1);
        }
        actualLifeSupportCost = 0;
        await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.UsedBulkSupplies", {
          tons: tonsNeeded,
          type: lsChoice
        }));
      }
    }

    // Offer to skip maintenance
    const skipChoice = await app._choose(
      game.i18n.format('TWODSIX.Trader.Prompts.MaintenanceDue', { cost: maintenanceCost.toLocaleString() }),
      [
        { value: 'pay', label: game.i18n.format('TWODSIX.Trader.Actions.PayMaintenance', { cost: maintenanceCost.toLocaleString() }) },
        { value: 'skip', label: game.i18n.localize('TWODSIX.Trader.Actions.SkipMaintenance') },
      ]
    );

    let actualMaintenanceCost = maintenanceCost;
    if (skipChoice === 'skip') {
      actualMaintenanceCost = 0;
      s.maintenanceMonthsSkipped = (s.maintenanceMonthsSkipped || 0) + 1;

      // Damage check: 2D6 + monthsSkipped, on MAINTENANCE_DAMAGE_THRESHOLD+ ship takes damage
      const damageRoll = await app._roll('2D6');
      const damageTotal = damageRoll + s.maintenanceMonthsSkipped;

      if (damageTotal >= MAINTENANCE_DAMAGE_THRESHOLD) {
        // Roll 1D6 for hits: 1-3 = 1 hit, 4-5 = 2 hits, 6 = 3 hits
        const hitRoll = await app._roll('1D6');
        const hits = hitRoll <= 3 ? 1 : hitRoll <= 5 ? 2 : 3;
        const repairCost = hits * 10000;

        s.credits -= repairCost;
        s.totalExpenses += repairCost;
        await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.MaintenanceSkippedDamage", {
          hits: hits,
          roll: damageRoll,
          skipped: s.maintenanceMonthsSkipped,
          total: damageTotal,
          repairCost: repairCost.toLocaleString(),
          credits: s.credits.toLocaleString()
        }));
      } else {
        await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.MaintenanceSkippedNoDamage", {
          roll: damageRoll,
          skipped: s.maintenanceMonthsSkipped,
          total: damageTotal,
          threshold: MAINTENANCE_DAMAGE_THRESHOLD
        }));
      }
    } else {
      s.maintenanceMonthsSkipped = 0;
    }

    const totalCost = crewCost + actualLifeSupportCost + actualMaintenanceCost + mortgageCost;

    s.credits -= totalCost;
    s.totalExpenses += totalCost;
    s.mortgageRemaining = Math.max(0, s.mortgageRemaining - mortgageCost);
    s.monthsPaid++;

    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.MonthlyCostsSummary", {
      month: s.monthsPaid,
      crew: crewCost.toLocaleString(),
      ls: actualLifeSupportCost.toLocaleString(),
      lsExtra: (actualLifeSupportCost === 0 && (lifeSupportCost > 0)) ? game.i18n.localize('TWODSIX.Trader.Log.MonthlyCostsLSExtra') : '',
      maint: actualMaintenanceCost.toLocaleString(),
      maintExtra: (skipChoice === 'skip') ? game.i18n.localize('TWODSIX.Trader.Log.MonthlyCostsMaintExtra') : '',
      mortgage: mortgageCost.toLocaleString(),
      total: totalCost.toLocaleString(),
      credits: s.credits.toLocaleString()
    }));
  }
}

export function checkGameEnd(app) {
  const s = app.state;

  // Paid off: 480 mortgage payments made
  if (s.monthsPaid >= MORTGAGE_TOTAL_MONTHS) {
    s.gameOver = true;
    s.outcome = OUTCOME.PAID_OFF;
    return;
  }

  // Bankrupt: negative credits and no cargo to sell
  if (s.credits < - BANKRUPTCY_LIMIT && s.cargo.length === 0) {
    s.gameOver = true;
    s.outcome = OUTCOME.BANKRUPT;
  }
}
