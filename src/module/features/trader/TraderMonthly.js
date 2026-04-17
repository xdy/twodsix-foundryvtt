/**
 * TraderMonthly.js
 * Logic for monthly cost accrual and journey end checks.
 */

import { forceSellAllSellableCargo, hasSellableCargoAtWorld } from './atWorld/atWorldTrade.js';
import {
  BANKRUPTCY_LIMIT,
  BULK_LS_CAPACITY,
  BULK_LS_CARGO_ID,
  MAINTENANCE_DAMAGE_THRESHOLD,
  MAINTENANCE_RATE,
  MORTGAGE_TOTAL_MONTHS
} from './TraderConstants.js';
import { getTraderRuleset } from './TraderRulesetRegistry.js';
import {
  addExpense,
  addRevenue,
  getCostPeriodNumber,
  getCurrentWorld,
  getTotalCrewSalary,
  normalizeFreightState,
  OUTCOME,
  PHASE
} from './TraderState.js';
import { parseCurrencyToMcr } from './TraderUtils.js';

export async function accrueMonthlyCosts(app) {
  const s = app.state;
  const currentMonth = getCostPeriodNumber(s);

  if (currentMonth <= s.lastPaidMonth) {
    return;
  }

  // Pay for each cost period that has passed
  while (s.lastPaidMonth < currentMonth) {
    s.lastPaidMonth++;

    const crewCost = getTotalCrewSalary(s.crew);
    const ruleset = getTraderRuleset(s.ruleset);
    const lifeSupportCost = ruleset.calculateLifeSupportCost(s);
    const shipCostMcr = Number(s.ship.shipCostMcr ?? parseCurrencyToMcr(s.ship.shipCost, true)) || 0;
    const maintenanceCost = Math.ceil(shipCostMcr * 1000000 * MAINTENANCE_RATE / 12);
    const mortgageCost = Math.ceil(shipCostMcr * 1000000 / ruleset.getMortgageDivisor());

    // Life Support supplies logic
    const peopleCapacity = s.ship.staterooms * 2 + s.ship.lowBerths;
    // Tonnage needed can be fractional: 1 ton per 20 people per month
    const tonsNeeded = peopleCapacity / BULK_LS_CAPACITY;

    const normalName = game.i18n.localize('TWODSIX.Trader.BulkLSNormal');
    const luxuryName = game.i18n.localize('TWODSIX.Trader.BulkLSLuxury');
    const normalSupplies = s.cargo.find(c =>
      (c.cargoId === BULK_LS_CARGO_ID.NORMAL || c.name === normalName) && c.tons >= tonsNeeded
    );
    const luxurySupplies = s.cargo.find(c =>
      (c.cargoId === BULK_LS_CARGO_ID.LUXURY || c.name === luxuryName) && c.tons >= tonsNeeded
    );

    const lifeSupportResolution = await ruleset.resolveLifeSupportPayment(app, s, {
      lifeSupportCost,
      tonsNeeded,
      normalSupplies,
      luxurySupplies,
    });
    let actualLifeSupportCost = Number(lifeSupportResolution?.actualLifeSupportCost);
    if (!Number.isFinite(actualLifeSupportCost) || actualLifeSupportCost < 0) {
      actualLifeSupportCost = lifeSupportCost;
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

        addExpense(s, repairCost);
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

    addExpense(s, totalCost);
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

export async function checkGameEnd(app) {
  const s = app.state;
  const ruleset = getTraderRuleset(s.ruleset);

  // Paid off: 480 mortgage payments made
  if (s.monthsPaid >= MORTGAGE_TOTAL_MONTHS) {
    s.gameOver = true;
    s.outcome = OUTCOME.PAID_OFF;
    return;
  }

  const insolvent = s.credits < -BANKRUPTCY_LIMIT;
  // Emergency safety nets should run only during insolvency handling.
  if (insolvent) {
    const insolvencyPolicy = ruleset.getInsolvencyPolicy(s);
    const canTakeEmergencyActions = !insolvencyPolicy.requireDocked || s.phase === PHASE.AT_WORLD;

    // Strict physical policy: freight can only be settled while docked.
    // Never pay freight during IN_TRANSIT / ARRIVING.
    if (insolvencyPolicy.forceFreightPayout && canTakeEmergencyActions) {
      normalizeFreightState(s);
      if (s.freight > 0) {
        const freightLots = Array.isArray(s.freightLots) ? s.freightLots : [];
        const freightRevenue = freightLots.length > 0
          ? freightLots.reduce((sum, lot) => sum + (lot.tons * (lot.rate || ruleset.getFreightRate())), 0)
          : s.freight * ruleset.getFreightRate();
        addRevenue(s, freightRevenue);
        s.freight = 0;
        s.freightLots = [];
        await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.ForcedFreightPayout', {
          revenue: freightRevenue.toLocaleString(),
          credits: s.credits.toLocaleString(),
        }));
      }
    }

    // Liquidate only while docked at a world; never in transit/arriving.
    if (insolvencyPolicy.forceCargoLiquidation && canTakeEmergencyActions && s.credits < -BANKRUPTCY_LIMIT && s.cargo.length > 0) {
      const world = getCurrentWorld(s);
      if (world) {
        await forceSellAllSellableCargo(app, world);
      }
    }
  }

  // Bankrupt only when docked: defer repossession checks until next port.
  // At port, game ends once still insolvent and nothing sellable remains.
  if (s.phase === PHASE.AT_WORLD && s.credits < -BANKRUPTCY_LIMIT) {
    const world = getCurrentWorld(s);
    const hasSellableCargo = world ? hasSellableCargoAtWorld(app, world) : false;
    if (!hasSellableCargo) {
      s.gameOver = true;
      s.outcome = OUTCOME.BANKRUPT;
      return;
    }
  }

  // Runway warning only after bankruptcy checks and only once per paid month.
  if (s.monthsPaid > 0 && s.lastRunwayWarningMonth !== s.monthsPaid) {
    const crewCost = getTotalCrewSalary(s.crew);
    const lifeSupportCost = ruleset.calculateLifeSupportCost(s);
    const shipCostMcr = Number(s.ship.shipCostMcr ?? parseCurrencyToMcr(s.ship.shipCost, true)) || 0;
    const maintenanceCost = Math.ceil(shipCostMcr * 1000000 * MAINTENANCE_RATE / 12);
    const mortgageCost = Math.ceil(shipCostMcr * 1000000 / ruleset.getMortgageDivisor());
    const nextMonthRecurring = crewCost + lifeSupportCost + maintenanceCost + mortgageCost;
    const projectedNoIncomeCredits = s.credits - nextMonthRecurring;
    if (projectedNoIncomeCredits < -BANKRUPTCY_LIMIT) {
      const requiredProfit = Math.max(0, (-BANKRUPTCY_LIMIT) - projectedNoIncomeCredits);
      await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.BankruptcyRunwayWarning', {
        shortfall: requiredProfit.toLocaleString(),
        projected: projectedNoIncomeCredits.toLocaleString(),
        threshold: BANKRUPTCY_LIMIT.toLocaleString(),
      }));
      s.lastRunwayWarningMonth = s.monthsPaid;
    }
  }
}
