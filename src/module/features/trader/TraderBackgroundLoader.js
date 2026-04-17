import { createWorldActors, loadSubsector, mergeLoadedSubsectorKeysFromActors } from './SubsectorLoader.js';
import { traderDebug } from './TraderUtils.js';

/**
 * Load neighboring subsectors without blocking initial journey startup.
 * @param {import('./TraderApp.js').TraderApp} app
 * @param {Array<{sectorName: string, subsectorLetter: string, subsectorName: string, sectorCoords: object}>} neighboringSubsectors
 * @param {{milieu?: string}} setupResult
 * @param {JournalEntry|null} cacheJournal
 * @param {string} startGlobalHex
 */
export async function loadNeighboringSubsectorsInBackground(
  app,
  neighboringSubsectors,
  setupResult,
  cacheJournal,
  startGlobalHex,
) {
  if (!neighboringSubsectors.length) {
    return;
  }

  try {
    const neighborWorldDataResults = await Promise.all(neighboringSubsectors.map(async (sub) => {
      try {
        traderDebug('TraderBackgroundLoader', `Background loading subsector: ${sub.subsectorName} (${sub.subsectorLetter}) in ${sub.sectorName}`);
        return await loadSubsector(sub.sectorName, sub.subsectorLetter, setupResult.milieu, cacheJournal, sub.sectorCoords);
      } catch (e) {
        console.warn(`Twodsix | TraderBackgroundLoader | Failed background load for ${sub.subsectorName}:`, e);
        return [];
      }
    }));

    const neighborWorldData = neighborWorldDataResults.flat();
    if (!neighborWorldData.length) {
      return;
    }

    traderDebug('TraderBackgroundLoader', `Background creation for ${neighborWorldData.length} world actors.`);
    const newWorlds = await createWorldActors(neighborWorldData, startGlobalHex, cacheJournal);

    if (!app.state) {
      return;
    }

    newWorlds.forEach(nw => {
      if (!app.state.worlds.find(w => w.id === nw.id)) {
        app.state.worlds.push(nw);
      }
    });

    neighboringSubsectors.forEach((sub, i) => {
      const data = neighborWorldDataResults[i];
      if (!Array.isArray(data) || data.length === 0) {
        return;
      }
      const key = `${sub.sectorName}:${sub.subsectorLetter}:${setupResult.milieu || 'M1105'}`;
      if (!app.state.loadedSubsectorKeys.includes(key)) {
        app.state.loadedSubsectorKeys.push(key);
      }
    });
    app.state.loadedSubsectorKeys = mergeLoadedSubsectorKeysFromActors(app.state.loadedSubsectorKeys, app.state.worlds);

    await app.flushSave();
    traderDebug('TraderBackgroundLoader', `Background loading complete. Added ${newWorlds.length} worlds.`);
    ui.notifications.info(game.i18n.format('TWODSIX.Trader.Messages.NeighboringSubsectorsLoaded', {
      count: newWorlds.length,
    }));
  } catch (err) {
    console.error('Twodsix | TraderBackgroundLoader | Background loading failed:', err);
  }
}
