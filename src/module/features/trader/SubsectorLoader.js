/**
 * SubsectorLoader.js
 * Fetches subsector data from the Traveller Map API, parses UWP data,
 * creates World actors, and provides hex distance calculations.
 */

import { SECTOR_WIDTH_IN_SUBSECTORS, } from './TraderConstants.js';
import { buildGlobalHex, getNeighboringSubsectors, parseUWP } from './TraderUtils.js';
import { fetchWorlds, loadSubsectorsWithCache } from './TravellerMapAPI.js';
import {
  buildSubsectorKey,
  getCachedWorlds,
  setCachedWorlds,
  updateCachedWorldFoundryStatus
} from './TravellerMapCache.js';

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
  const subKey = buildSubsectorKey(sectorName, subsectorLetter);
  const subsectorKey = `${milieu}:${subKey}`;

  // Check cache first if journal provided
  if (cacheJournal) {
    const cachedWorlds = await getCachedWorlds(cacheJournal, subsectorKey);
    if (cachedWorlds && cachedWorlds.length > 0) {
      console.log(`Using cached worlds for ${sectorName} ${subsectorLetter}`);
      // Ensure globalHex and sectorName are added/updated on cached worlds
      cachedWorlds.forEach(w => {
        if (!w.globalHex && w.hex && sectorCoords) {
          w.globalHex = buildGlobalHex(sectorCoords, w.hex);
        }
        if (!w.sectorName) {
          w.sectorName = sectorName;
        }
        w.subsectorKey = subsectorKey; // Tag for later cache update
      });
      return cachedWorlds;
    }
  }

  // Fetch from API
  const worldDataArray = await fetchWorlds(sectorName, subsectorLetter, milieu, sectorCoords);
  worldDataArray.forEach(w => w.subsectorKey = subsectorKey);

  // Store in cache if journal provided
  if (cacheJournal && worldDataArray.length > 0) {
    await setCachedWorlds(cacheJournal, subsectorKey, worldDataArray);
  }

  return worldDataArray;
}

/**
 * Create World actors in Foundry from parsed world data.
 * @param {import('./TraderState.js').WorldData[]} worldDataArray - Parsed world records
 * @param {string} [startGlobalHex] - Global hex of the starting world for distance filtering
 * @param {number} [range] - Jump range for filtering
 * @param {JournalEntry} [cacheJournal] - Optional cache journal to update status
 * @returns {Promise<import('../../entities/TwodsixActor').default[]>} Created/found world Actor documents
 */
export async function createWorldActors(worldDataArray, startGlobalHex = null, range = null, cacheJournal = null) {
  // Helper to find or create a sector folder
  async function getSectorFolder(sectorName) {
    const folderName = sectorName || 'Unknown Sector';
    let folder = game.folders.find(f => f.name === folderName && f.type === 'Actor');
    if (!folder) {
      folder = await Folder.create({ name: folderName, type: 'Actor' });
    }
    return folder;
  }

  // Filter worlds to within the ship's jump capacity of the starting world
  const filteredWorldData = worldDataArray;

  // Build actor creation data and find existing actors
  const actorDataArray = [];
  const finalActors = [];

  // Group worlds by sector to efficiently find existing actors in those folders
  const worldsBySector = {};
  for (const w of filteredWorldData) {
    const sName = w.sectorName || 'Unknown Sector';
    if (!worldsBySector[sName]) {
      worldsBySector[sName] = [];
    }
    worldsBySector[sName].push(w);
  }

  for (const [sectorName, worlds] of Object.entries(worldsBySector)) {
    const folder = await getSectorFolder(sectorName);
    const existingActors = folder.contents;

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
        if (cacheJournal && w.subsectorKey) {
          await updateCachedWorldFoundryStatus(cacheJournal, w.subsectorKey, w.hex || w.globalHex, true);
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
    const newActors = await Actor.createDocuments(actorDataArray);
    finalActors.push(...newActors);
    if (cacheJournal) {
      for (const actor of newActors) {
        const subKey = actor.getFlag('twodsix', 'subsectorKey');
        if (subKey) {
          const hex = actor.getFlag('twodsix', 'locationCoordinate');
          await updateCachedWorldFoundryStatus(cacheJournal, subKey, hex, true);
        }
      }
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

  const subsectorsToLoad = [];
  for (const target of subsectorsToSearch) {
    const subKey = `${target.sectorName}:${target.subX},${target.subY}`;
    if (state.loadedSubsectorKeys?.includes(subKey)) {
      continue;
    }

    const subs = await loadSubsectorsWithCache(target.sectorName, cacheJournal);
    if (subs) {
      const subIndex = target.subY * SECTOR_WIDTH_IN_SUBSECTORS + target.subX;
      const sub = subs[subIndex];
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
    return [];
  }

  let allWorldData = [];
  for (const sub of subsectorsToLoad) {
    try {
      const subData = await loadSubsector(sub.sectorName, sub.subsectorLetter, milieu, cacheJournal, sub.sectorCoords);
      allWorldData = allWorldData.concat(subData);
      if (!state.loadedSubsectorKeys.includes(sub.subKey)) {
        state.loadedSubsectorKeys.push(sub.subKey);
      }
    } catch (e) {
      console.warn(`Failed to load subsector ${sub.subsectorName} in ${sub.sectorName}:`, e);
    }
  }

  if (!allWorldData.length) {
    return [];
  }

  // Determine starting global hex for the center of these subsectors (optional, but good for context)
  const startSectorCoords = { x: startSector.sx, y: startSector.sy, sx: startSector.sx, sy: startSector.sy };
  const startGlobalHex = buildGlobalHex(startSectorCoords, localHex);

  return createWorldActors(allWorldData, startGlobalHex, range, cacheJournal);
}

/**
 * Load worlds from existing Foundry folders for the given sectors.
 * @param {Array<string>} sectorNames - List of sector names to look up
 * @returns {import('../../entities/TwodsixActor').default[]} World Actor documents
 */
export function loadWorldsFromSectors(sectorNames) {
  let allWorlds = [];
  for (const name of sectorNames) {
    const folder = game.folders.find(f => f.name === name && f.type === 'Actor');
    if (folder) {
      allWorlds = allWorlds.concat(folder.contents);
    }
  }
  return allWorlds;
}
