/**
 * TraderEntrypoint.js
 * Entry point for trading. Handles setup dialogs, subsector loading,
 * crew configuration, and launching the app.
 */

import { CrewSetupApp } from './CrewSetupApp.js';
import { createWorldActors, loadSubsector, loadWorldsFromSectors } from './SubsectorLoader.js';
import { TraderApp } from './TraderApp.js';
import { DEFAULT_MERCHANT_TRADER, MORTGAGE_DIVISOR, SECTOR_WIDTH_IN_SUBSECTORS } from './TraderConstants.js';
import { TraderSetupApp } from './TraderSetupApp.js';
import { freshTraderState } from './TraderState.js';
import { buildGlobalHex, getNeighboringSubsectors, getWorldCoordinate } from './TraderUtils.js';
import { fetchJumpWorlds, fetchSectors, fetchWorldWithCache, loadSubsectorsWithCache } from './TravellerMapAPI.js';
import { getOrCreateCacheJournal } from './TravellerMapCache.js';

/**
 * Handles resuming an existing trading journey from a journal entry.
 * @param {TraderApp} app
 * @param {JournalEntry} existingJournal
 * @returns {Promise<boolean>} True if resumed successfully
 */
async function handleExistingJournal(app, existingJournal) {
  if (!existingJournal) {
    return false;
  }
  app.loadState(existingJournal);
  if (app.state) {
    await app.render({ force: true });
    app.run();
    return true;
  }
  return false;
}

/**
 * Finds the starting sector and its global coordinates.
 * @param {import('./TraderState.js').SetupResult} setupResult
 * @param {import('./TraderState.js').Sector[]} sectors
 * @returns {{sector: import('./TraderState.js').Sector, coords: import('./TraderState.js').SectorCoordinates}|null} or null if not found
 */
function getStartSectorAndCoords(setupResult, sectors) {
  const sector = sectors.find(s => s.name === setupResult.sectorName);
  if (!sector) {
    ui.notifications.error(`Sector ${setupResult.sectorName} not found in milieu ${setupResult.milieu}`);
    return null;
  }
  const coords = { x: sector.sx, y: sector.sy, sx: sector.sx, sy: sector.sy };
  return { sector, coords };
}

/**
 * Determines the ship's jump rating from setup or actor data.
 * @param {import('./TraderState.js').SetupResult} setupResult
 * @returns {number}
 */
function getJumpRating(setupResult) {
  let jumpRating = DEFAULT_MERCHANT_TRADER.jumpRating;
  if (setupResult.shipActorId) {
    const shipActor = game.actors.get(setupResult.shipActorId);
    if (shipActor) {
      jumpRating = shipActor.system.shipStats?.drives?.jDrive?.rating ?? jumpRating;
    }
  }
  return Math.max(jumpRating, 1);
}

/**
 * Ensures all worlds have a global coordinate in their flags if they only have local ones.
 * @param {import('../../entities/TwodsixActor').default[]} worlds
 * @param {import('./TraderState.js').Sector[]} sectors
 * @param {import('./TraderState.js').Sector} startSector
 */
async function ensureGlobalHexForWorlds(worlds, sectors, startSector) {
  const updates = [];
  worlds.forEach(w => {
    const currentCoord = w.getFlag('twodsix', 'locationCoordinate') || getWorldCoordinate(w) || w.system?.hex;
    if (currentCoord && !currentCoord.includes(',')) {
      const sName = (w.system?.coordinates?.split(' ').slice(0, -1).join(' ')) || w.folder?.name;
      const sector = sectors.find(s => s.name === sName) || startSector;
      const sCoords = { x: sector.sx, y: sector.sy, sx: sector.sx, sy: sector.sy };
      const globalHex = buildGlobalHex(sCoords, currentCoord);
      updates.push({
        _id: w.id,
        'flags.twodsix.locationCoordinate': globalHex
      });
    }
  });

  if (updates.length > 0) {
    await Actor.updateDocuments(updates);
  }
}

/**
 * Loads subsector data based on the identified subsectors to search.
 * @param {import('./TraderState.js').SubsectorSearchEntry[]} subsectorsToSearch
 * @param {import('./TraderState.js').SetupResult} setupResult
 * @param {JournalEntry} cacheJournal
 * @param {import('./TraderState.js').SectorCoordinates} startSectorCoords
 * @returns {Promise<import('./TraderState.js').WorldData[]>}
 */
async function loadSubsectorData(subsectorsToSearch, setupResult, cacheJournal, startSectorCoords) {
  const subsectorsToLoad = [];
  for (const target of subsectorsToSearch) {
    const subs = await loadSubsectorsWithCache(target.sectorName, cacheJournal);
    if (subs) {
      const subIndex = target.subY * SECTOR_WIDTH_IN_SUBSECTORS + target.subX;
      const sub = subs[subIndex];
      if (sub) {
        subsectorsToLoad.push({
          sectorName: target.sectorName,
          subsectorLetter: sub.letter,
          subsectorName: sub.name,
          sectorCoords: { x: target.sx, y: target.sy, sx: target.sx, sy: target.sy }
        });
      }
    }
  }

  if (subsectorsToLoad.length === 0) {
    subsectorsToLoad.push({
      sectorName: setupResult.sectorName,
      subsectorLetter: setupResult.subsectorLetter,
      subsectorName: setupResult.subsectorName,
      sectorCoords: startSectorCoords
    });
  }

  let allWorldData = [];
  for (const sub of subsectorsToLoad) {
    try {
      const subData = await loadSubsector(sub.sectorName, sub.subsectorLetter, setupResult.milieu, cacheJournal, sub.sectorCoords);
      allWorldData = allWorldData.concat(subData);
    } catch (e) {
      console.warn(`Failed to load subsector ${sub.subsectorName} in ${sub.sectorName}:`, e);
    }
  }
  return allWorldData;
}

/**
 * Attempts to find the starting world among loaded worlds or fetches it from the API.
 * @param {import('../../entities/TwodsixActor').default[]} worlds
 * @param {string} startGlobalHex
 * @param {import('./TraderState.js').SetupResult} setupResult
 * @param {number} range
 * @param {JournalEntry} cacheJournal
 * @param {import('./TraderState.js').SectorCoordinates} startSectorCoords
 * @param {Array<string>} sectorsToSearch
 * @returns {Promise<import('../../entities/TwodsixActor').default|null>}
 */
async function findOrFetchStartWorld(worlds, startGlobalHex, setupResult, range, cacheJournal, startSectorCoords, sectorsToSearch) {
  const startHex = setupResult.startHex;
  let startWorld = worlds?.find(w => {
    const hex = getWorldCoordinate(w);
    return hex === startGlobalHex || hex === startHex;
  });

  if (!startWorld) {
    ui.notifications.warn(`Starting world ${startHex} not found in the loaded subsector. Attempting to fetch directly...`);
    try {
      const directWorlds = await fetchJumpWorlds(setupResult.sectorName, startHex, range, setupResult.milieu, startSectorCoords);
      if (directWorlds?.length > 0) {
        directWorlds.forEach(w => {
          if (!w.globalHex && w.hex) {
            w.globalHex = buildGlobalHex(startSectorCoords, w.hex);
          }
        });
        const extraWorlds = await createWorldActors(directWorlds, startGlobalHex, range, cacheJournal);
        extraWorlds.forEach(ew => {
          if (!worlds.find(w => w.id === ew.id)) {
            worlds.push(ew);
          }
        });
        startWorld = worlds.find(w => getWorldCoordinate(w) === startGlobalHex);
      } else {
        const directWorldData = await fetchWorldWithCache(setupResult.sectorName, startHex, setupResult.milieu, startSectorCoords, setupResult.cacheJournalName);
        if (directWorldData) {
          if (!directWorldData.globalHex && directWorldData.hex) {
            directWorldData.globalHex = buildGlobalHex(startSectorCoords, directWorldData.hex);
          }
          const extraWorlds = await createWorldActors([directWorldData], startGlobalHex, range, cacheJournal);
          if (extraWorlds.length > 0) {
            worlds.push(...extraWorlds);
            startWorld = extraWorlds[0];
          }
        }
      }
    } catch (err) {
      console.error('Trader: Failed to fetch single world data:', err);
    }
  }

  while (!startWorld) {
    const confirm = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'Starting World Missing' },
      content: `<p>Selected starting world <b>${startHex}</b> in sector <b>${setupResult.sectorName}</b> could not be found or loaded automatically.</p>
                <p>Would you like to try to create the world actor manually in the folder <i>'${setupResult.sectorName}'</i> before continuing?</p>
                <p>Press <b>Yes/OK</b> once the world actor exists, or <b>No/Cancel</b> to abort.</p>`,
      yes: { label: game.i18n.localize('Yes'), callback: () => true },
      no: { label: game.i18n.localize('No'), callback: () => false },
      defaultButton: 'yes'
    });

    if (!confirm) {
      return null;
    }

    const reloadedWorlds = loadWorldsFromSectors(sectorsToSearch);
    if (reloadedWorlds.length > 0) {
      // Update the outer worlds array too
      reloadedWorlds.forEach(rw => {
        if (!worlds.find(w => w.id === rw.id)) {
          worlds.push(rw);
        }
      });
      startWorld = worlds.find(w => {
        const hex = getWorldCoordinate(w);
        return hex === startGlobalHex || hex === startHex;
      });
    }
    if (!startWorld) {
      ui.notifications.error(`World ${startHex} still not found in '${setupResult.sectorName}'. Please ensure it exists with the correct coordinates.`);
    }
  }
  return startWorld;
}

/**
 * Initializes the trader state with all collected information.
 * @param {import('./TraderState.js').SetupResult} setupResult
 * @param {import('../../entities/TwodsixActor').default} startWorld
 * @param {string} startGlobalHex
 * @param {import('./TraderState.js').Sector[]} sectors
 * @param {import('./TraderState.js').SubsectorSearchEntry[]} subsectorsToSearch
 * @param {import('../../entities/TwodsixActor').default[]} worlds
 * @param {JournalEntry} journal
 * @param {JournalEntryPage} page
 * @param {import('./TraderState.js').CrewMember[]} crew
 * @returns {import('./TraderState.js').TraderState} The initialized state
 */
function initializeTraderState(setupResult, startWorld, startGlobalHex, sectors, subsectorsToSearch, worlds, journal, page, crew) {
  const state = freshTraderState();
  state.currentWorldHex = getWorldCoordinate(startWorld) || startGlobalHex;
  state.currentWorldName = startWorld.name;
  state.subsectorName = setupResult.subsectorName;
  state.sectorName = setupResult.sectorName;
  state.cacheJournalName = setupResult.cacheJournalName;
  state.sectors = sectors;
  state.loadedSubsectorKeys = subsectorsToSearch.map(s => `${s.sectorName}:${s.subX},${s.subY}`);
  state.worlds = worlds;
  state.journalEntryId = journal.id;
  state.journalPageId = page.id;

  if (setupResult.shipActorId) {
    const shipActor = game.actors.get(setupResult.shipActorId);
    if (shipActor) {
      const sys = shipActor.system;
      const components = shipActor.itemTypes?.component ?? [];
      const accommodations = components.filter(i => i.system?.subtype === 'accommodations');
      const staterooms = accommodations
        .filter(i => /stateroom/i.test(i.name))
        .reduce((sum, i) => sum + (i.system?.quantity ?? 0), 0);
      const lowBerths = accommodations
        .filter(i => /low berth|cryoberth/i.test(i.name))
        .reduce((sum, i) => sum + (i.system?.quantity ?? 0), 0);
      const armed = components.some(i => i.system?.subtype === 'armament');
      state.ship = {
        ...state.ship,
        name: shipActor.name,
        jumpRating: sys.shipStats?.drives?.jDrive?.rating ?? state.ship.jumpRating,
        maneuverRating: sys.shipStats?.drives?.mDrive?.rating ?? state.ship.maneuverRating,
        tonnage: sys.mass?.max ?? state.ship.tonnage,
        cargoCapacity: sys.weightStats?.cargo ?? state.ship.cargoCapacity,
        fuelCapacity: sys.shipStats?.fuel?.max ?? state.ship.fuelCapacity,
        shipCost: parseInt(sys.shipValue) || state.ship.shipCost,
        ...(staterooms > 0 && { staterooms }),
        ...(lowBerths > 0 && { lowBerths }),
        armed,
      };
      state.monthlyPayment = Math.ceil(state.ship.shipCost / MORTGAGE_DIVISOR);
      state.mortgageRemaining = state.ship.shipCost * 2.2;
    }
  }
  state.crew = crew;
  state.credits = setupResult.startingCredits;
  return state;
}

/**
 * Start a new trading journey or resume an existing one.
 * @param {JournalEntry} [existingJournal] - Journal entry to resume from
 */
export async function startTrading(existingJournal = null) {
  const app = new TraderApp();

  if (await handleExistingJournal(app, existingJournal)) {
    return;
  }

  // New trading journey setup
  try {
    const setupResult = await showSetupDialog();
    if (!setupResult) {
      return;
    }

    const sectors = await fetchSectors(setupResult.milieu);
    const startInfo = getStartSectorAndCoords(setupResult, sectors);
    if (!startInfo) {
      return;
    }
    const { sector: startSector, coords: startSectorCoords } = startInfo;
    const startGlobalHex = buildGlobalHex(startSectorCoords, setupResult.startHex);
    const cacheJournal = await getOrCreateCacheJournal(setupResult.cacheJournalName);
    const range = getJumpRating(setupResult);

    const subsectorsToSearch = getNeighboringSubsectors(startSector, setupResult.startHex, sectors);
    const sectorsToSearch = [...new Set(subsectorsToSearch.map(s => s.sectorName))];
    let worlds = loadWorldsFromSectors(sectorsToSearch);

    if (worlds?.length > 0) {
      ui.notifications.info(game.i18n.format('TWODSIX.Trader.Messages.UsingCachedWorlds', { subsector: setupResult.subsectorName }));
      await ensureGlobalHexForWorlds(worlds, sectors, startSector);
      console.log(`Using ${worlds.length} worlds from folders: ${sectorsToSearch.join(', ')}`);
    } else {
      ui.notifications.info(game.i18n.localize('TWODSIX.Trader.Messages.LoadingSubsector'));
      const allWorldData = await loadSubsectorData(subsectorsToSearch, setupResult, cacheJournal, startSectorCoords);
      if (!allWorldData.length) {
        ui.notifications.error(game.i18n.localize('TWODSIX.Trader.Messages.NoWorldsFound'));
        return;
      }
      worlds = await createWorldActors(allWorldData, startGlobalHex, range, cacheJournal);
    }

    const startWorld = await findOrFetchStartWorld(worlds, startGlobalHex, setupResult, range, cacheJournal, startSectorCoords, sectorsToSearch);
    if (!startWorld) {
      return;
    }

    const crew = await showCrewDialog(setupResult.shipActorId);
    if (!crew) {
      return;
    }

    const journal = await JournalEntry.create({
      name: setupResult.journalName || `Trader: ${setupResult.subsectorName} — ${new Date().toLocaleDateString()}`,
    });
    const pages = await journal.createEmbeddedDocuments('JournalEntryPage', [{
      name: 'Trade Log',
      type: 'text',
      text: { content: `<h2>Trading Journey</h2><p>Ship: ${DEFAULT_MERCHANT_TRADER.name} (${DEFAULT_MERCHANT_TRADER.tonnage}t)</p><p>Subsector: ${setupResult.subsectorName}, ${setupResult.sectorName}</p><p>Starting world: ${startWorld.name} (${startWorld.system?.uwp})</p><hr>\n` },
    }]);

    app.state = initializeTraderState(setupResult, startWorld, startGlobalHex, sectors, subsectorsToSearch, worlds, journal, pages[0], crew);
    await app._saveState();

    ui.notifications.info(game.i18n.format('TWODSIX.Trader.Messages.JourneyStarted', { world: startWorld.name }));
    await app.render({ force: true });

    // Let the first render finish before starting the loop
    await new Promise(r => setTimeout(r, 100));
    app.run();
  } catch (err) {
    console.error('Trading journey setup failed:', err);
    ui.notifications.error(`Trading journey setup failed: ${err.message}`);
  }
}

/**
 * Show the initial setup dialog for sector/subsector selection with cascading dropdowns.
 * @returns {Promise<object|null>} {journalName, cacheJournalName, sectorName, subsectorLetter, subsectorName, startingCredits} or null
 */
async function showSetupDialog() {
  ui.notifications.info(game.i18n.localize('TWODSIX.Trader.Messages.LoadingSetup'));

  const app = new TraderSetupApp();
  const resultPromise = app.awaitResult();
  await app.render({ force: true });

  return await resultPromise;
}


/**
 * Show the crew setup dialog and return a promise resolving to the crew array.
 * @returns {Promise<Array|null>}
 */
async function showCrewDialog(shipActorId) {
  const app = new CrewSetupApp({ shipActorId });
  const resultPromise = app.awaitResult();
  await app.render({ force: true });
  return resultPromise;
}

/**
 * Find and list journal entries that have Trade state saved.
 * @returns {Array<JournalEntry>} Journal entries with saved trading journeys
 */
export function findSavedTradingJourneys() {
  return game.journal.filter(j => j.getFlag('twodsix', 'tradeState'));
}
