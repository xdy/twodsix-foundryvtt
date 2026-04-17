/**
 * Trading journey journal naming and creation (TravellerMap and local flows).
 */

import { getOrCreateTwodsixJournalFolder, TWODSIX_JOURNAL_FOLDER_TRADER } from '../../../utils/journalFolders.js';

/**
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function formatTraderJournalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * @param {string} startWorldName
 * @param {number} serial
 * @returns {string}
 */
export function formatTraderJournalName(startWorldName, serial) {
  const world = String(startWorldName ?? '').trim() || game.i18n.localize('TWODSIX.Trader.App.Unknown');
  return game.i18n.format('TWODSIX.Trader.Messages.JournalName', {
    world,
    serial,
    date: formatTraderJournalDate(),
  });
}

/**
 * @param {string} startWorldName
 * @returns {string}
 */
export function nextTraderJournalName(startWorldName) {
  const existingNames = new Set(game.journal.map(journal => String(journal.name ?? '')));
  for (let serial = 1; serial < 10000; serial++) {
    const candidate = formatTraderJournalName(startWorldName, serial);
    if (!existingNames.has(candidate)) {
      return candidate;
    }
  }
  return formatTraderJournalName(startWorldName, Date.now());
}

/**
 * @param {string} startWorldName
 * @returns {Promise<JournalEntry>}
 */
export async function createTraderJournalEntry(startWorldName) {
  const folderId = await getOrCreateTwodsixJournalFolder(TWODSIX_JOURNAL_FOLDER_TRADER);
  const name = nextTraderJournalName(startWorldName);
  return JournalEntry.create({ name, folder: folderId });
}
