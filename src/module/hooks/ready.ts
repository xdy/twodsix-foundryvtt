import migrateWorld from '../migration';
import {createItemMacro} from '../utils/createItemMacro';
import {getGame, getUi} from '../utils/utils';

Hooks.once('ready', async function () {

  if (getGame().settings.get('twodsix', 'showMissingCompendiumWarnings')) {
    if (getGame().modules.get('compendium-folders') === undefined) {
      getUi().notifications?.warn(getGame().i18n.localize('TWODSIX.Modules.compendiumFolders.missing'), {permanent: true});
    } else if (!getGame().modules.get('compendium-folders')?.active) {
      getUi().notifications?.warn(getGame().i18n.localize('TWODSIX.Modules.compendiumFolders.disabled'), {permanent: true});
    }
  }

  //Things that need to be done once settings have been set (and should probably be moved elsewhere...)
  CONFIG.Combat.initiative = {
    formula: (<string>getGame().settings.get('twodsix', 'initiativeFormula')),
    decimals: 0
  };

  // Determine whether a system migration is required and feasible

  let worldVersion = <string>getGame().settings.get('twodsix', 'systemMigrationVersion');
  if (worldVersion == 'null' || worldVersion == null) {
    worldVersion = '';
  }

  // Perform the migration
  if (getGame().user?.isGM) {
    await migrateWorld(worldVersion);
  }

  // A socket hook proxy
  getGame().socket?.on('system.twodsix', (data) => {
    Hooks.call(data[0], ...data.slice(1));
  });

  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on('hotbarDrop', (bar, data, slot) => createItemMacro(data, slot));

});
