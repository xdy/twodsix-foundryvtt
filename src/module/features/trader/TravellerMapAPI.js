/**
 * TravellerMapAPI.js
 * Fetches data from TravellerMap API with caching support.
 */

import {
  buildFeatures,
  buildGlobalHex,
  getTimestamp,
  normalizeZone,
  parseTabDelimited,
  parseUWP
} from './TraderUtils.js';
import {
  buildSubsectorKey,
  getCachedSubsectors,
  getCachedWorlds,
  getOrCreateCacheJournal,
  setCachedSubsectors
} from './TravellerMapCache.js';

/**
 * Helper for fetching with an AbortController timeout.
 * @param {string} url - The URL to fetch
 * @param {object} [options] - Options for fetch, including timeoutMs
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}) {
  const { timeoutMs = 30000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new Error(`Travellermap.com request timed out after ${timeoutMs / 1000} seconds.`);
    }
    throw e;
  }
}

/**
 * Fetch with cache wrapper for subsectors.
 * @param {string} sectorName
 * @param {JournalEntry} cacheJournal
 * @param {string} milieu
 * @returns {Promise<import('./TraderState.js').Subsector[]|null>}
 */
export async function loadSubsectorsWithCache(sectorName, cacheJournal = null, milieu = 'M1105') {
  if (cacheJournal) {
    const cached = await getCachedSubsectors(cacheJournal, sectorName, milieu);
    if (cached) {
      console.log(`Twodsix | TravellerMapAPI | [${getTimestamp()}] Using cached subsectors for ${sectorName} (${milieu}): ${cached.length} subsectors found.`);
      return cached;
    }
  }

  console.log(`Twodsix | TravellerMapAPI | [${getTimestamp()}] Fetching subsectors for ${sectorName} from TravellerMap API...`);
  const subsectors = await fetchSubsectors(sectorName);
  if (cacheJournal && subsectors && subsectors.length > 0) {
    console.log(`Twodsix | TravellerMapAPI | [${getTimestamp()}] Caching ${subsectors.length} subsectors for ${sectorName} (${milieu}).`);
    await setCachedSubsectors(cacheJournal, sectorName, milieu, subsectors);
  }
  return subsectors;
}

/**
 * Check cache for a single world, then fallback to API.
 * @param {string} sectorName
 * @param {string} hex
 * @param {string} milieu
 * @param {import('./TraderState.js').SectorCoordinates} [sectorCoords]
 * @param {string} [cacheJournalName]
 * @returns {Promise<import('./TraderState.js').WorldData|null>}
 */
export async function fetchWorldWithCache(sectorName, hex, milieu = 'M1105', sectorCoords = null, cacheJournalName = 'TravellerMap Cache') {
  const cacheJournal = await getOrCreateCacheJournal(cacheJournalName);
  if (cacheJournal) {
    console.log(`Twodsix | TravellerMapAPI | [${getTimestamp()}] Searching for world ${sectorName} ${hex} in cache...`);
    // Try each subsector A-P in this sector
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'];
    for (const letter of letters) {
      const subKey = buildSubsectorKey(sectorName, letter, milieu);
      const worlds = await getCachedWorlds(cacheJournal, subKey);
      if (worlds) {
        const found = worlds.find(w => w.hex === hex);
        if (found) {
          console.log(`Twodsix | TravellerMapAPI | [${getTimestamp()}] Cache hit for world ${sectorName} ${hex} in subsector ${letter}.`);
          return found;
        }
      }
    }
    console.log(`Twodsix | TravellerMapAPI | [${getTimestamp()}] Cache miss for world ${sectorName} ${hex}.`);
  }

  return fetchWorldData(sectorName, hex, milieu, sectorCoords);
}

/**
 * Fetch all worlds within jump range of a given hex using the jumpworlds API.
 * @param {string} sectorName - Name of the sector
 * @param {string} hex - Hex coordinate (e.g. "1910")
 * @param {number} jump - Jump range (parsecs)
 * @param {string} milieu - Milieu to fetch (e.g. "M1105")
 * @param {import('./TraderState.js').SectorCoordinates} [sectorCoords] - Optional sector coordinates
 * @returns {Promise<import('./TraderState.js').WorldData[]>} Array of world data objects
 */
export async function fetchJumpWorlds(sectorName, hex, jump, milieu = 'M1105', sectorCoords = null) {
  const url = `https://travellermap.com/api/jumpworlds?sector=${encodeURIComponent(sectorName)}&hex=${encodeURIComponent(hex)}&jump=${jump}&milieu=${encodeURIComponent(milieu)}`;

  console.log(`Twodsix | TravellerMapAPI | [${getTimestamp()}] Fetching worlds within ${jump} parsecs of ${sectorName} ${hex}...`);
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch jump worlds: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const worldList = data?.Worlds || [];
  console.log(`Twodsix | TravellerMapAPI | [${getTimestamp()}] Received ${worldList.length} worlds from jumpworlds API.`);

  return worldList.map(worldData => {
    const uwp = worldData.UWP || '';
    const parsed = parseUWP(uwp);
    const pbg = worldData.PBG || '000';
    const tradeCodes = (worldData.Remarks || '').split(/\s+/).filter(Boolean);

    const world = {
      name: worldData.Name || worldData.Hex || 'Unknown',
      hex: worldData.Hex,
      sectorName: worldData.Sector || sectorName || '',
      uwp,
      ...parsed,
      tradeCodes,
      travelZone: normalizeZone(worldData.Zone),
      bases: worldData.Bases || '',
      populationModifier: parseInt(pbg.charAt(0)) || 0,
      numPlanetoidBelts: parseInt(pbg.charAt(1)) || 0,
      numGasGiants: parseInt(pbg.charAt(2)) || 0,
      features: buildFeatures(worldData.Bases || '', parseInt(pbg.charAt(2)) || 0, parseInt(pbg.charAt(1)) || 0),
      allegiance: worldData.Allegiance || '',
    };

    // TravellerMap's jumpworlds data actually includes X and Y (world-space).
    if (worldData.X !== undefined && worldData.Y !== undefined) {
      world.globalHex = `${worldData.X},${worldData.Y}`;
    } else if (sectorCoords && world.sectorName === sectorName) {
      world.globalHex = buildGlobalHex(sectorCoords, world.hex);
    }

    return world;
  });
}

/**
 * Fetch all sectors from TravellerMap API.
 * @param {string} milieu - Milieu to fetch (e.g. "M1105", "IW")
 * @returns {Promise<import('./TraderState.js').Sector[]>} Array of sector objects
 */
export async function fetchSectors(milieu = 'M1105') {
  const url = `https://travellermap.com/api/universe?milieu=${encodeURIComponent(milieu)}`;

  console.log(`Twodsix | TravellerMapAPI | [${getTimestamp()}] Fetching sectors for milieu ${milieu} from TravellerMap universe API...`);
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch sectors: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  // The API returns sectors in 'Sectors' property: { Sectors: [...] }
  const sectorList = data?.Sectors || (Array.isArray(data) ? data : []);
  console.log(`Twodsix | TravellerMapAPI | [${getTimestamp()}] Received ${sectorList.length} sectors from API.`);

  // Even with milieu=M1105, there might be entries with different Tags/Milieus if the API
  // doesn't filter strictly on the server side. Use unique coordinate-based keys as a safeguard.
  const uniqueSectors = new Map();

  for (const sector of sectorList) {
    const sx = sector.X ?? sector.x ?? 0;
    const sy = sector.Y ?? sector.y ?? 0;

    // Correct extraction of sector name from Names array
    let name = `Sector ${sx},${sy}`;
    if (sector.Names && Array.isArray(sector.Names) && sector.Names.length > 0) {
      const primaryName = sector.Names.find(n => !n.Lang) || sector.Names[0];
      name = primaryName.Text;
    } else if (sector.SectorName || sector.name) {
      name = sector.SectorName || sector.name;
    }

    const key = `${sx},${sy}`;
    // Prefer the requested milieu if multiple entries for the same coordinates exist (safeguard)
    const isPreferredMilieu = sector.Milieu === milieu;
    const isOfficial = sector.Tags && (sector.Tags.includes('Official OTU') || sector.Tags.includes('OTU Official'));
    const existing = uniqueSectors.get(key);
    if (!existing || isPreferredMilieu || (existing.Milieu !== milieu && isOfficial)) {
      uniqueSectors.set(key, {
        name,
        x: sx,
        y: sy,
        sx,
        sy,
        ...sector,
        Milieu: sector.Milieu || milieu,
      });
    }
  }

  return Array.from(uniqueSectors.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetch subsectors for a given sector from TravellerMap metadata API.
 * @param {string} sectorName - Name of the sector
 * @returns {Promise<import('./TraderState.js').Subsector[]|null>} Array of subsector objects or null if not found
 */
export async function fetchSubsectors(sectorName) {
  const url = `https://travellermap.com/api/metadata?sector=${encodeURIComponent(sectorName)}`;

  console.log(`Twodsix | TravellerMapAPI | [${getTimestamp()}] Fetching metadata for sector ${sectorName}...`);
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    if (response.status === 404) {
      console.log(`Twodsix | TravellerMapAPI | [${getTimestamp()}] Metadata not found for sector ${sectorName} (404).`);
      return null;
    }
    throw new Error(`Failed to fetch subsectors: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  // Metadata returns an array of sector results, usually the first one is our target
  const sectorData = Array.isArray(data) ? data[0] : data;
  if (!sectorData || !sectorData.Subsectors) {
    console.log(`Twodsix | TravellerMapAPI | [${getTimestamp()}] No subsectors found in metadata for sector ${sectorName}.`);
    return null;
  }

  console.log(`Twodsix | TravellerMapAPI | [${getTimestamp()}] Received ${sectorData.Subsectors.length} subsectors for sector ${sectorName}.`);
  return sectorData.Subsectors.map(sub => ({
    letter: sub.Index,
    name: sub.Name
  }));
}

/**
 * Get subsectors for a given sector.
 * @deprecated This function is unreliable as the /api/universe endpoint rarely includes
 * subsector data on individual sector entries. Use loadSubsectorsWithCache() instead.
 * @param {import('./TraderState.js').Sector[]} sectors - The cached/fetched sectors array
 * @param {string} sectorName - Name of the sector
 * @returns {import('./TraderState.js').Subsector[]|null} Array of subsector objects or null if not found
 */
export function getSubsectorsForSector(sectors, sectorName) {
  console.warn('Twodsix | getSubsectorsForSector is unreliable — prefer loadSubsectorsWithCache().');
  if (!sectors || !Array.isArray(sectors)) {
    return null;
  }

  const sector = sectors.find(s => s.name === sectorName);
  if (!sector) {
    return null;
  }

  // Sectors have Subsectors property with letters and names
  // The structure from TravellerMap API includes a 'Subsectors' object with A-P keys
  const subsectors = [];

  // Common subsector letters A-P
  const letters = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
    'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'
  ];

  // Try Subsectors array or Subsectors object or legacy subsector_X
  const subsectorData = sector.Subsectors;
  if (Array.isArray(subsectorData)) {
    for (const sub of subsectorData) {
      if (sub.Index && sub.Name) {
        subsectors.push({ letter: sub.Index, name: sub.Name });
      }
    }
  } else if (subsectorData && typeof subsectorData === 'object') {
    for (const letter of letters) {
      const subsectorName = subsectorData[letter] || sector[`subsector_${letter}`];
      if (subsectorName) {
        subsectors.push({ letter, name: subsectorName });
      }
    }
  }

  return subsectors.length > 0 ? subsectors : null;
}

/**
 * Fetch worlds for a specific subsector using existing loadSubsector logic.
 * This function wraps the existing API call pattern but returns raw data.
 * @param {string} sectorName
 * @param {string} subsectorLetter
 * @param {string} milieu
 * @param {import('./TraderState.js').SectorCoordinates} [sectorCoords] - Optional sector coordinates
 * @returns {Promise<import('./TraderState.js').WorldData[]>} Array of world data objects
 */
export async function fetchWorlds(sectorName, subsectorLetter, milieu = 'M1105', sectorCoords = null) {
  const url = `https://travellermap.com/api/sec?sector=${encodeURIComponent(sectorName)}&subsector=${encodeURIComponent(subsectorLetter)}&milieu=${encodeURIComponent(milieu)}&type=TabDelimited`;

  console.log(`Twodsix | TravellerMapAPI | [${getTimestamp()}] Fetching worlds for ${sectorName} ${subsectorLetter} (${milieu})...`);
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch subsector data: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  const worlds = parseTabDelimited(text, sectorName, sectorCoords);
  console.log(`Twodsix | TravellerMapAPI | [${getTimestamp()}] Parsed ${worlds.length} worlds for ${sectorName} ${subsectorLetter}.`);
  return worlds;
}

/**
 * Fetch data for a specific world hex from TravellerMap API.
 * @param {string} sectorName - Name of the sector
 * @param {string} hex - Hex coordinate (e.g. "1910")
 * @param {string} milieu - Milieu to fetch (e.g. "M1105")
 * @param {import('./TraderState.js').SectorCoordinates} [sectorCoords] - Optional sector coordinates
 * @returns {Promise<import('./TraderState.js').WorldData|null>} World data object or null if not found
 */
export async function fetchWorldData(sectorName, hex, milieu = 'M1105', sectorCoords = null) {
  // Using the /data/ endpoint for single world lookups, as /api/sec with hex parameter
  // incorrectly returns the entire sector in some cases.
  const params = { milieu };
  const url = `https://travellermap.com/data/${encodeURIComponent(sectorName)}/${encodeURIComponent(hex)}?milieu=${encodeURIComponent(milieu)}`;

  console.log(`Twodsix | TravellerMapAPI | [${getTimestamp()}] Fetching data for world ${sectorName} ${hex}...`);
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    if (response.status === 404) {
      console.log(`Twodsix | TravellerMapAPI | [${getTimestamp()}] World ${sectorName} ${hex} not found (404).`);
      return null;
    }
    const errorBody = await response.text().catch(() => 'No response body');
    console.error(`Twodsix | TravellerMapAPI | [${getTimestamp()}] Failed to fetch world data:`, {
      url,
      params: `keys: ${Object.keys(params).length}`,
      status: response.status,
      statusText: response.statusText,
      error: errorBody
    });
    throw new Error(`Failed to fetch world data: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.Worlds || data.Worlds.length === 0) {
    console.log(`Twodsix | TravellerMapAPI | [${getTimestamp()}] World ${sectorName} ${hex} data empty.`);
    return null;
  }

  const worldData = data.Worlds[0];
  console.log(`Twodsix | TravellerMapAPI | [${getTimestamp()}] Found data for ${worldData.Name || worldData.Hex}.`);
  const uwp = worldData.UWP || '';

  const parsed = parseUWP(uwp);
  const pbg = worldData.PBG || '000';
  const tradeCodes = (worldData.Remarks || '').split(/\s+/).filter(Boolean);

  const world = {
    name: worldData.Name || worldData.Hex || 'Unknown',
    hex: worldData.Hex,
    sectorName: sectorName || worldData.Sector || '',
    uwp,
    ...parsed,
    tradeCodes,
    travelZone: normalizeZone(worldData.Zone),
    bases: worldData.Bases || '',
    populationModifier: parseInt(pbg.charAt(0)) || 0,
    numPlanetoidBelts: parseInt(pbg.charAt(1)) || 0,
    numGasGiants: parseInt(pbg.charAt(2)) || 0,
    features: buildFeatures(worldData.Bases || '', parseInt(pbg.charAt(2)) || 0, parseInt(pbg.charAt(1)) || 0),
    allegiance: worldData.Allegiance || '',
  };

  if (worldData.X !== undefined && worldData.Y !== undefined) {
    world.globalHex = `${worldData.X},${worldData.Y}`;
  } else if (sectorCoords) {
    world.globalHex = buildGlobalHex(sectorCoords, worldData.Hex);
  }

  return world;
}
