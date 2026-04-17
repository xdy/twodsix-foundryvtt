/**
 * Root-level Journal sidebar folders used by twodsix CharGen and Trader features.
 * These are lookup keys for `getOrCreateTwodsixJournalFolder`, NOT display names.
 * The actual folder is tagged with a system flag and cached in a world setting.
 */
const TWODSIX_FLAG_PURPOSE_CHARGEN = 'chargen';
const TWODSIX_FLAG_PURPOSE_TRADER = 'trader';

const FOLDER_PURPOSE_TO_SETTING = {
  [TWODSIX_FLAG_PURPOSE_CHARGEN]: 'chargenJournalFolderId',
  [TWODSIX_FLAG_PURPOSE_TRADER]: 'traderJournalFolderId',
};

const FOLDER_PURPOSE_TO_NAME = {
  [TWODSIX_FLAG_PURPOSE_CHARGEN]: 'Character generation journals',
  [TWODSIX_FLAG_PURPOSE_TRADER]: 'Trader journals',
};

export const TWODSIX_JOURNAL_FOLDER_CHAR_GEN = TWODSIX_FLAG_PURPOSE_CHARGEN;
export const TWODSIX_JOURNAL_FOLDER_TRADER = TWODSIX_FLAG_PURPOSE_TRADER;

/**
 * Get or create a top-level Journal folder tagged for a twodsix purpose.
 * Uses a world setting as a cache; falls back to flag-based search; creates + flags on miss.
 * @param {"chargen"|"trader"} purpose
 * @returns {Promise<string>} Folder document id
 */
export async function getOrCreateTwodsixJournalFolder(purpose) {
  const settingKey = FOLDER_PURPOSE_TO_SETTING[purpose];
  const displayName = FOLDER_PURPOSE_TO_NAME[purpose];

  // 1. Cached folder ID from world setting.
  if (settingKey) {
    const cachedId = game.settings.get('twodsix', settingKey);
    if (cachedId) {
      const cachedFolder = game.folders.get(cachedId);
      if (cachedFolder && cachedFolder.type === 'JournalEntry' && cachedFolder.getFlag('twodsix', 'purpose') === purpose) {
        return cachedId;
      }
    }
  }

  // 2. Search for a folder tagged with the purpose flag.
  let folder = game.folders.find(f =>
    f.type === 'JournalEntry' && f.getFlag('twodsix', 'purpose') === purpose && !f.folder,
  );
  if (folder) {
    if (settingKey) {
      await game.settings.set('twodsix', settingKey, folder.id);
    }
    return folder.id;
  }

  // 3. Create, flag, and cache.
  folder = await Folder.create({
    type: 'JournalEntry',
    name: displayName,
  });
  await folder.setFlag('twodsix', 'purpose', purpose);
  if (settingKey) {
    await game.settings.set('twodsix', settingKey, folder.id);
  }
  return folder.id;
}
