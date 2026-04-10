/**
 * TravellerMapCache.js
 * Manages caching of TravellerMap API responses in a Journal Entry.
 * Caches sectors list, subsectors per sector, and worlds per subsector.
 */

const CACHE_FLAGS_NAMESPACE = 'twodsix';
const CACHE_KEY_SECTORS = 'travellerMapSectors';
const CACHE_KEY_SUBSECTORS = 'travellerMapSubsectors';
export const CACHE_KEY_WORLDS = 'travellerMapWorlds';
const CACHE_KEY_LAST_UPDATED = 'travellerMapLastUpdated';

/**
 * Compress data using CompressionStream.
 * @param {any} data
 * @returns {Promise<string>} - Base64 encoded compressed string
 */
async function compressData(data) {
  const jsonString = JSON.stringify(data);
  const stream = new Blob([jsonString]).stream()
    .pipeThrough(new CompressionStream('gzip'));
  const response = new Response(stream);
  const blob = await response.blob();
  const buffer = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decompress data using DecompressionStream.
 * @param {string} base64Data
 * @returns {Promise<any>}
 */
async function decompressData(base64Data) {
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const stream = new Blob([bytes]).stream()
    .pipeThrough(new DecompressionStream('gzip'));
  const response = new Response(stream);
  const blob = await response.blob();
  const jsonString = await blob.text();
  return JSON.parse(jsonString);
}

/**
 * Find the cache journal by name, or return null if not found.
 * @param {string} journalName
 * @returns {JournalEntry|null}
 */
export function findCacheJournal(journalName) {
  if (!journalName) {
    return null;
  }
  return game.journal.find(j => j.name.toLowerCase() === journalName.toLowerCase());
}

/** Serializes concurrent creation requests per journal name to prevent duplicate journals. */
const journalCreationLocks = new Map();

/**
 * Get or create the cache journal.
 * If the journal doesn't exist, create it with the given name.
 * Concurrent calls with the same name are serialized so only one journal is created.
 * @param {string} [journalName]
 * @returns {Promise<JournalEntry>}
 */
export async function getOrCreateCacheJournal(journalName) {
  if (!journalName) {
    journalName = 'TraderTravellermapCache';
  }

  // Fast path: journal already exists
  let journal = findCacheJournal(journalName);
  if (journal) {
    if (!journal.getFlag(CACHE_FLAGS_NAMESPACE, 'isCacheJournal')) {
      await journal.setFlag(CACHE_FLAGS_NAMESPACE, 'isCacheJournal', true);
    }
    return journal;
  }

  // Slow path: serialize creation so concurrent callers don't each create their own
  if (!journalCreationLocks.has(journalName)) {
    journalCreationLocks.set(journalName, (async () => {
      try {
        // Re-check inside the lock — a concurrent caller may have created it while we awaited
        journal = findCacheJournal(journalName);
        if (!journal) {
          journal = await JournalEntry.create({ name: journalName });
          await journal.setFlag(CACHE_FLAGS_NAMESPACE, 'isCacheJournal', true);
          await updateHumanReadableContent(journal);
        }
        return journal;
      } finally {
        journalCreationLocks.delete(journalName);
      }
    })());
  }

  return journalCreationLocks.get(journalName);
}

/**
 * Get the cache journal used for TravellerMap data.
 * First tries to find by the flag 'isCacheJournal'. If not found, prompts user.
 * @returns {Promise<JournalEntry|null>}
 */
export async function getCacheJournal() {
  // Find any journal marked as the cache journal
  const cachedJournal = game.journal.find(j => j.getFlag(CACHE_FLAGS_NAMESPACE, 'isCacheJournal'));
  if (cachedJournal) {
    return cachedJournal;
  }
  return null;
}

/**
 * Retrieve cached data of a specific type.
 * @param {JournalEntry} journal
 * @param {string} cacheKey - One of CACHE_KEY_SECTORS, CACHE_KEY_SUBSECTORS, CACHE_KEY_WORLDS
 * @returns {Promise<Array|Object|null>}
 */
export async function getCachedData(journal, cacheKey) {
  if (!journal) {
    return null;
  }
  try {
    const data = journal.getFlag(CACHE_FLAGS_NAMESPACE, cacheKey) ?? null;
    if (data && typeof data === 'string') {
      return await decompressData(data);
    }
    return data;
  } catch (e) {
    console.warn(`Failed to get cached data for key ${cacheKey}:`, e);
    return null;
  }
}

const writeQueue = new Map();

/**
 * Store data in the cache journal.
 * @param {JournalEntry} journal
 * @param {string} cacheKey
 * @param {any} data
 */
export async function setCachedData(journal, cacheKey, data) {
  if (!journal) {
    return;
  }

  // Use a simple per-journal queue to avoid race conditions during read-modify-write
  if (!writeQueue.has(journal.id)) {
    writeQueue.set(journal.id, Promise.resolve());
  }

  const task = writeQueue.get(journal.id).then(async () => {
    try {
      const compressedData = await compressData(foundry.utils.deepClone(data));
      await journal.setFlag(CACHE_FLAGS_NAMESPACE, cacheKey, compressedData);
      await journal.setFlag(CACHE_FLAGS_NAMESPACE, CACHE_KEY_LAST_UPDATED, Date.now());
      await updateHumanReadableContent(journal);
    } catch (e) {
      console.error(`Failed to set cached data for key ${cacheKey}:`, e);
    }
  });

  writeQueue.set(journal.id, task);
  return task;
}

/**
 * Get cached sectors list for a milieu.
 * @param {JournalEntry} journal
 * @param {string} milieu
 * @returns {Promise<import('./TraderState.js').Sector[]|null>}
 */
export async function getCachedSectors(journal, milieu = 'M1105') {
  const allSectors = await getCachedData(journal, CACHE_KEY_SECTORS) ?? {};
  return allSectors[milieu] ?? null;
}

/**
 * Set cached sectors list for a milieu.
 * @param {JournalEntry} journal
 * @param {string} milieu
 * @param {import('./TraderState.js').Sector[]} sectors
 */
export async function setCachedSectors(journal, milieu, sectors) {
  const existing = await getCachedData(journal, CACHE_KEY_SECTORS) ?? {};
  existing[milieu] = sectors;
  await setCachedData(journal, CACHE_KEY_SECTORS, existing);
}

/**
 * Get cached subsectors for a sector (by sector name and milieu).
 * @param {JournalEntry} journal
 * @param {string} sectorName
 * @param {string} milieu
 * @returns {Promise<import('./TraderState.js').Subsector[]|null>}
 */
export async function getCachedSubsectors(journal, sectorName, milieu = 'M1105') {
  const allSubsectors = await getCachedData(journal, CACHE_KEY_SUBSECTORS) ?? {};
  return allSubsectors[`${milieu}_${sectorName}`] ?? null;
}

/**
 * Set cached subsectors for a sector.
 * @param {JournalEntry} journal
 * @param {string} sectorName
 * @param {string} milieu
 * @param {import('./TraderState.js').Subsector[]} subsectors
 */
export async function setCachedSubsectors(journal, sectorName, milieu = 'M1105', subsectors) {
  const existing = await getCachedData(journal, CACHE_KEY_SUBSECTORS) ?? {};
  existing[`${milieu}_${sectorName}`] = subsectors;
  await setCachedData(journal, CACHE_KEY_SUBSECTORS, existing);
}

/**
 * Get cached worlds for a subsector key (e.g., "Spinward Marches_C").
 * @param {JournalEntry} journal
 * @param {string} subsectorKey
 * @returns {Promise<import('./TraderState.js').WorldData[]|null>}
 */
export async function getCachedWorlds(journal, subsectorKey) {
  const allWorlds = await getCachedData(journal, CACHE_KEY_WORLDS) ?? {};
  return allWorlds[subsectorKey] ?? null;
}

/**
 * Set cached worlds for a subsector.
 * Caches all world data needed to create World actors.
 * @param {JournalEntry} journal
 * @param {string} subsectorKey
 * @param {import('./TraderState.js').WorldData[]} worlds
 */
export async function setCachedWorlds(journal, subsectorKey, worlds) {
  const existing = await getCachedData(journal, CACHE_KEY_WORLDS) ?? {};
  // Cache all fields needed for actor creation
  existing[subsectorKey] = worlds.map(w => ({
    name: w.name,
    hex: w.hex,
    uwp: w.uwp,
    starport: w.starport,
    size: w.size,
    atmosphere: w.atmosphere,
    hydrographics: w.hydrographics,
    population: w.population,
    government: w.government,
    lawLevel: w.lawLevel,
    techLevel: w.techLevel,
    tradeCodes: w.tradeCodes,
    travelZone: w.travelZone,
    features: w.features,
    populationModifier: w.populationModifier,
    numPlanetoidBelts: w.numPlanetoidBelts,
    numGasGiants: w.numGasGiants,
    globalHex: w.globalHex || '',
    allegiance: w.allegiance,
    hasFoundryWorld: !!w.hasFoundryWorld,
    isVisited: !!w.isVisited,
    maxJumpVisited: parseInt(w.maxJumpVisited) || 0,
  }));
  await setCachedData(journal, CACHE_KEY_WORLDS, existing);
}

/**
 * Update the maxJumpVisited field for a specific world in the cache.
 * @param {JournalEntry} journal
 * @param {string} subsectorKey
 * @param {string} hex - Local or global hex coordinate
 * @param {number} jumpRange - New jump range record
 */
export async function updateCachedWorldMaxJump(journal, subsectorKey, hex, jumpRange) {
  const allWorlds = await getCachedData(journal, CACHE_KEY_WORLDS) ?? {};
  const worlds = allWorlds[subsectorKey];
  if (!worlds) {
    return;
  }
  const world = worlds.find(w => w.hex === hex || w.globalHex === hex);
  if (world) {
    world.maxJumpVisited = Math.max(world.maxJumpVisited || 0, jumpRange);
    await setCachedData(journal, CACHE_KEY_WORLDS, allWorlds);
  }
}

/**
 * Update the hasFoundryWorld flag for a specific world in the cache.
 * @param {JournalEntry} journal
 * @param {string} subsectorKey
 * @param {string} hex - Local or global hex coordinate
 * @param {boolean} status - New status
 */
export async function updateCachedWorldFoundryStatus(journal, subsectorKey, hex, status) {
  const allWorlds = await getCachedData(journal, CACHE_KEY_WORLDS) ?? {};
  const worlds = allWorlds[subsectorKey];
  if (!worlds) {
    return;
  }
  const world = worlds.find(w => w.hex === hex || w.globalHex === hex);
  if (world) {
    world.hasFoundryWorld = status;
    await setCachedData(journal, CACHE_KEY_WORLDS, allWorlds);
  }
}

/**
 * Build a unique key for subsector worlds cache.
 * @param {string} sectorName
 * @param {string} subsectorLetter
 * @param {string} milieu
 * @returns {string}
 */
export function buildSubsectorKey(sectorName, subsectorLetter, milieu = 'M1105') {
  return `${milieu}_${sectorName}_${subsectorLetter}`;
}

/**
 * Update the isVisited flag for a specific world in the cache.
 * @param {JournalEntry} journal
 * @param {string} subsectorKey
 * @param {string} hex - Local or global hex coordinate
 * @param {boolean} status - New status
 */
export async function updateCachedWorldVisitedStatus(journal, subsectorKey, hex, status) {
  const allWorlds = await getCachedData(journal, CACHE_KEY_WORLDS) ?? {};
  const worlds = allWorlds[subsectorKey];
  if (!worlds) {
    return;
  }
  const world = worlds.find(w => w.hex === hex || w.globalHex === hex);
  if (world) {
    world.isVisited = status;
    await setCachedData(journal, CACHE_KEY_WORLDS, allWorlds);
  }
}

/**
 * Update the journal entry's human-readable content with a summary of the cached data.
 * @param {JournalEntry} journal
 */
export async function updateHumanReadableContent(journal) {
  if (!journal) {
    return;
  }
  const lastUpdated = await getCachedData(journal, CACHE_KEY_LAST_UPDATED);
  const milieuSectors = await getCachedData(journal, CACHE_KEY_SECTORS) ?? {};
  const sectorSubsectors = await getCachedData(journal, CACHE_KEY_SUBSECTORS) ?? {};
  const subsectorWorlds = await getCachedData(journal, CACHE_KEY_WORLDS) ?? {};

  const context = {
    lastUpdated: lastUpdated ? new Date(lastUpdated).toLocaleString() : null,
    milieux: Object.keys(milieuSectors).map(m => ({
      name: m,
      sectors: (milieuSectors[m] || []).map(s => ({ name: s.name, abbreviation: s.abbreviation || '' }))
    })),
    sectors: Object.keys(sectorSubsectors).map(name => ({
      name,
      subsectors: (sectorSubsectors[name] || []).map(ss => {
        const subKeyEnding = `_${name}_${ss.letter}`;
        const subKey = Object.keys(subsectorWorlds).find(k => k.endsWith(subKeyEnding)) || `${name}_${ss.letter}`;
        return {
          letter: ss.letter,
          name: ss.name,
          worldCount: subsectorWorlds[subKey]?.length || 0
        };
      })
    })),
    subsectors: Object.keys(subsectorWorlds).sort().map(key => ({
      key,
      worlds: subsectorWorlds[key] || []
    })),
    hasAnyData: false
  };

  context.hasAnyData = context.milieux.length > 0 || context.sectors.length > 0 || context.subsectors.length > 0;

  // Avoid unnecessary updates if the journal is not currently open or if we want to save performance
  // For now, we'll just keep it but we could add a check here if needed.

  const content = await foundry.applications.handlebars.renderTemplate(
    'systems/twodsix/templates/trader/trader-cache-dump.hbs',
    context
  );

  try {
    const page = journal.pages.find(p => p.name === 'Cache Summary');
    if (page) {
      await page.update({ "text.content": content });
    } else {
      await journal.createEmbeddedDocuments("JournalEntryPage", [{
        name: 'Cache Summary',
        type: 'text',
        text: { content, format: 1 }
      }]);
    }
  } catch (e) {
    console.error('Failed to update journal content:', e);
  }
}
