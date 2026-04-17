/**
 * SubsectorLoader.js
 * Fetches subsector data from the Traveller Map API, parses UWP data,
 * creates World actors, and provides hex distance calculations.
 */

import { SECTOR_WIDTH_IN_SUBSECTORS, SUBSECTOR_LETTERS, TRAVELLERMAP_ROOT_FOLDER_NAME } from './TraderConstants.js';
import {
  buildGlobalHex,
  collectWorldsFromFolder,
  deduplicateWorlds,
  getLocalHex,
  getNeighboringSubsectors,
  getWorldCoordinate,
  hexDistance,
  isLocalMode,
  parseUWP,
  traderDebug,
  worldsInJumpRange
} from './TraderUtils.js';
import { fetchJumpWorlds, fetchWorlds, loadSubsectorsWithCache } from './TravellerMapAPI.js';
import {
  buildSubsectorKey,
  CACHE_KEY_WORLDS,
  getCachedData,
  getCachedWorlds,
  getOrCreateCacheJournal,
  setCachedWorlds
} from './TravellerMapCache.js';

/**
 * Internal cache for folder creation promises to prevent race conditions during concurrent imports.
 * @type {Map<string, Promise<Folder>>}
 * @private
 */
const _folderPromises = new Map();

/**
 * Determine whether a subsector has already been loaded.
 * Supports legacy key format ("Sector:subX,subY") for old saved states.
 * @param {import('./TraderState.js').TraderState} state
 * @param {string} canonicalKey
 * @param {import('./TraderState.js').SubsectorSearchEntry} target
 * @returns {boolean}
 */
function hasLoadedSubsectorKey(state, canonicalKey, target) {
  if (!Array.isArray(state.loadedSubsectorKeys)) {
    return false;
  }
  const legacyKey = `${target.sectorName}:${target.subX},${target.subY}`;
  return state.loadedSubsectorKeys.includes(canonicalKey) || state.loadedSubsectorKeys.includes(legacyKey);
}

/**
 * Robustly find or create the root TravellerMap folder.
 * @returns {Promise<Folder>}
 * @private
 */
async function getRootFolder() {
  const rootName = TRAVELLERMAP_ROOT_FOLDER_NAME;
  const findRoot = () => game.folders.find(f => f.name === rootName && f.type === 'Actor');

  const root = findRoot();
  if (root) {
    return root;
  }

  // Use a promise-based lock
  if (_folderPromises.has(rootName)) {
    return _folderPromises.get(rootName);
  }

  const promise = Folder.create({ name: rootName, type: 'Actor' });
  _folderPromises.set(rootName, promise);
  try {
    return await promise;
  } finally {
    _folderPromises.delete(rootName);
  }
}

/**
 * Robustly find or create a sector-specific folder under the TravellerMap root.
 * @param {string} sectorName
 * @returns {Promise<Folder>}
 * @private
 */
async function getSectorFolder(sectorName) {
  const rootFolder = await getRootFolder();
  const folderName = sectorName || 'Unknown Sector';

  // Try to find under root first, then anywhere
  const findSector = () => game.folders.find(f => f.name === folderName && f.type === 'Actor' && f.folder === rootFolder.id) ||
                         game.folders.find(f => f.name === folderName && f.type === 'Actor');

  const sector = findSector();
  if (sector) {
    return sector;
  }

  const cacheKey = `${rootFolder.id}:${folderName}`;
  if (_folderPromises.has(cacheKey)) {
    return _folderPromises.get(cacheKey);
  }

  const promise = Folder.create({ name: folderName, type: 'Actor', folder: rootFolder.id });
  _folderPromises.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    _folderPromises.delete(cacheKey);
  }
}

/**
 * Load subsector data with caching support.
 * First checks the cache journal for existing data before making API call.
 * @param {string} sectorName - e.g. "Spinward Marches"
 * @param {string} subsectorLetter - e.g. "C" for Regina subsector
 * @param {string} milieu - e.g. "M1105"
 * @param {JournalEntry} [cacheJournal] - Optional cache journal to use
 * @param {import('./TraderState.js').SectorCoordinates} [sectorCoords] - Optional sector coordinates
 * @returns {Promise<import('./TraderState.js').WorldData[]>} Parsed world data array
 */
export async function loadSubsector(sectorName, subsectorLetter, milieu = 'M1105', cacheJournal = null, sectorCoords = null) {
  const subsectorKey = buildSubsectorKey(sectorName, subsectorLetter, milieu);

  // Check cache first if journal provided
  if (cacheJournal) {
    traderDebug('SubsectorLoader', `Checking cache for subKey: ${subsectorKey}`);
    const cachedWorlds = await getCachedWorlds(cacheJournal, subsectorKey);
    traderDebug('SubsectorLoader', `Cache check for ${subsectorKey} returned ${cachedWorlds ? cachedWorlds.length : 'null/undefined'} results.`);
    if (cachedWorlds && cachedWorlds.length > 0) {
      traderDebug('SubsectorLoader', `Using cached worlds for ${sectorName} ${subsectorLetter}: ${cachedWorlds.length} worlds found.`);
      // Ensure globalHex and sectorName are added/updated on cached worlds
      cachedWorlds.forEach(w => {
        if (!w.globalHex && w.hex && sectorCoords) {
          w.globalHex = buildGlobalHex(sectorCoords, w.hex);
        }
        if (!w.sectorName) {
          w.sectorName = sectorName;
        }
        w.subsectorKey = subsectorKey; // Tag for later cache update
        // Ensure UWP fields are populated if they were missing in cache but uwp string exists
        if (!w.starport && w.uwp) {
          Object.assign(w, parseUWP(w.uwp));
        }
      });
      return cachedWorlds;
    }
  }

  // Fetch from API
  traderDebug('SubsectorLoader', `Cache miss for ${sectorName} ${subsectorLetter}. Fetching from API...`);
  const worldDataArray = await fetchWorlds(sectorName, subsectorLetter, milieu, sectorCoords);
  worldDataArray.forEach(w => w.subsectorKey = subsectorKey);

  // Store in cache if journal provided (check first to avoid overwriting)
  if (cacheJournal && worldDataArray.length > 0) {
    const existing = await getCachedWorlds(cacheJournal, subsectorKey);
    if (!existing || existing.length === 0) {
      traderDebug('SubsectorLoader', `Caching ${worldDataArray.length} worlds for ${sectorName} ${subsectorLetter} under key ${subsectorKey}.`);
      await setCachedWorlds(cacheJournal, subsectorKey, worldDataArray);
    }
  }

  return worldDataArray;
}

/**
 * Create World actors in Foundry from parsed world data.
 * @param {import('./TraderState.js').WorldData[]} worldDataArray - Parsed world records
 * @param {string} [startGlobalHex] - Global hex of the starting world for distance filtering
 * @param {JournalEntry} [cacheJournal] - Optional cache journal to update status
 * @returns {Promise<import('../../entities/TwodsixActor').default[]>} Created/found world Actor documents
 */
export async function createWorldActors(worldDataArray, startGlobalHex = null, cacheJournal = null) {
  // Build actor creation data and find existing actors
  const actorDataArray = [];
  const finalActors = [];
  const cacheUpdates = new Map(); // subKey -> Set(hex)

  // Deduplicate worldDataArray by name and hex/globalHex to avoid duplicate actors
  const uniqueWorldData = deduplicateWorlds(worldDataArray);

  // Group worlds by sector to efficiently find existing actors in those folders
  const worldsBySector = {};
  for (const w of uniqueWorldData) {
    const sName = w.sectorName || 'Unknown Sector';
    if (!worldsBySector[sName]) {
      worldsBySector[sName] = [];
    }
    worldsBySector[sName].push(w);
  }

  for (const [sectorName, worlds] of Object.entries(worldsBySector)) {
    const folder = await getSectorFolder(sectorName);
    const allMatchingFolders = game.folders.filter(f => f.name === (sectorName || 'Unknown Sector') && f.type === 'Actor');
    const existingActors = allMatchingFolders.flatMap(f => f.contents);

    for (const w of worlds) {
      const hex = w.globalHex || w.hex;
      const existing = existingActors.find(a => a.name === w.name && (
        a.system.coordinates === w.hex ||
        a.system.coordinates === w.globalHex ||
        a.getFlag('twodsix', 'locationCoordinate') === w.hex ||
        a.getFlag('twodsix', 'locationCoordinate') === w.globalHex ||
        a.system.coordinates === `${sectorName} ${w.hex}`
      ));

      if (existing) {
        finalActors.push(existing);
        // Ensure subsectorKey flag is set if missing
        if (!existing.getFlag('twodsix', 'subsectorKey') && w.subsectorKey) {
          await existing.setFlag('twodsix', 'subsectorKey', w.subsectorKey);
        }
        if (cacheJournal && w.subsectorKey) {
          if (!cacheUpdates.has(w.subsectorKey)) {
            cacheUpdates.set(w.subsectorKey, new Set());
          }
          cacheUpdates.get(w.subsectorKey).add(w.hex || w.globalHex);
        }
      } else {
        // Ensure UWP fields are populated (especially if loaded from older minimal cache)
        if (!w.starport && w.uwp) {
          Object.assign(w, parseUWP(w.uwp));
        }
        actorDataArray.push({
          name: w.name,
          type: 'world',
          folder: folder.id,
          system: {
            name: w.name,
            uwp: w.uwp,
            starport: w.starport,
            size: w.size,
            atmosphere: w.atmosphere,
            hydrographics: w.hydrographics,
            population: w.population,
            government: w.government,
            lawLevel: w.lawLevel,
            techLevel: w.techLevel,
            tradeCodes: Array.isArray(w.tradeCodes) ? w.tradeCodes.join(' ') : (w.tradeCodes || ''),
            travelZone: (w.travelZone || 'Green').toLowerCase() === 'green' ? '' : (w.travelZone || '').toLowerCase(),
            features: w.features,
            populationModifier: w.populationModifier,
            numPlanetoidBelts: w.numPlanetoidBelts,
            numGasGiants: w.numGasGiants,
            coordinates: `${sectorName} ${w.hex}`,
            allegiance: w.allegiance,
          },
          flags: {
            twodsix: {
              locationCoordinate: hex,
              subsectorKey: w.subsectorKey,
              isVisited: !!w.isVisited,
              maxJumpVisited: parseInt(w.maxJumpVisited) || 0
            },
          },
        });
      }
    }
  }

  if (actorDataArray.length > 0) {
    try {
      const newActors = await Actor.createDocuments(actorDataArray);
      finalActors.push(...newActors);
      if (cacheJournal) {
        for (const actor of newActors) {
          const subKey = actor.getFlag('twodsix', 'subsectorKey');
          if (subKey) {
            const hex = actor.getFlag('twodsix', 'locationCoordinate');
            if (!cacheUpdates.has(subKey)) {
              cacheUpdates.set(subKey, new Set());
            }
            cacheUpdates.get(subKey).add(hex);
          }
        }
      }
    } catch (err) {
      console.error('Failed to create world actors:', err);
      ui.notifications.error('Error creating world actors. Check console for details.');
      return finalActors;
    }
  }

  // Batch cache updates
  if (cacheJournal && cacheUpdates.size > 0) {
    const { CACHE_KEY_WORLDS, getCachedData, setCachedData } = await import('./TravellerMapCache.js');
    const allWorlds = await getCachedData(cacheJournal, CACHE_KEY_WORLDS) ?? {};
    let changed = false;

    for (const [subKey, hexes] of cacheUpdates) {
      const worlds = allWorlds[subKey];
      if (worlds) {
        for (const hex of hexes) {
          const world = worlds.find(w => w.hex === hex || w.globalHex === hex);
          if (world && !world.hasFoundryWorld) {
            world.hasFoundryWorld = true;
            changed = true;
          }
        }
      }
    }

    if (changed) {
      await setCachedData(cacheJournal, CACHE_KEY_WORLDS, allWorlds);
    }
  }

  return finalActors;
}

/**
 * Ensure that the subsector containing the given hex and all its neighboring subsectors
 * are loaded and created as actors in Foundry.
 * @param {import('./TraderState.js').TraderState} state - Trader state to update with loaded keys
 * @param {string} sectorName - Current sector name
 * @param {string} localHex - Current hex (e.g. "1910")
 * @param {string} milieu - Current milieu
 * @param {JournalEntry} cacheJournal - Cache journal
 * @returns {Promise<import('../../entities/TwodsixActor').default[]>} All worlds in the loaded subsectors
 */
export async function ensureSubsectorNeighborsLoaded(state, sectorName, localHex, milieu, cacheJournal) {
  if (!state.sectors || state.sectors.length === 0) {
    console.warn('ensureSubsectorNeighborsLoaded: No sectors list in state');
    return [];
  }

  const startSector = state.sectors.find(s => s.name === sectorName);
  if (!startSector) {
    console.warn(`ensureSubsectorNeighborsLoaded: Sector ${sectorName} not found`);
    return [];
  }

  const subsectorsToSearch = getNeighboringSubsectors(startSector, localHex, state.sectors);

  // Initialize loaded keys if missing
  if (!state.loadedSubsectorKeys) {
    state.loadedSubsectorKeys = [];
  }

  const subsectorsToLoad = [];
  for (const target of subsectorsToSearch) {
    const subIndex = target.subY * SECTOR_WIDTH_IN_SUBSECTORS + target.subX;
    const subLetter = SUBSECTOR_LETTERS[subIndex];
    if (!subLetter) {
      continue;
    }

    const subKey = buildSubsectorKey(target.sectorName, subLetter, milieu);
    if (hasLoadedSubsectorKey(state, subKey, target)) {
      continue;
    }

    const subs = await loadSubsectorsWithCache(target.sectorName, cacheJournal, milieu);
    if (subs) {
      const sub = subs.find(s => s.letter === subLetter);
      if (sub) {
        subsectorsToLoad.push({
          sectorName: target.sectorName,
          subsectorLetter: sub.letter,
          subsectorName: sub.name,
          sectorCoords: { x: target.sx, y: target.sy, sx: target.sx, sy: target.sy },
          subKey
        });
      }
    }
  }

  if (subsectorsToLoad.length === 0) {
    traderDebug('SubsectorLoader', `All required subsectors already loaded for ${sectorName} ${localHex}.`);
    return [];
  }

  traderDebug('SubsectorLoader', `Loading ${subsectorsToLoad.length} neighboring subsectors...`);
  let allWorldData = [];
  for (const sub of subsectorsToLoad) {
    try {
      traderDebug('SubsectorLoader', `Loading subsector: ${sub.sectorName} ${sub.subsectorLetter} (${sub.subsectorName})...`);
      const subData = await loadSubsector(sub.sectorName, sub.subsectorLetter, milieu, cacheJournal, sub.sectorCoords);
      allWorldData = allWorldData.concat(subData);
      if (!state.loadedSubsectorKeys.includes(sub.subKey)) {
        state.loadedSubsectorKeys.push(sub.subKey);
      }
    } catch (e) {
      console.warn(`Twodsix | SubsectorLoader | Failed to load subsector ${sub.subsectorName} in ${sub.sectorName}:`, e);
    }
  }

  if (!allWorldData.length) {
    traderDebug('SubsectorLoader', `No world data found in any of the ${subsectorsToLoad.length} subsectors.`);
    return [];
  }

  traderDebug('SubsectorLoader', `Total worlds gathered from ${subsectorsToLoad.length} subsectors: ${allWorldData.length}. Creating actors...`);
  // Determine starting global hex for the center of these subsectors (optional, but good for context)
  const startSectorCoords = { x: startSector.sx, y: startSector.sy, sx: startSector.sx, sy: startSector.sy };
  const startGlobalHex = buildGlobalHex(startSectorCoords, localHex);

  return createWorldActors(allWorldData, startGlobalHex, cacheJournal);
}

/**
 * Load worlds from existing Foundry folders for the given sectors.
 * @param {Array<string>} sectorNames - List of sector names to look up
 * @returns {import('../../entities/TwodsixActor').default[]} World Actor documents
 */
export function loadWorldsFromSectors(sectorNames) {
  const worlds = sectorNames.flatMap(name => {
    const folders = game.folders.filter(f => f.name === name && f.type === 'Actor');
    return folders.flatMap(folder => collectWorldsFromFolder(folder));
  });
  return deduplicateWorlds(worlds);
}

/**
 * Merge canonical subsector cache keys from world actors (twodsix.subsectorKey flag).
 * Used so loadedSubsectorKeys only reflects subsectors that actually have data/actors,
 * not the full 3x3 grid of interest.
 * @param {string[]|null|undefined} baseKeys
 * @param {import('../../entities/TwodsixActor').default[]} worlds
 * @returns {string[]}
 */
export function mergeLoadedSubsectorKeysFromActors(baseKeys, worlds) {
  const set = new Set(baseKeys || []);
  for (const w of worlds || []) {
    const k = typeof w.getFlag === 'function' ? w.getFlag('twodsix', 'subsectorKey') : null;
    if (k) {
      set.add(k);
    }
  }
  return [...set];
}

/**
 * Consolidated way to find worlds within jump range.
 * Tries fetchJumpWorlds (API) first. If it returns no worlds (and it's not a local worlds trading journey)
 * it falls back to checking the Journal cache and then finally filtering local actors.
 * @param {import('./TraderState.js').TraderState} s - TraderState
 * @param {JournalEntry} [journal] - Optional cache journal
 * @returns {Promise<import('../../entities/TwodsixActor').default[]>}
 */
export async function getReachableWorlds(s, journal = null) {
  const currentHex = s.currentWorldHex;
  const jump = s.ship.jumpRating;

  if (!isLocalMode(s)) {
    let sectorName = s.sectorName;
    let localHex = getLocalHex(currentHex);

    const currentWorld = s.worlds.find(w => getWorldCoordinate(w) === currentHex);
    if (currentWorld) {
      const coordParts = (currentWorld.system?.coordinates?.trim() || '').split(/\s+/) || [];
      const sName = coordParts.length >= 2 ? coordParts.slice(0, -1).join(' ') : '';
      const lastPart = coordParts.length >= 2 ? coordParts.at(-1) : '';
      const fromCoords = (lastPart?.length === 4 && !isNaN(parseInt(lastPart, 10))) ? lastPart : '';
      if (sName) {
        sectorName = sName;
      }
      const flagCoord = currentWorld.getFlag('twodsix', 'locationCoordinate') || '';
      localHex = fromCoords || getLocalHex(flagCoord) || getLocalHex(currentHex);
    }

    if (sectorName && localHex) {
      try {
        const sectorRow = s.sectors?.find(sec => sec.name === sectorName);
        const sectorCoords = sectorRow
          ? { x: sectorRow.sx, y: sectorRow.sy, sx: sectorRow.sx, sy: sectorRow.sy }
          : null;
        const reachableWorldsData = await fetchJumpWorlds(sectorName, localHex, jump, s.milieu || 'M1105', sectorCoords);
        if (reachableWorldsData.length > 0) {
          const newActors = await createWorldActors(reachableWorldsData, currentHex, journal);
          for (const actor of newActors) {
            if (!s.worlds.some(w => w.id === actor.id)) {
              s.worlds.push(actor);
            }
          }
          return worldsInJumpRange(currentHex, jump, s.worlds);
        }
      } catch (e) {
        console.error('Trader: Failed to fetch reachable worlds from API:', e);
      }
    }

    // 2. Fallback to Journal Cache if API failed/returned nothing
    if (s.cacheJournalName) {
      const cacheJournal = journal || await getOrCreateCacheJournal(s.cacheJournalName);
      if (cacheJournal) {
        const allWorldsCache = await getCachedData(cacheJournal, CACHE_KEY_WORLDS) ?? {};
        const nearbyWorlds = [];
        for (const subKey in allWorldsCache) {
          const worlds = allWorldsCache[subKey];
          for (const w of worlds) {
            const targetHex = w.globalHex || w.hex;
            if (targetHex !== currentHex && hexDistance(currentHex, targetHex) <= jump) {
              w.subsectorKey = subKey;
              nearbyWorlds.push(w);
            }
          }
        }
        if (nearbyWorlds.length > 0) {
          const newActors = await createWorldActors(nearbyWorlds, currentHex, cacheJournal);
          for (const na of newActors) {
            if (!s.worlds.find(w => w.id === na.id)) {
              s.worlds.push(na);
            }
          }
          return worldsInJumpRange(currentHex, jump, s.worlds);
        }
      }
    }
  }

  // 3. Fallback/Local mode: filter state.worlds
  return worldsInJumpRange(currentHex, jump, s.worlds);
}
