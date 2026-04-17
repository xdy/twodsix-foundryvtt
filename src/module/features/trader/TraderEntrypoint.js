/**
 * TraderEntrypoint.js
 * Entry point for trading. Handles setup dialogs, subsector loading,
 * crew configuration, and launching the app.
 */

import { CrewSetupApp } from './CrewSetupApp.js';
import { buildShipFromActor } from './OtherActivitiesApp.js';
import { ProgressDialog } from './ProgressDialog.js';
import {
  createWorldActors,
  loadSubsector,
  loadWorldsFromSectors,
  mergeLoadedSubsectorKeysFromActors
} from './SubsectorLoader.js';
import { TraderApp } from './TraderApp.js';
import { loadNeighboringSubsectorsInBackground } from './TraderBackgroundLoader.js';
import { DEFAULT_MERCHANT_TRADER, SECTOR_WIDTH_IN_SUBSECTORS } from './TraderConstants.js';
import { TraderSetupApp } from './TraderSetupApp.js';
import { freshTraderState, updateMortgageFromShip } from './TraderState.js';
import {
  buildGlobalHex,
  collectWorldsFromFolder,
  getLocalHex,
  getNeighboringSubsectors,
  getTimestamp,
  getWorldCoordinate,
  traderDebug
} from './TraderUtils.js';
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
 * Applies ship information to the trader state based on a ship actor.
 * @param {import('./TraderState.js').TraderState} state - The trader state to update
 * @param {string} shipActorId - The ID of the ship actor
 */
function applyShipToState(state, shipActorId) {
  if (!shipActorId) {
    return;
  }
  const shipActor = game.actors.get(shipActorId);
  if (shipActor) {
    state.ship = buildShipFromActor(shipActor, state.ship);
    updateMortgageFromShip(state);
  }
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
 * Stage 1: Resolve the 3x3 subsector grid to TravellerMap subsector letters (no world data load yet).
 * @param {import('./TraderState.js').SubsectorSearchEntry[]} subsectorsToSearch
 * @param {import('./TraderState.js').SetupResult} setupResult
 * @param {JournalEntry} cacheJournal
 * @param {import('./TraderState.js').SectorCoordinates} startSectorCoords
 * @param {ProgressDialog} [progressDialog]
 * @returns {Promise<{centralSubsector: object, neighboringSubsectors: object[], subsectorsToLoad: object[]}>}
 */
async function identifySubsectorsForTrader(subsectorsToSearch, setupResult, cacheJournal, startSectorCoords, progressDialog = null) {
  traderDebug('TraderEntrypoint', `identifySubsectorsForTrader starting for ${subsectorsToSearch.length} subsectors.`);

  if (progressDialog) {
    progressDialog.updateProgress({
      subsectorsTotal: subsectorsToSearch.length,
      subsectorsLoaded: 0,
      progressText: 'Identifying subsectors...'
    });
  }

  const subsectorIdentificationPromises = subsectorsToSearch.map(async (target) => {
    try {
      const subs = await loadSubsectorsWithCache(target.sectorName, cacheJournal, setupResult.milieu);
      if (subs) {
        const subIndex = target.subY * SECTOR_WIDTH_IN_SUBSECTORS + target.subX;
        const sub = subs[subIndex];
        if (sub) {
          if (progressDialog) {
            progressDialog.updateProgress({
              subsectorsLoaded: (progressDialog.subsectorsLoaded || 0) + 1
            });
          }
          const subLetter = sub.letter;
          return {
            sectorName: target.sectorName,
            subsectorLetter: subLetter,
            subsectorName: sub.name,
            sectorCoords: { x: target.sx, y: target.sy, sx: target.sx, sy: target.sy },
            subKey: `${target.sectorName}:${subLetter}:${setupResult.milieu || 'M1105'}`
          };
        }
      }
    } catch (e) {
      console.warn(`Twodsix | TraderEntrypoint | Failed to identify subsector in ${target.sectorName}:`, e);
    }
    return null;
  });

  const subsectorsToLoadResults = await Promise.all(subsectorIdentificationPromises);
  const subsectorsToLoad = subsectorsToLoadResults.filter(s => s !== null);

  if (subsectorsToLoad.length === 0) {
    console.warn('Twodsix | TraderEntrypoint | No subsectors identified for loading, falling back to setup default.');
    const fallbackKey = `${setupResult.sectorName}:${setupResult.subsectorLetter}:${setupResult.milieu || 'M1105'}`;
    subsectorsToLoad.push({
      sectorName: setupResult.sectorName,
      subsectorLetter: setupResult.subsectorLetter,
      subsectorName: setupResult.subsectorName,
      sectorCoords: startSectorCoords,
      subKey: fallbackKey
    });
  }

  const centralSubsector = subsectorsToLoad.find(s => s.sectorName === setupResult.sectorName && s.subsectorLetter === setupResult.subsectorLetter) || subsectorsToLoad[0];
  const neighboringSubsectors = subsectorsToLoad.filter(s => s !== centralSubsector);

  return { centralSubsector, neighboringSubsectors, subsectorsToLoad };
}

/**
 * Loads subsector data based on the identified subsectors to search.
 * @param {import('./TraderState.js').SubsectorSearchEntry[]} subsectorsToSearch
 * @param {import('./TraderState.js').SetupResult} setupResult
 * @param {JournalEntry} cacheJournal
 * @param {import('./TraderState.js').SectorCoordinates} startSectorCoords
 * @param {ProgressDialog} [progressDialog]
 * @returns {Promise<{allWorldData: import('./TraderState.js').WorldData[], loadedSubsectorKeys: string[], neighboringSubsectors: object[]}>}
 */
async function loadSubsectorData(subsectorsToSearch, setupResult, cacheJournal, startSectorCoords, progressDialog = null) {
  const { centralSubsector, neighboringSubsectors } = await identifySubsectorsForTrader(
    subsectorsToSearch,
    setupResult,
    cacheJournal,
    startSectorCoords,
    progressDialog
  );

  // Stage 2: Load world data for the central subsector immediately
  traderDebug('TraderEntrypoint', `Loading central subsector data: ${centralSubsector.subsectorName}`);
  if (progressDialog) {
    progressDialog.updateProgress({
      subsectorsTotal: 1, // Only tracking central for now in the dialog
      subsectorsLoaded: 0,
      progressText: `Loading central subsector ${centralSubsector.subsectorName} from TravellerMap...`
    });
  }

  const centralWorldData = await loadSubsector(centralSubsector.sectorName, centralSubsector.subsectorLetter, setupResult.milieu, cacheJournal, centralSubsector.sectorCoords);
  const loadedSubsectorKeys = [centralSubsector.subKey];

  if (progressDialog) {
    progressDialog.updateProgress({
      subsectorsLoaded: 1,
      worldsTotal: centralWorldData.length,
      progressText: `Loaded central subsector ${centralSubsector.subsectorName}.`
    });
  }

  return { allWorldData: centralWorldData, loadedSubsectorKeys, neighboringSubsectors };
}

/**
 * @param {import('../../entities/TwodsixActor').default} actor
 * @returns {string}
 */
function getActorSectorName(actor) {
  if (!actor) {
    return '';
  }
  const raw = actor.system?.coordinates;
  if (!raw || typeof raw !== 'string') {
    return actor.folder?.name || '';
  }
  const parts = raw.trim().split(/\s+/);
  if (parts.length < 2) {
    return actor.folder?.name || '';
  }
  const last = parts[parts.length - 1];
  if (last?.length === 4 && !isNaN(parseInt(last, 10))) {
    return parts.slice(0, -1).join(' ');
  }
  return actor.folder?.name || '';
}

/**
 * @param {import('../../entities/TwodsixActor').default} actor
 * @param {import('./TraderState.js').SetupResult} setupResult
 * @param {string} startGlobalHex
 * @param {string} localStartHex
 * @returns {boolean}
 */
function actorMatchesStartWorld(actor, setupResult, startGlobalHex, localStartHex) {
  const coord = getWorldCoordinate(actor);
  if (coord === startGlobalHex) {
    return true;
  }
  if (getLocalHex(coord) !== localStartHex) {
    return false;
  }
  return getActorSectorName(actor) === setupResult.sectorName;
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
  const localStartHex = getLocalHex(startHex) || startHex;
  let startWorld = worlds?.find(w => actorMatchesStartWorld(w, setupResult, startGlobalHex, localStartHex));

  if (!startWorld) {
    ui.notifications.warn(`Starting world ${startHex} not found in the loaded subsector. Attempting to fetch directly...`);
    try {
      const directWorlds = await fetchJumpWorlds(setupResult.sectorName, localStartHex, range, setupResult.milieu, startSectorCoords);
      if (directWorlds?.length > 0) {
        directWorlds.forEach(w => {
          if (!w.globalHex && w.hex) {
            w.globalHex = buildGlobalHex(startSectorCoords, w.hex);
          }
        });
        const extraWorlds = await createWorldActors(directWorlds, startGlobalHex, cacheJournal);
        extraWorlds.forEach(ew => {
          if (!worlds.find(w => w.id === ew.id)) {
            worlds.push(ew);
          }
        });
        startWorld = worlds.find(w => actorMatchesStartWorld(w, setupResult, startGlobalHex, localStartHex));
      } else {
        const directWorldData = await fetchWorldWithCache(setupResult.sectorName, localStartHex, setupResult.milieu, startSectorCoords, setupResult.cacheJournalName);
        if (directWorldData) {
          if (!directWorldData.globalHex && directWorldData.hex) {
            directWorldData.globalHex = buildGlobalHex(startSectorCoords, directWorldData.hex);
          }
          const extraWorlds = await createWorldActors([directWorldData], startGlobalHex, cacheJournal);
          if (extraWorlds.length > 0) {
            worlds.push(...extraWorlds);
            startWorld = extraWorlds.find(w => actorMatchesStartWorld(w, setupResult, startGlobalHex, localStartHex)) || extraWorlds[0];
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
      startWorld = worlds.find(w => actorMatchesStartWorld(w, setupResult, startGlobalHex, localStartHex)
        || getWorldCoordinate(w) === startHex);
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
 * @param {import('../../entities/TwodsixActor').default[]} worlds
 * @param {JournalEntry} journal
 * @param {JournalEntryPage} page
 * @param {string[]} loadedSubsectorKeysInitial - Subsector keys that actually have loaded data (central + actor flags)
 * @param {import('./TraderState.js').CrewMember[]} crew
 * @returns {import('./TraderState.js').TraderState} The initialized state
 */
function initializeTraderState(setupResult, startWorld, startGlobalHex, sectors, worlds, journal, page, loadedSubsectorKeysInitial, crew) {
  const state = freshTraderState();
  state.currentWorldHex = getWorldCoordinate(startWorld) || startGlobalHex;
  state.currentWorldName = startWorld.name;
  state.subsectorName = setupResult.subsectorName;
  state.sectorName = setupResult.sectorName;
  state.milieu = setupResult.milieu || 'M1105';
  state.cacheJournalName = setupResult.cacheJournalName;
  state.sectors = sectors;
  state.loadedSubsectorKeys = [...new Set(loadedSubsectorKeysInitial || [])];
  state.worlds = worlds;
  state.journalEntryId = journal.id;
  state.journalPageId = page?.id ?? null;

  applyShipToState(state, setupResult.shipActorId);

  state.ruleset = setupResult.ruleset || 'CE';
  state.crew = crew;
  state.credits = setupResult.startingCredits;
  return state;
}

/**
 * Start trading using local Foundry world actors.
 * @param {TraderApp} app
 */
async function startTradingLocal(app) {
  try {
    const { TraderLocalSetupApp } = await import('./TraderLocalSetupApp.js');
    const setupApp = new TraderLocalSetupApp();
    const resultPromise = setupApp.awaitResult();
    await setupApp.render({ force: true });
    const setupResult = await resultPromise;

    if (!setupResult) {
      return;
    }

    // Load all worlds from root folder
    const rootFolder = game.folders.get(setupResult.rootFolderId);
    if (!rootFolder) {
      ui.notifications.error(game.i18n.localize('TWODSIX.Trader.LocalSetup.RootFolderNotFound'));
      return;
    }

    const worlds = collectWorldsFromFolder(rootFolder);

    if (worlds.length === 0) {
      ui.notifications.warn(game.i18n.localize('TWODSIX.Trader.LocalSetup.NoWorldsFound'));
      return;
    }

    const startWorld = worlds.find(w => w.id === setupResult.startWorldId);
    if (!startWorld) {
      ui.notifications.error(game.i18n.localize('TWODSIX.Trader.LocalSetup.StartingWorldNotFound'));
      return;
    }

    const crew = await showCrewDialog(setupResult.shipActorId, setupResult.ruleset);
    if (!crew) {
      return;
    }

    const journal = await JournalEntry.create({
      name: setupResult.journalName || `Trader: Local — ${new Date().toLocaleDateString()}`,
    });

    const state = freshTraderState();
    state.worldSource = 'local';
    state.rootFolderId = setupResult.rootFolderId;
    state.currentWorldHex = getWorldCoordinate(startWorld);
    state.currentWorldName = startWorld.name;
    state.worlds = worlds;
    state.credits = setupResult.startingCredits;
    state.ruleset = setupResult.ruleset || 'CE';
    state.crew = crew;
    state.journalEntryId = journal.id;

    applyShipToState(state, setupResult.shipActorId);

    app.state = state;
    const pages = await journal.createEmbeddedDocuments('JournalEntryPage', [{
      name: 'Trade Log',
      type: 'text',
      text: { content: `<h2>Local Trading Journey</h2><p>Ship: ${app.state.ship.name}</p><p>Starting world: ${startWorld.name}</p><hr>\n` },
    }]);
    app.state.journalPageId = pages[0].id;

    await app._saveState();
    ui.notifications.info(game.i18n.format('TWODSIX.Trader.Messages.JourneyStarted', { world: startWorld.name }));
    await app.render({ force: true });

    // Let the first render finish before starting the loop
    await new Promise(r => setTimeout(r, 100));
    app.run();
  } catch (err) {
    console.error('Local trading setup failed:', err);
    ui.notifications.error(game.i18n.format('TWODSIX.Trader.LocalSetup.SetupFailed', { error: err.message }));
  }
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

  // Choose world source
  const source = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize('TWODSIX.Trader.WorldSource.Title') },
    content: `<p>${game.i18n.localize('TWODSIX.Trader.WorldSource.Prompt')}</p>`,
    buttons: [
      {
        action: 'travellermap',
        icon: 'fas fa-globe',
        label: game.i18n.localize('TWODSIX.Trader.WorldSource.Travellermap'),
        callback: (event, button) => button.action
      },
      {
        action: 'local',
        icon: 'fas fa-folder-open',
        label: game.i18n.localize('TWODSIX.Trader.WorldSource.Local'),
        callback: (event, button) => button.action
      }
    ],
    defaultButton: 'travellermap'
  });

  if (!source) {
    return;
  }

  if (source === 'local') {
    return startTradingLocal(app);
  }

  let progressDialog = null;

  // New trading journey setup
  try {
    const setupResult = await showSetupDialog();
    traderDebug('TraderEntrypoint', `Setup dialog result received:`, setupResult);
    if (!setupResult) {
      traderDebug('TraderEntrypoint', `Setup cancelled.`);
      return;
    }

    // Initialize progress dialog
    progressDialog = new ProgressDialog({
      label: 'Initializing Trading Journey...',
      progressText: 'Preparing to load sectors...'
    });
    await progressDialog.render({ force: true });

    traderDebug('TraderEntrypoint', `Fetching sectors for milieu ${setupResult.milieu}...`);
    progressDialog.updateProgress({ sectorsTotal: 1, sectorsLoaded: 0, progressText: 'Fetching sectors from TravellerMap API...' });
    const sectors = await fetchSectors(setupResult.milieu);
    progressDialog.updateProgress({ sectorsLoaded: 1, progressText: `Found ${sectors.length} sectors.` });
    traderDebug('TraderEntrypoint', `Found ${sectors.length} sectors.`);
    const startInfo = getStartSectorAndCoords(setupResult, sectors);
    if (!startInfo) {
      console.error(`Twodsix | TraderEntrypoint | [${getTimestamp()}] Start info not found.`);
      progressDialog.close();
      return;
    }
    const { sector: startSector, coords: startSectorCoords } = startInfo;
    const startGlobalHex = buildGlobalHex(startSectorCoords, setupResult.startHex);
    traderDebug('TraderEntrypoint', `Start Global Hex: ${startGlobalHex}`);
    const cacheJournal = await getOrCreateCacheJournal(setupResult.cacheJournalName);
    traderDebug('TraderEntrypoint', `Cache journal obtained: ${cacheJournal?.id}`);
    const range = getJumpRating(setupResult);
    traderDebug('TraderEntrypoint', `Jump rating: ${range}`);

    traderDebug('TraderEntrypoint', `Finding neighboring subsectors...`);
    const subsectorsToSearch = getNeighboringSubsectors(startSector, setupResult.startHex, sectors);
    traderDebug('TraderEntrypoint', `Neighboring subsectors found: ${subsectorsToSearch.length}`);
    const sectorsToSearch = [...new Set(subsectorsToSearch.map(s => s.sectorName))];
    traderDebug('TraderEntrypoint', `Sectors to search: ${sectorsToSearch.join(', ')}`);
    let worlds = loadWorldsFromSectors(sectorsToSearch);
    let neighboringSubsectors = [];
    let loadedSubsectorKeysInitial = [];

    if (worlds?.length > 0) {
      const { neighboringSubsectors: identifiedNeighbors } = await identifySubsectorsForTrader(
        subsectorsToSearch,
        setupResult,
        cacheJournal,
        startSectorCoords,
        progressDialog
      );
      neighboringSubsectors = identifiedNeighbors;
      traderDebug('TraderEntrypoint', `Found ${worlds.length} existing world actors in folders.`);
      progressDialog.updateProgress({
        worldsToCreate: worlds.length,
        worldsCreated: worlds.length,
        progressText: `Found ${worlds.length} existing world actors in folders.`
      });
      ui.notifications.info(game.i18n.format('TWODSIX.Trader.Messages.UsingCachedWorlds', { subsector: setupResult.subsectorName }));
      await ensureGlobalHexForWorlds(worlds, sectors, startSector);
      traderDebug('TraderEntrypoint', `Using ${worlds.length} worlds from folders: ${sectorsToSearch.join(', ')}`);
      loadedSubsectorKeysInitial = mergeLoadedSubsectorKeysFromActors([], worlds);
    } else {
      traderDebug('TraderEntrypoint', `No existing world actors found. Loading from API/Cache...`);
      progressDialog.updateProgress({ progressText: 'No existing world actors found. Loading from API/Cache...' });
      const { allWorldData, loadedSubsectorKeys, neighboringSubsectors: neighbors } = await loadSubsectorData(
        subsectorsToSearch,
        setupResult,
        cacheJournal,
        startSectorCoords,
        progressDialog
      );
      neighboringSubsectors = neighbors;
      traderDebug('TraderEntrypoint', `Central world data gathered: ${allWorldData.length}`);
      if (!allWorldData.length) {
        ui.notifications.error(game.i18n.localize('TWODSIX.Trader.Messages.NoWorldsFound'));
        progressDialog.close();
        return;
      }
      traderDebug('TraderEntrypoint', `Creating world actors...`);
      progressDialog.updateProgress({
        worldsToCreate: allWorldData.length,
        worldsCreated: 0,
        progressText: `Creating ${allWorldData.length} world actors in Foundry...`
      });

      worlds = await createWorldActors(allWorldData, startGlobalHex, cacheJournal);
      progressDialog.updateProgress({
        worldsCreated: worlds.length,
        progressText: `Created/found ${worlds.length} world actors.`
      });
      traderDebug('TraderEntrypoint', `Created/found ${worlds.length} world actors.`);
      loadedSubsectorKeysInitial = mergeLoadedSubsectorKeysFromActors(loadedSubsectorKeys, worlds);
    }

    traderDebug('TraderEntrypoint', `Finding start world...`);
    progressDialog.updateProgress({ progressText: 'Confirming starting world...' });
    const startWorld = await findOrFetchStartWorld(worlds, startGlobalHex, setupResult, range, cacheJournal, startSectorCoords, sectorsToSearch);
    if (!startWorld) {
      console.error(`Twodsix | TraderEntrypoint | [${getTimestamp()}] Start world not found or fetch aborted.`);
      progressDialog.close();
      return;
    }
    traderDebug('TraderEntrypoint', `Start world confirmed: ${startWorld.name}`);

    progressDialog.updateProgress({ progressText: 'Loading crew configuration...' });
    traderDebug('TraderEntrypoint', `Showing crew dialog...`);
    // Close progress dialog before showing next modal dialog
    progressDialog.close();
    progressDialog = null;

    const crew = await showCrewDialog(setupResult.shipActorId, setupResult.ruleset);
    traderDebug('TraderEntrypoint', `Crew dialog result received:`, crew);
    if (!crew) {
      traderDebug('TraderEntrypoint', `Crew dialog cancelled.`);
      return;
    }

    traderDebug('TraderEntrypoint', `Creating journal entry...`);
    const journal = await JournalEntry.create({
      name: setupResult.journalName || game.i18n.format('TWODSIX.Trader.Messages.DefaultJournalName', {
        subsector: setupResult.subsectorName,
        date: new Date().toLocaleDateString(),
      }),
    });

    loadedSubsectorKeysInitial = mergeLoadedSubsectorKeysFromActors(loadedSubsectorKeysInitial, worlds);
    app.state = initializeTraderState(setupResult, startWorld, startGlobalHex, sectors, worlds, journal, null, loadedSubsectorKeysInitial, crew);

    const shipLabel = game.i18n.localize('TWODSIX.Trader.Messages.ShipLabel');
    const subsectorLabel = game.i18n.localize('TWODSIX.Trader.Messages.SubsectorLabel');
    const startingWorldLabel = game.i18n.localize('TWODSIX.Trader.Messages.StartingWorldLabel');
    const pages = await journal.createEmbeddedDocuments('JournalEntryPage', [{
      name: game.i18n.localize('TWODSIX.Trader.Messages.TradeLogPageName'),
      type: 'text',
      text: {
        content: `<h2>${game.i18n.localize('TWODSIX.Trader.Messages.TradingJourneyHeader')}</h2>`
          + `<p>${shipLabel}: ${app.state.ship.name || DEFAULT_MERCHANT_TRADER.name} (${app.state.ship.tonnage || DEFAULT_MERCHANT_TRADER.tonnage}t)</p>`
          + `<p>${subsectorLabel}: ${setupResult.subsectorName}, ${setupResult.sectorName}</p>`
          + `<p>${startingWorldLabel}: ${startWorld.name} (${startWorld.system?.uwp})</p><hr>\n`,
      },
    }]);
    app.state.journalPageId = pages[0].id;
    await app._saveState();

    ui.notifications.info(game.i18n.format('TWODSIX.Trader.Messages.JourneyStarted', { world: startWorld.name }));
    await app.render({ force: true });

    // Background load neighboring subsectors
    if (neighboringSubsectors.length > 0) {
      ui.notifications.info(game.i18n.format('TWODSIX.Trader.Messages.LoadingNeighboringSubsectors', {
        count: neighboringSubsectors.length,
      }));
      (async () => {
        await loadNeighboringSubsectorsInBackground(
          app,
          neighboringSubsectors,
          setupResult,
          cacheJournal,
          startGlobalHex,
        );
      })();
    }

    // Let the first render finish before starting the loop
    await new Promise(r => setTimeout(r, 100));
    app.run();
  } catch (err) {
    console.error('Trading journey setup failed:', err);
    if (progressDialog) {
      progressDialog.close();
    }
    ui.notifications.error(game.i18n.format('TWODSIX.Trader.Messages.SetupFailed', { error: err.message }));
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
 * @param {string} shipActorId
 * @param {string} ruleset
 * @returns {Promise<Array|null>}
 */
async function showCrewDialog(shipActorId, ruleset) {
  const app = new CrewSetupApp({ shipActorId, ruleset });
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
