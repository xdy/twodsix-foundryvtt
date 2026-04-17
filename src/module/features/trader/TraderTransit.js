/**
 * TraderTransit.js
 * Logic for departure, in-transit, and arriving phases.
 */

import {
  accruePortFees,
  getDestinationCoordinateAliases,
  getReachableDestinations,
  refuel,
  runOtherActivitiesLoop,
} from './atWorldBridge.js';
import { ensureSubsectorNeighborsLoaded, getReachableWorlds } from './SubsectorLoader.js';
import { HOURS_PER_DAY, TRANSIT_BASE_HOURS } from './TraderConstants.js';
import { getTraderRuleset } from './TraderRulesetRegistry.js';
import {
  addExpense,
  addRevenue,
  advanceDate,
  getAbsoluteDay,
  getCurrentWorld,
  getUsedCargoSpace,
  normalizeFreightState,
  normalizePassengers,
  persistWorldHistory,
  PHASE,
} from './TraderState.js';
import { canRefuelAtWorld, getWorldCoordinate, isLocalMode } from './TraderUtils.js';
import {
  getOrCreateCacheJournal,
  updateCachedWorldMaxJump,
  updateCachedWorldVisitedStatus
} from './TravellerMapCache.js';

export async function depart(app) {
  const s = app.state;
  const previousDestinationAliases = new Set([s.destinationHex, s.destinationGlobalHex].filter(Boolean));

  // Check fuel
  const jumpFuel = Math.ceil(s.ship.tonnage * s.ship.jumpRating * 0.1);
  if (s.ship.currentFuel < jumpFuel) {
    const world = getCurrentWorld(s);
    const choice = await app._choose(
      game.i18n.format('TWODSIX.Trader.Log.InsufficientFuel', { need: jumpFuel, have: s.ship.currentFuel }),
      [
        { value: 'refuel', label: game.i18n.localize('TWODSIX.Trader.Actions.Refuel') },
        { value: 'cancel', label: game.i18n.localize('Cancel') },
      ]
    );
    if (choice === 'refuel') {
      await refuel(app, world);
      if (s.ship.currentFuel < jumpFuel) {
        return;
      }
    } else {
      return;
    }
  }

  const { reachable, options: destOptions } = await getReachableDestinations(app);
  if (!reachable.length) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.NoWorldsInRangeConsider'));
    return;
  }

  let destHex;

  // If destination already chosen, offer to confirm or change
  if (s.destinationHex && reachable.find(w => getDestinationCoordinateAliases(w).includes(s.destinationHex))) {
    const destinationHex = s.destinationHex;
    const confirmChoice = await app._choose(
      game.i18n.format('TWODSIX.Trader.Prompts.ConfirmDestination', { destination: s.destinationName }),
      [
        {
          value: 'confirm',
          label: game.i18n.format('TWODSIX.Trader.Log.Departure', { destination: s.destinationName }),
          aliases: [destinationHex],
          matchCoordinateLike: true,
        },
        { value: 'change', label: game.i18n.localize('TWODSIX.Trader.Actions.ChooseDifferent') },
        ...destOptions.map(option => ({ ...option, replayOnly: true })),
      ]
    );
    if (confirmChoice === 'confirm') {
      destHex = destinationHex;
    } else if (confirmChoice === 'change') {
      destHex = await app._choose(game.i18n.localize('TWODSIX.Trader.Prompts.Destination'), destOptions);
    } else {
      destHex = confirmChoice;
    }
  } else {
    destHex = await app._choose(game.i18n.localize('TWODSIX.Trader.Prompts.Destination'), destOptions);
  }

  const dest = reachable.find(w => getDestinationCoordinateAliases(w).includes(destHex));
  if (!dest) {
    return;
  }
  const canonicalDestination = getWorldCoordinate(dest) || destHex;
  const destinationChanged = !previousDestinationAliases.has(canonicalDestination);
  if (destinationChanged) {
    await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.DestinationSelected', { world: dest.name }));
  }

  // Check if destination has no refueling options - warn player
  const destCanRefuel = canRefuelAtWorld(dest);
  const fuelAfterJump = s.ship.currentFuel - jumpFuel;

  if (!destCanRefuel && fuelAfterJump < jumpFuel) {
    const confirmOptions = [
      { value: 'confirm', label: game.i18n.localize('Confirm') },
      { value: 'cancel', label: game.i18n.localize('Cancel') },
    ];
    const dw = dest?.system;
    const confirm = await app._choose(
      game.i18n.format('TWODSIX.Trader.Log.WarningNoFuelAtDest', {
        world: dest.name,
        starport: dw?.starport || 'X',
        remaining: fuelAfterJump,
        need: jumpFuel
      }),
      confirmOptions
    );
    if (confirm === 'cancel') {
      return;
    }
  }

  s.destinationHex = canonicalDestination;
  s.destinationGlobalHex = dest.globalHex || dest.hex || '';
  s.destinationName = dest.name;
  await executeDeparture(app);
}

function getPassengerRevenue(passengers, rates) {
  return Object.entries(passengers).reduce((total, [key, count]) => {
    return total + (count * (rates[key] || 0));
  }, 0);
}

/**
 * Execute departure: set phase, advance time, log departure info.
 */
export async function executeDeparture(app) {
  const s = app.state;

  // Advance time for loading/prep (1D6 hours)
  const prepTime = await app._roll('1d6');
  advanceDate(s.gameDate, prepTime);
  await accruePortFees(app);

  // Persist long-lived per-world fields before leaving (e.g. search-attempt history,
  // so DM-1/attempt penalties survive returning to the same world same month).
  persistWorldHistory(s);

  s.phase = PHASE.IN_TRANSIT;

  // Tally expected revenue for log
  const ruleset = getTraderRuleset(s.ruleset);
  normalizeFreightState(s);
  const passengerRevenue = ruleset.getPassengerRevenue();
  const passengers = normalizePassengers(s.passengers);
  const paxRev = getPassengerRevenue(passengers, passengerRevenue);
  const freightLots = Array.isArray(s.freightLots) ? s.freightLots : [];
  const freightRev = freightLots.length > 0
    ? freightLots.reduce((sum, lot) => sum + (lot.tons * (lot.rate || ruleset.getFreightRate())), 0)
    : s.freight * ruleset.getFreightRate();
  const mailRev = s.hasMail
    ? (Math.max(1, Number(s.mailContainers) || 1) * (Number(s.mailPaymentPerContainer) || ruleset.getMailPayment()))
    : 0;

  await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.DepartedFor', {
    origin: s.currentWorldName,
    destination: s.destinationName,
    high: passengers.high,
    mid: passengers.middle,
    steerage: passengers.steerage,
    low: passengers.low,
    freight: s.freight,
    mail: s.hasMail ? 'Carrying mail. ' : '',
    revenue: (paxRev + freightRev + mailRev).toLocaleString()
  }));
}

// ─── IN_TRANSIT Phase ────────────────────────────────────────

export async function inTransitPhase(app) {
  const s = app.state;

  await runOtherActivitiesLoop(app, game.i18n.localize('TWODSIX.Trader.Actions.ProceedWithJump'));

  // Consume fuel
  const jumpFuel = Math.ceil(s.ship.tonnage * s.ship.jumpRating * 0.1);
  s.ship.currentFuel = Math.max(0, s.ship.currentFuel - jumpFuel);

  // Roll jump duration: 148 + 6D6 hours
  let jumpHours = 148 + await app._roll('6d6');
  advanceDate(s.gameDate, jumpHours);

  const jumpDays = Math.round(jumpHours / HOURS_PER_DAY * 10) / 10;
  await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.InJumpSpace", {
    days: jumpDays,
    fuel: jumpFuel,
    remaining: s.ship.currentFuel
  }));

  // Unrefined fuel risk
  if (!s.ship.fuelIsRefined) {
    const fuelRoll = await app._roll('2D6');
    if (fuelRoll <= 4) {
      await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.RoughJump'));
    }
  }

  s.phase = PHASE.ARRIVING;
}

// ─── ARRIVING Phase ──────────────────────────────────────────

export async function arrivingPhase(app) {
  const s = app.state;

  await runOtherActivitiesLoop(app, game.i18n.localize('TWODSIX.Trader.Actions.ProcessArrival'));

  const { getWorldCache } = await import('./TraderState.js');

  // Move to destination
  const destinationAliases = new Set([s.destinationHex, s.destinationGlobalHex].filter(Boolean));
  const arrivedWorld = s.worlds.find(w => {
    const aliases = getDestinationCoordinateAliases(w);
    return aliases.some(alias => destinationAliases.has(alias));
  });

  if (!arrivedWorld) {
    ui.notifications.error(`Twodsix | Trader: Could not find destination world: ${s.destinationName} (${s.destinationHex})`);
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.DestinationNotFound", {
      name: s.destinationName,
      hex: s.destinationHex
    }));
    s.gameOver = true;
    return;
  }

  s.currentWorldHex = getWorldCoordinate(arrivedWorld) || s.destinationGlobalHex || s.destinationHex;
  s.currentWorldName = s.destinationName;
  s.destinationHex = '';
  s.destinationGlobalHex = '';
  s.destinationName = '';

  const world = getCurrentWorld(s);
  const worldInfo = world ? `${world.system?.uwp} [${world.system?.tradeCodes}]` : '';

  // In-system transit time (~1-3 days)
  const transitHours = TRANSIT_BASE_HOURS + await app._roll('8d6');
  advanceDate(s.gameDate, transitHours);

  await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.ArrivalWithTransit", {
    world: s.currentWorldName,
    info: worldInfo,
    days: Math.round(transitHours / HOURS_PER_DAY)
  }));

  const ruleset = getTraderRuleset(s.ruleset);
  if (ruleset.shouldCheckSmuggling(s.cargo, world)) {
    await ruleset.doSmugglingCheck(app, world);
  }

  // Mark world as visited in cache and on actor
  if (typeof arrivedWorld.getFlag === 'function') {
    const subKey = arrivedWorld.getFlag('twodsix', 'subsectorKey');
    if (subKey && s.cacheJournalName && !isLocalMode(s)) {
      const journal = await getOrCreateCacheJournal(s.cacheJournalName);
      const wasVisited = arrivedWorld.getFlag('twodsix', 'isVisited');
      if (!wasVisited) {
        await updateCachedWorldVisitedStatus(journal, subKey, s.currentWorldHex, true);
        await arrivedWorld.setFlag('twodsix', 'isVisited', true);
        await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.FirstTimeVisit", { world: s.currentWorldName }));
      }

      // Ensure neighbors of the arrived world's subsector are loaded
      const coordParts = arrivedWorld.system.coordinates?.split(' ') || [];
      const sectorName = coordParts.slice(0, -1).join(' ') || '';
      const localHex = coordParts.at(-1) || arrivedWorld.getFlag('twodsix', 'locationCoordinate');
      if (sectorName && localHex) {
        try {
          const newWorlds = await ensureSubsectorNeighborsLoaded(s, sectorName, localHex, s.milieu || 'M1105', journal);
          if (newWorlds.length > 0) {
            for (const actor of newWorlds) {
              if (!s.worlds.some(w => w.id === actor.id)) {
                s.worlds.push(actor);
              }
            }
            await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.DiscoveryNeighbors", { count: newWorlds.length }));
          }
        } catch (e) {
          console.error('Failed to ensure subsector neighbors loaded:', e);
        }
      }

      // Check max jump visited record
      const prevMaxJump = arrivedWorld.getFlag('twodsix', 'maxJumpVisited') || 0;
      if (s.ship.jumpRating > prevMaxJump) {
        await updateCachedWorldMaxJump(journal, subKey, s.currentWorldHex, s.ship.jumpRating);
        await arrivedWorld.setFlag('twodsix', 'maxJumpVisited', s.ship.jumpRating);

        // Reachable worlds discovery
        if (sectorName && localHex) {
          try {
            const beforeCount = s.worlds.length;
            await getReachableWorlds(s, journal);
            const afterCount = s.worlds.length;

            if (afterCount > beforeCount) {
              const newlyDiscovered = s.worlds.slice(beforeCount);
              const newNames = newlyDiscovered.filter(a => a.name !== s.currentWorldName).map(a => a.name).join(', ');
              if (newNames) {
                await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.DiscoveryJumpRange", {
                  jump: s.ship.jumpRating,
                  names: newNames
                }));
              }
            }
          } catch (e) {
            console.error('Failed to auto-discover jump worlds:', e);
          }
        }
      }
    }
  } else {
    // This case should be handled by the arrivedWorld check above, but might as well keep it.
    console.warn('Twodsix | Trader: arrivedWorld found but is not an Actor document', arrivedWorld);
  }
  // Deliver passengers
  const passengerRevenue = ruleset.getPassengerRevenue();
  const passengers = normalizePassengers(s.passengers);
  const paxRev = getPassengerRevenue(passengers, passengerRevenue);
  if (paxRev > 0) {
    addRevenue(s, paxRev);
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.PaxRevenue", { revenue: paxRev.toLocaleString() }));
  }

  // Deliver freight
  normalizeFreightState(s);
  if (s.freight > 0) {
    const freightLots = Array.isArray(s.freightLots) ? s.freightLots : [];
    const freightRev = freightLots.length > 0
      ? freightLots.reduce((sum, lot) => sum + (lot.tons * (lot.rate || ruleset.getFreightRate())), 0)
      : s.freight * ruleset.getFreightRate();
    addRevenue(s, freightRev);
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.FreightRevenue", {
      tons: s.freight,
      revenue: freightRev.toLocaleString()
    }));
  }

  // Deliver mail
  if (s.hasMail) {
    const mailPayment = Math.max(1, Number(s.mailContainers) || 1) * (Number(s.mailPaymentPerContainer) || ruleset.getMailPayment());
    addRevenue(s, mailPayment);
    await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.MailRevenue", { revenue: mailPayment.toLocaleString() }));
  }

  // Clear trip bookings
  s.passengers = { high: 0, middle: 0, steerage: 0, low: 0 };
  s.freight = 0;
  s.freightLots = [];
  s.hasMail = false;
  s.mailContainers = 0;
  s.mailPaymentPerContainer = 0;

  // Arrival port fee (ruleset-controlled)
  const arrivalPortFee = ruleset.getArrivalPortFee(world);
  if (arrivalPortFee > 0) {
    addExpense(s, arrivalPortFee);
  }

  await app.logEvent(game.i18n.format("TWODSIX.Trader.Log.CreditsCargoStatus", {
    credits: s.credits.toLocaleString(),
    used: getUsedCargoSpace(s),
    capacity: s.ship.cargoCapacity
  }));

  // Check charter expiry on arrival
  if (s.chartered && s.charterExpiryDay && getAbsoluteDay(s.gameDate, s.milieu) >= s.charterExpiryDay) {
    s.chartered = false;
    s.charterCargo = 0;
    s.charterStaterooms = 0;
    s.charterLowBerths = 0;
    s.charterExpiryDay = null;
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.CharterEnded'));
  }

  if (ruleset.shouldResetLocalBrokerOnArrival()) {
    // Reset hired local broker — brokers are tied to a specific world, not the ship.
    // (Without this, a broker hired on world A would silently apply at world B.)
    s.useLocalBroker = false;
    s.localBrokerSkill = 0;
    s.localBrokerIllegal = false;
  }

  // Clear the visit cache so all market rolls are fresh for this new world.
  // (worldHistory is preserved separately and re-applied by getWorldCache.)
  s.worldVisitCache = {};
  getWorldCache(s); // Initialize tracker for the new world
  s.phase = PHASE.AT_WORLD;
}
