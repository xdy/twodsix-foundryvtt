/**
 * TraderUtils.js
 * Common parsing and coordinate utilities for the trading feature.
 */

import {
  SECTOR_HEIGHT_IN_HEXES,
  SECTOR_HEIGHT_IN_SUBSECTORS,
  SECTOR_WIDTH_IN_HEXES,
  SECTOR_WIDTH_IN_SUBSECTORS,
  SUBSECTOR_HEIGHT,
  SUBSECTOR_WIDTH
} from './TraderConstants.js';

/**
 * Parse a UWP string into individual components.
 * UWP format: "A788899-C" — Starport Size Atmo Hydro Pop Gov Law - Tech
 * @param {string} uwp
 * @returns {object} Parsed UWP components
 */
export function parseUWP(uwp) {
  if (!uwp || uwp.length < 9) {
    return {
      starport: 'X', size: '0', atmosphere: '0', hydrographics: '0',
      population: '0', government: '0', lawLevel: '0', techLevel: '0',
    };
  }
  return {
    starport: uwp.charAt(0).toUpperCase(),
    size: uwp.charAt(1).toUpperCase(),
    atmosphere: uwp.charAt(2).toUpperCase(),
    hydrographics: uwp.charAt(3).toUpperCase(),
    population: uwp.charAt(4).toUpperCase(),
    government: uwp.charAt(5).toUpperCase(),
    lawLevel: uwp.charAt(6).toUpperCase(),
    techLevel: uwp.charAt(8).toUpperCase(), // skip dash at position 7
  };
}

/**
 * Normalize travel zone string.
 * @param {string} zone
 * @returns {string} 'Green', 'Amber', or 'Red'
 */
export function normalizeZone(zone) {
  const z = (zone || '').trim().toUpperCase();
  if (z === 'A' || z === 'AMBER') {
    return 'Amber';
  }
  if (z === 'R' || z === 'RED') {
    return 'Red';
  }
  return 'Green';
}

/**
 * Build features array from bases and PBG data.
 * @param {string} bases - Base codes (N=Naval, S=Scout, P=Pirate)
 * @param {number} gasGiants - Number of gas giants
 * @param {number} belts - Number of planetoid belts
 * @returns {Array<string>} Feature strings
 */
export function buildFeatures(bases, gasGiants, belts) {
  const features = [];
  if (bases.includes('N')) {
    features.push('navalBase');
  }
  if (bases.includes('S')) {
    features.push('scoutBase');
  }
  if (bases.includes('P')) {
    features.push('pirateBase');
  }
  if (gasGiants > 0) {
    features.push('gasGiant');
  }
  if (belts > 0) {
    features.push('planetoidBelt');
  }
  return features;
}

/**
 * Parse tab-delimited Traveller Map API response into world records.
 * @param {string} rawText - Tab-delimited text from the API
 * @param {string} [sectorName] - Optional name of the sector
 * @param {import('./TraderState.js').SectorCoordinates} [sectorCoords] - Optional sector coordinates
 * @returns {import('./TraderState.js').WorldData[]} Array of world data objects
 */
export function parseTabDelimited(rawText, sectorName = null, sectorCoords = null) {
  const lines = rawText.trim().split('\n');
  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split('\t').map(h => h.trim());
  const worlds = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t').map(c => c.trim());
    if (cols.length < 2) {
      continue;
    }

    const record = {};
    headers.forEach((h, idx) => {
      record[h] = cols[idx] || '';
    });

    const uwp = record['UWP'] || record['UPP'] || '';
    const parsed = parseUWP(uwp);
    const pbg = record['PBG'] || record['{Ix}']?.replace(/[{}]/g, '') || '000';
    const tradeCodes = (record['Remarks'] || record['Trade Codes'] || '').split(/\s+/).filter(Boolean);
    const zone = record['Zone'] || record['{Ix}'] || '';
    const bases = record['Bases'] || '';

    const hex = record['Hex'] || '';
    const world = {
      name: record['Name'] || record['Hex'] || 'Unknown',
      hex,
      sectorName: sectorName || record['Sector'] || '',
      uwp,
      ...parsed,
      tradeCodes,
      travelZone: normalizeZone(zone),
      bases,
      populationModifier: parseInt(pbg.charAt(0)) || 0,
      numPlanetoidBelts: parseInt(pbg.charAt(1)) || 0,
      numGasGiants: parseInt(pbg.charAt(2)) || 0,
      features: buildFeatures(bases, parseInt(pbg.charAt(2)) || 0, parseInt(pbg.charAt(1)) || 0),
      allegiance: record['Allegiance'] || record['A'] || '',
    };

    if (sectorCoords && hex) {
      world.globalHex = buildGlobalHex(sectorCoords, hex);
    }

    worlds.push(world);
  }

  return worlds;
}

/**
 * Build a global coordinate string for cross-sector distance calculations.
 * Aligns with TravellerMap's World-Space coordinates (relative to Core 0140).
 * @param {import('./TraderState.js').SectorCoordinates} sectorCoords - Sector coordinates
 * @param {string} localHex - Hex string "XXYY" (hx, hy)
 * @returns {string} Global hex coordinate "GXGY"
 */
export function buildGlobalHex(sectorCoords, localHex) {
  const [hx, hy] = parseHex(localHex);
  const sx = sectorCoords.x ?? sectorCoords.sx ?? 0;
  const sy = sectorCoords.y ?? sectorCoords.sy ?? 0;

  // TravellerMap world-space coordinates (x, y)
  // x = (sx - 0) * SECTOR_WIDTH_IN_HEXES + (hx - 1)
  // y = (sy - 0) * SECTOR_HEIGHT_IN_HEXES + (hy - 1)
  const globalX = (sx * SECTOR_WIDTH_IN_HEXES) + (hx - 1);
  const globalY = (sy * SECTOR_HEIGHT_IN_HEXES) + (hy - 1);

  // We'll return a string representation "X,Y" or similar that's easy to parse back
  return `${globalX},${globalY}`;
}

/**
 * Parse hex string into [x, y].
 * Supports "XXYY" (local), "GXGY" (padded 10-char), and "X,Y" (global-comma).
 * @param {string} hex
 * @returns {number[]} [x, y]
 */
export function parseHex(hex) {
  if (!hex || typeof hex !== 'string') {
    return [0, 0];
  }
  if (hex.includes(',')) {
    const parts = hex.split(',').map(Number);
    return [parts[0] || 0, parts[1] || 0];
  }
  if (hex.length >= 10 && !hex.includes(' ')) {
    const col = parseInt(hex.substring(0, 5));
    const row = parseInt(hex.substring(5, 10));
    return [col, row];
  }
  // Descriptive format: "Sector Name 1910" -> "1910"
  let h = hex;
  if (hex.includes(' ')) {
    const parts = hex.split(' ');
    const lastPart = parts[parts.length - 1];
    if (lastPart.length === 4 && !isNaN(parseInt(lastPart, 10))) {
      h = lastPart;
    }
  }
  const col = parseInt(h.substring(0, 2), 10);
  const row = parseInt(h.substring(2, 4), 10);
  return [col, row];
}

/**
 * Get the subsector indices [subX, subY] (0-3) from a local hex "XXYY".
 * @param {string} localHex
 * @returns {number[]} [subX, subY]
 */
export function getSubsectorIndices(localHex) {
  const [col, row] = parseHex(localHex);
  const subX = Math.floor((col - 1) / SUBSECTOR_WIDTH);
  const subY = Math.floor((row - 1) / SUBSECTOR_HEIGHT);
  return [subX, subY];
}

/**
 * Get the list of 9 neighboring subsectors (including the target) across sector boundaries.
 * @param {import('./TraderState.js').Sector} startSector - Current sector
 * @param {string} localHex - Current hex (e.g. "1910")
 * @param {import('./TraderState.js').Sector[]} allSectors - List of all sectors in the milieu
 * @returns {import('./TraderState.js').SubsectorSearchEntry[]} Array of subsector targets
 */
export function getNeighboringSubsectors(startSector, localHex, allSectors) {
  const [startSubX, startSubY] = getSubsectorIndices(localHex);
  const results = [];

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      let targetSubX = startSubX + dx;
      let targetSubY = startSubY + dy;
      let targetSX = startSector.sx;
      let targetSY = startSector.sy;

      // Wrap across sectors
      if (targetSubX < 0) {
        targetSX -= 1;
        targetSubX = SECTOR_WIDTH_IN_SUBSECTORS - 1;
      } else if (targetSubX >= SECTOR_WIDTH_IN_SUBSECTORS) {
        targetSX += 1;
        targetSubX = 0;
      }
      if (targetSubY < 0) {
        targetSY -= 1;
        targetSubY = SECTOR_HEIGHT_IN_SUBSECTORS - 1;
      } else if (targetSubY >= SECTOR_HEIGHT_IN_SUBSECTORS) {
        targetSY += 1;
        targetSubY = 0;
      }

      const targetSector = allSectors.find(s => s.sx === targetSX && s.sy === targetSY);
      if (targetSector) {
        if (!results.find(s => s.sx === targetSX && s.sy === targetSY && s.subX === targetSubX && s.subY === targetSubY)) {
          results.push({ sx: targetSX, sy: targetSY, subX: targetSubX, subY: targetSubY, sectorName: targetSector.name });
        }
      }
    }
  }
  return results;
}

/**
 * Calculate hex distance between two Traveller Map hex coordinates.
 * Supports local "XXYY" or global "X,Y" coordinates.
 * Uses axial coordinate conversion to robustly calculate distance for both positive
 * (local) and negative (global) Traveller Map coordinates (Odd-Q grid).
 * @param {string|Actor|object} hex1 - First hex coordinate or world object
 * @param {string|Actor|object} hex2 - Second hex coordinate or world object
 * @returns {number} Distance in parsecs (hexes)
 */
export function hexDistance(hex1, hex2) {
  const coord1 = (typeof hex1 === 'string') ? hex1 : getWorldCoordinate(hex1);
  const coord2 = (typeof hex2 === 'string') ? hex2 : getWorldCoordinate(hex2);

  const [x1, y1] = parseHex(coord1);
  const [x2, y2] = parseHex(coord2);

  // Convert Odd-Q (used by TravellerMap) to Axial coordinates
  // q = x
  // r = y - (x - (x & 1)) / 2
  // We use Math.floor and (abs(x) % 2) to ensure consistent behavior with negative coordinates
  const q1 = x1;
  const r1 = y1 - Math.floor((x1 - (Math.abs(x1) % 2)) / 2);
  const q2 = x2;
  const r2 = y2 - Math.floor((x2 - (Math.abs(x2) % 2)) / 2);

  const dq = q2 - q1;
  const dr = r2 - r1;

  // Axial distance formula: (abs(dq) + abs(dq + dr) + abs(dr)) / 2
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

/**
 * Extract refueling options for a world.
 * @param {object} world - World data or Actor
 * @returns {object} {starport, hasGasGiant, hasRefined, hasUnrefined}
 */
export function getRefuelOptions(world) {
  const w = world?.system || world;
  const starport = (w?.starport || 'X').toUpperCase();
  const hasGasGiant = (Number(w?.numGasGiants) > 0) || (Array.isArray(w?.features) && w.features.includes('gasGiant'));
  const hasRefined = ['A', 'B'].includes(starport);
  const hasUnrefined = ['A', 'B', 'C', 'D'].includes(starport);
  return { starport, hasGasGiant, hasRefined, hasUnrefined };
}

/**
 * Check if a world has any refueling options available.
 * @param {Actor|object} world - World Actor document or plain data object
 * @returns {boolean} True if refueling is possible
 */
export function canRefuelAtWorld(world) {
  const { hasGasGiant, hasUnrefined } = getRefuelOptions(world);
  return hasUnrefined || hasGasGiant;
}

/**
 * Get the location coordinate for a world Actor.
 * Prefers the 'locationCoordinate' flag, falls back to parsing the 'coordinates' system field.
 * @param {Actor|object} world - The world Actor or data object
 * @returns {string} Hex coordinate string (global or local)
 */
export function getWorldCoordinate(world) {
  if (!world) {
    return '';
  }
  // Try flag first
  const flag = (typeof world.getFlag === 'function') ? world.getFlag('twodsix', 'locationCoordinate') : world.flags?.twodsix?.locationCoordinate;
  if (flag) {
    return flag;
  }
  // Fallback to system coordinates
  return world.system?.coordinates || world.hex || '';
}
