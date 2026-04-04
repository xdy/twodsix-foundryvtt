/**
 * TraderTransit.js
 * Logic for departure, in-transit, and arriving phases.
 */

import { createWorldActors, ensureSubsectorNeighborsLoaded } from './SubsectorLoader.js';
import {
  FREIGHT_RATE,
  HOURS_PER_DAY,
  MAIL_PAYMENT,
  PASSENGER_REVENUE,
  PORT_FEE_BASE,
  TRANSIT_BASE_HOURS
} from './TraderConstants.js';
import { advanceDate, getAbsoluteDay, getCurrentWorld, getUsedCargoSpace, PHASE, } from './TraderState.js';
import { canRefuelAtWorld, getWorldCoordinate, } from './TraderUtils.js';
import { fetchJumpWorlds } from './TravellerMapAPI.js';
import {
  getOrCreateCacheJournal,
  updateCachedWorldMaxJump,
  updateCachedWorldVisitedStatus
} from './TravellerMapCache.js';

export async function depart(app) {
  const s = app.state;

  // Check fuel
  const jumpFuel = Math.ceil(s.ship.tonnage * s.ship.jumpRating * 0.1);
  if (s.ship.currentFuel < jumpFuel) {
    const { refuel } = await import('./TraderAtWorld.js');
    const world = getCurrentWorld(s);
    const choice = await app._choose(
      `Insufficient fuel! Need ${jumpFuel}t for jump, have ${s.ship.currentFuel}t.`,
      [
        { value: 'refuel', label: 'Refuel now before departing' },
        { value: 'cancel', label: 'Cancel departure' },
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

  // Get reachable worlds
  const { getReachableDestinations } = await import('./TraderAtWorld.js');
  const { reachable, options: destOptions } = await getReachableDestinations(app);
  if (!reachable.length) {
    await app.logEvent('No worlds within jump range! Consider increasing jump rating or refueling.');
    return;
  }

  let destHex;

  // If destination already chosen, offer to confirm or change
  if (s.destinationHex && reachable.find(w => getWorldCoordinate(w) === s.destinationHex)) {
    const confirmChoice = await app._choose(
      game.i18n.format('TWODSIX.Trader.Prompts.ConfirmDestination', { destination: s.destinationName }),
      [
        { value: 'confirm', label: `Depart for ${s.destinationName}` },
        { value: 'change', label: game.i18n.localize('TWODSIX.Trader.Actions.ChooseDifferent') },
      ]
    );
    if (confirmChoice === 'confirm') {
      destHex = s.destinationHex;
    } else {
      destHex = await app._choose(game.i18n.localize('TWODSIX.Trader.Prompts.Destination'), destOptions);
    }
  } else {
    destHex = await app._choose(game.i18n.localize('TWODSIX.Trader.Prompts.Destination'), destOptions);
  }

  const dest = reachable.find(w => getWorldCoordinate(w) === destHex);
  if (!dest) {
    return;
  }

  // Check if destination has no refueling options - warn player
  const destCanRefuel = canRefuelAtWorld(dest);
  const fuelAfterJump = s.ship.currentFuel - jumpFuel;

  if (!destCanRefuel && fuelAfterJump < jumpFuel) {
    const confirmOptions = [
      { value: 'confirm', label: 'Proceed anyway (DANGER: may get stranded!)' },
      { value: 'cancel', label: 'Cancel departure and refuel first' },
    ];
    const dw = dest?.system;
    const confirm = await app._choose(
      `WARNING: ${dest.name} has no refueling facilities (Class ${dw?.starport || 'X'} starport, no gas giants). ` +
      `After this jump you'll have ${fuelAfterJump}t fuel remaining, but need ${jumpFuel}t for another jump. ` +
      `You may get stranded!`,
      confirmOptions
    );
    if (confirm === 'cancel') {
      return;
    }
  }

  s.destinationHex = destHex;
  s.destinationGlobalHex = dest.globalHex || dest.hex;
  s.destinationName = dest.name;
  await executeDeparture(app);
}

/**
 * Execute departure: set phase, advance time, log departure info.
 */
export async function executeDeparture(app) {
  const s = app.state;
  const { accruePortFees } = await import('./TraderAtWorld.js');

  // Advance time for loading/prep (1D6 hours)
  const prepTime = await app._roll('1d6');
  advanceDate(s.gameDate, prepTime);
  await accruePortFees(app);

  s.phase = PHASE.IN_TRANSIT;

  // Tally expected revenue for log
  const paxRev = s.passengers.high * PASSENGER_REVENUE.high
    + s.passengers.middle * PASSENGER_REVENUE.middle
    + s.passengers.low * PASSENGER_REVENUE.low;
  const freightRev = s.freight * FREIGHT_RATE;
  const mailRev = s.hasMail ? MAIL_PAYMENT : 0;

  await app.logEvent(
    `Departed ${s.currentWorldName} for ${s.destinationName}. `
    + `Passengers: ${s.passengers.high}H/${s.passengers.middle}M/${s.passengers.low}L. `
    + `Freight: ${s.freight}t. ${s.hasMail ? 'Carrying mail. ' : ''}`
    + `Expected delivery revenue: Cr${(paxRev + freightRev + mailRev).toLocaleString()}.`
  );
}

// ─── IN_TRANSIT Phase ────────────────────────────────────────

export async function inTransitPhase(app) {
  const s = app.state;

  // Allow other activities before the jump resolves
  const { runOtherActivitiesLoop } = await import('./TraderAtWorld.js');
  await runOtherActivitiesLoop(app, game.i18n.localize('TWODSIX.Trader.Actions.ProceedWithJump'));

  // Consume fuel
  const jumpFuel = Math.ceil(s.ship.tonnage * s.ship.jumpRating * 0.1);
  s.ship.currentFuel = Math.max(0, s.ship.currentFuel - jumpFuel);

  // Roll jump duration: 148 + 6D6 hours
  let jumpHours = 148 + await app._roll('6d6');
  advanceDate(s.gameDate, jumpHours);

  const jumpDays = Math.round(jumpHours / HOURS_PER_DAY * 10) / 10;
  await app.logEvent(`In jump space for ${jumpDays} days. Fuel consumed: ${jumpFuel}t. Remaining: ${s.ship.currentFuel}t.`);

  // Unrefined fuel risk
  if (!s.ship.fuelIsRefined) {
    const fuelRoll = await app._roll('2D6');
    if (fuelRoll <= 4) {
      await app.logEvent('Unrefined fuel caused a rough jump! Minor damage sustained, but arrived safely.');
    }
  }

  s.phase = PHASE.ARRIVING;
}

// ─── ARRIVING Phase ──────────────────────────────────────────

export async function arrivingPhase(app) {
  const s = app.state;

  // Allow other activities before arrival is processed
  const { runOtherActivitiesLoop } = await import('./TraderAtWorld.js');
  await runOtherActivitiesLoop(app, game.i18n.localize('TWODSIX.Trader.Actions.ProcessArrival'));

  const { getWorldCache } = await import('./TraderState.js');

  // Move to destination
  const arrivedWorld = s.worlds.find(w => {
    const hex = getWorldCoordinate(w);
    return hex === s.destinationHex || hex === s.destinationGlobalHex;
  });
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

  await app.logEvent(`Arrived at ${s.currentWorldName} ${worldInfo}. In-system transit: ${Math.round(transitHours / HOURS_PER_DAY)} day(s).`);

  // Mark world as visited in cache and on actor
  if (arrivedWorld) {
    const subKey = arrivedWorld.getFlag('twodsix', 'subsectorKey');
    if (subKey && s.cacheJournalName) {
      const journal = await getOrCreateCacheJournal(s.cacheJournalName);
      const wasVisited = arrivedWorld.getFlag('twodsix', 'isVisited');
      if (!wasVisited) {
        await updateCachedWorldVisitedStatus(journal, subKey, s.currentWorldHex, true);
        await arrivedWorld.setFlag('twodsix', 'isVisited', true);
        await app.logEvent(`First time visiting ${s.currentWorldName} in this trading session! The local tourist board sends a brochure!`);
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
            await app.logEvent(`Discovery! Loading neighboring subsectors revealed ${newWorlds.length} new worlds.`);
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
            const reachableWorldsData = await fetchJumpWorlds(sectorName, localHex, s.ship.jumpRating, s.milieu || 'M1105');
            if (reachableWorldsData.length > 0) {
              const newActors = await createWorldActors(reachableWorldsData, s.currentWorldHex, s.ship.jumpRating, journal);
              if (newActors.length > 0) {
                for (const actor of newActors) {
                  if (!s.worlds.some(w => w.id === actor.id)) {
                    s.worlds.push(actor);
                  }
                }
                const newNames = newActors.filter(a => a.name !== s.currentWorldName).map(a => a.name).join(', ');
                await app.logEvent(`Discovery! Higher jump range (${s.ship.jumpRating}) revealed ${newActors.length} new potential destinations: ${newNames}.`);
              }
            }
          } catch (e) {
            console.error('Failed to auto-discover jump worlds:', e);
          }
        }
      }
    }
  }

  // Deliver passengers
  const paxRev = s.passengers.high * PASSENGER_REVENUE.high
    + s.passengers.middle * PASSENGER_REVENUE.middle
    + s.passengers.low * PASSENGER_REVENUE.low;
  if (paxRev > 0) {
    s.credits += paxRev;
    s.totalRevenue += paxRev;
    await app.logEvent(`Delivered passengers. Revenue: Cr${paxRev.toLocaleString()}.`);
  }

  // Deliver freight
  if (s.freight > 0) {
    const freightRev = s.freight * FREIGHT_RATE;
    s.credits += freightRev;
    s.totalRevenue += freightRev;
    await app.logEvent(`Delivered ${s.freight}t freight. Revenue: Cr${freightRev.toLocaleString()}.`);
  }

  // Deliver mail
  if (s.hasMail) {
    s.credits += MAIL_PAYMENT;
    s.totalRevenue += MAIL_PAYMENT;
    await app.logEvent(`Delivered mail. Revenue: Cr${MAIL_PAYMENT.toLocaleString()}.`);
  }

  // Clear trip bookings
  s.passengers = { high: 0, middle: 0, low: 0 };
  s.freight = 0;
  s.hasMail = false;

  // Port fees
  s.credits -= PORT_FEE_BASE;
  s.totalExpenses += PORT_FEE_BASE;

  await app.logEvent(`Credits: Cr${s.credits.toLocaleString()}. Cargo: ${getUsedCargoSpace(s)}/${s.ship.cargoCapacity}t.`);

  // Check charter expiry on arrival
  if (s.chartered && s.charterExpiryDay && getAbsoluteDay(s.gameDate) >= s.charterExpiryDay) {
    s.chartered = false;
    s.charterCargo = 0;
    s.charterStaterooms = 0;
    s.charterLowBerths = 0;
    s.charterExpiryDay = null;
    await app.logEvent('Charter period has ended. Ship space is now available.');
  }

  // Clear the visit cache so all market rolls are fresh for this new world
  s.worldVisitCache = {};
  getWorldCache(s); // Initialize tracker for the new world
  s.phase = PHASE.AT_WORLD;
}
