/**
 * TraderLogic.js
 * Trading journey loop and phase logic.
 * Implements AT_WORLD, IN_TRANSIT, and ARRIVING phases with CE SRD mechanics.
 */

import { RESTART } from '../DecisionApp.js';
import { atWorldPhase } from './TraderAtWorld.js';
import { accrueMonthlyCosts, checkGameEnd } from './TraderMonthly.js';
import { getCurrentWorld, OUTCOME, PHASE, } from './TraderState.js';
import { arrivingPhase, inTransitPhase } from './TraderTransit.js';
import { traderDebug } from './TraderUtils.js';

/**
 * Action identifiers for the AT_WORLD phase.
 * @enum {string}
 */
export const ACTION = {
  CHOOSE_DESTINATION: 'chooseDestination',
  PASSENGERS: 'passengers',
  FREIGHT: 'freight',
  MAIL: 'mail',
  BUY: 'buy',
  SELL: 'sell',
  BUY_BULK_LS: 'buyBulkLifeSupport',
  SELL_BULK_LS: 'sellBulkLifeSupport',
  REFUEL: 'refuel',
  HIRE_BROKER: 'hireBroker',
  HIRE_ILLEGAL_BROKER: 'hireIllegalBroker',
  FIND_SUPPLIER: 'findSupplier',
  FIND_BUYER: 'findBuyer',
  PRIVATE_MESSAGES: 'privateMessages',
  TOGGLE_ILLEGAL: 'toggleIllegal',
  CHARTER: 'charter',
  OTHER_ACTIVITIES: 'otherActivities',
  DEPART: 'depart',
};

/**
 * Main loop. Called from TraderApp.run().
 * @param {import('./TraderApp.js').TraderApp} app - The application instance
 */
export async function runTradeLoop(app) {
  const s = app.state;
  traderDebug('TraderLogic', `runTradeLoop starting`, { phase: s.phase, world: s.currentWorldName, worlds: s.worlds?.length });

  try {
    // Log initial state if this is a fresh trading journey
    if (s.phase === PHASE.AT_WORLD && (!app.rows || !app.rows.length)) {
      const credits = s.credits ?? 0;
      const worldName = s.currentWorldName || 'Unknown';
      await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.Docked", {
        world: worldName,
        credits: credits.toLocaleString()
      }));
    }

    while (!s.gameOver) {
      switch (s.phase) {
        case PHASE.AT_WORLD: {
          const world = getCurrentWorld(s);
          if (!world) {
            console.error('Twodsix | Trader: atWorldPhase failed to find current world!', s.currentWorldHex);
            await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.WorldNotFound", { hex: s.currentWorldHex }));
            s.gameOver = true;
            break;
          }
          await atWorldPhase(app, world, ACTION);
          break;
        }
        case PHASE.IN_TRANSIT:
          await inTransitPhase(app);
          break;
        case PHASE.ARRIVING:
          await arrivingPhase(app);
          break;
      }
      await accrueMonthlyCosts(app);
      await checkGameEnd(app);
      app.scheduleSave();
    }
  } catch (err) {
    if (err === RESTART) {
      throw err;
    }
    console.error('Twodsix | Trader: runTradeLoop failed:', err);
    ui.notifications.error(game.i18n.format('TWODSIX.Trader.Messages.TradeLoopError', { message: err.message }));
    app.rows.push({
      label: game.i18n.localize('TWODSIX.Trader.Log.TradeLoopErrorLabel'),
      result: game.i18n.format('TWODSIX.Trader.Log.TradeLoopErrorDetail', { message: err.message }),
      active: false,
      options: [],
      maxValue: null,
    });
    app.render();
    throw err;
  }

  // Game over man!
  if (s.outcome === OUTCOME.PAID_OFF) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.MortgagePaid'));
  } else {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.Repossessed'));
  }
}
