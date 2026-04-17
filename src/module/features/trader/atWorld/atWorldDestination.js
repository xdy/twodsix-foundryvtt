/**
 * Destination selection and reachable-world helpers.
 */

import { getReachableWorlds } from '../SubsectorLoader.js';
import { getWorldCache, subtractRevenue } from '../TraderState.js';
import {
  canAffordRefuelAtWorld,
  collectWorldsFromFolder,
  deduplicateWorlds,
  getWorldCoordinate,
  hexDistance,
  isLocalMode,
  worldsInJumpRange,
} from '../TraderUtils.js';

/**
 * @param {import('../../entities/TwodsixActor').default} world
 * @returns {string[]}
 */
export function getDestinationCoordinateAliases(world) {
  return [
    getWorldCoordinate(world),
    world?.getFlag?.('twodsix', 'locationCoordinate'),
    world?.system?.coordinates,
    world?.globalHex,
    world?.hex,
  ].filter(Boolean);
}

/**
 * @param {import('../TraderState.js').TraderState} state
 * @param {import('../../entities/TwodsixActor').default[]|null} [reachableWorlds=null]
 */
export function buildDestinationOptions(state, reachableWorlds = null) {
  const currentHex = state.currentWorldHex;
  const reachable = reachableWorlds ?? worldsInJumpRange(currentHex, state.ship.jumpRating, state.worlds);
  const jumpFuel = Math.ceil(state.ship.tonnage * state.ship.jumpRating * 0.1);

  const uniqueReachable = deduplicateWorlds(reachable);

  const options = uniqueReachable.map(w => {
    const targetHex = getWorldCoordinate(w);
    const displayHex = w.system?.coordinates || targetHex;
    const dist = hexDistance(currentHex, targetHex);
    const refuelNote = canAffordRefuelAtWorld(w, state, jumpFuel) ? '' : ' ⚠️';
    return {
      value: targetHex,
      aliases: getDestinationCoordinateAliases(w),
      label: `${w.name} (${displayHex}) — ${w.system?.uwp} [${w.system?.tradeCodes}] — ${dist} parsec(s)${refuelNote}`,
    };
  });
  return { reachable: uniqueReachable, options };
}

/**
 * @param {import('../TraderApp.js').TraderApp} app
 */
export async function getReachableDestinations(app) {
  const s = app.state;
  const reachable = await getReachableWorlds(s);
  const { options } = buildDestinationOptions(s, reachable);

  if (reachable.length === 0 && isLocalMode(s) && s.rootFolderId) {
    const rootFolder = game.folders.get(s.rootFolderId);
    if (rootFolder) {
      const worlds = collectWorldsFromFolder(rootFolder);
      if (worlds.length !== s.worlds.length) {
        s.worlds = worlds;
        const result = buildDestinationOptions(s);
        const reachable2 = result.reachable;
        const options2 = result.options;
        if (reachable2.length > 0) {
          await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.NoWorldsInRangeLocal', { count: reachable2.length }));
        }
        await app.flushSave();
        return { reachable: reachable2, options: options2 };
      }
    }
  }

  return { reachable, options };
}

/**
 * @param {import('../TraderApp.js').TraderApp} app
 */
export async function chooseDestination(app) {
  const s = app.state;
  const cache = getWorldCache(s);
  const { reachable, options } = await getReachableDestinations(app);

  if (!reachable.length) {
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.NoWorldsInRange'));
    return;
  }

  if (s.destinationHex) {
    options.unshift({ value: 'clear', label: game.i18n.localize('TWODSIX.Trader.Actions.ClearDestination') });
  }

  const chosen = await app._choose(game.i18n.localize('TWODSIX.Trader.Prompts.ChooseDestination'), options, null);

  if (chosen === 'clear') {
    if (cache.privateMessageAccepted && cache.privateMessageCredits > 0) {
      const confirm = await app._choose(
        game.i18n.format('TWODSIX.Trader.Log.ChangeDestForfeit', { credits: cache.privateMessageCredits.toLocaleString() }),
        [
          { value: 'confirm', label: game.i18n.localize('TWODSIX.Trader.Actions.ClearDestinationConfirm') },
          { value: 'cancel', label: game.i18n.localize('Cancel') },
        ],
      );
      if (confirm === 'cancel') {
        return;
      }
      const forfeitedCredits = cache.privateMessageCredits;
      subtractRevenue(s, forfeitedCredits);
      cache.privateMessageAccepted = false;
      cache.privateMessageCredits = 0;
      await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.DestinationClearedForfeited', { credits: forfeitedCredits.toLocaleString() }));
    }
    s.destinationHex = '';
    s.destinationGlobalHex = '';
    s.destinationName = '';
    await app.logEvent(game.i18n.localize('TWODSIX.Trader.Log.DestinationCleared'));
    return;
  }

  const dest = reachable.find(w => getDestinationCoordinateAliases(w).includes(chosen));
  if (!dest) {
    return;
  }

  const previousDestination = s.destinationHex || s.destinationGlobalHex;
  if (cache.privateMessageAccepted && cache.privateMessageCredits > 0 && previousDestination !== chosen) {
    const confirm = await app._choose(
      game.i18n.format('TWODSIX.Trader.Log.ChangeDestForfeit', { credits: cache.privateMessageCredits.toLocaleString() }),
      [
        { value: 'confirm', label: game.i18n.localize('TWODSIX.Trader.Actions.ChangeDestinationConfirm') },
        { value: 'cancel', label: game.i18n.localize('Cancel') },
      ],
    );
    if (confirm === 'cancel') {
      return;
    }
    const forfeitedCredits = cache.privateMessageCredits;
    subtractRevenue(s, forfeitedCredits);
    cache.privateMessageAccepted = false;
    cache.privateMessageCredits = 0;
    await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.PrivateMessageForfeited', { credits: forfeitedCredits.toLocaleString() }));
  }

  const canonicalDestination = getWorldCoordinate(dest) || chosen;
  s.destinationHex = canonicalDestination;
  s.destinationGlobalHex = dest.globalHex || dest.hex || '';
  s.destinationName = dest.name;
  await app.logEvent(game.i18n.format('TWODSIX.Trader.Log.DestinationSelected', { world: dest.name }));
}
