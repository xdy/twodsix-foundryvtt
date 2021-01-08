import {Migration} from "../migration";
import {createItemMacro} from "../utils/createItemMacro";

Hooks.once("ready", async function () {

  if (game.settings.get('twodsix', 'showMissingCompendiumWarnings')) {
    if (game.modules.get("compendium-folders") === undefined) {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Modules.compendiumFolders.missing"), {permanent: true});
    } else if (game.modules.get("compendium-folders").active === false) {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Modules.compendiumFolders.disabled"), {permanent: true});
    }
  }

  //Things that need to be done once settings have been set (and should probably be moved elsewhere...)
  CONFIG.Combat.initiative = {
    formula: game.settings.get("twodsix", "initiativeFormula"),
    decimals: 0
  };

  // Determine whether a system migration is required and feasible

  const systemVersion = game.system.data.version;
  let worldVersion = null;
  if (game.settings.settings.has("twodsix.systemMigrationVersion")) {
    worldVersion = await game.settings.get("twodsix", "systemMigrationVersion");
    if (worldVersion == "null" || worldVersion == "") {
      worldVersion = null;
    }
  }

  const needMigration = worldVersion === null || isNewerVersion(systemVersion, worldVersion);

  // Perform the migration
  if (needMigration && game.user.isGM) {
    await Migration.migrateWorld();
  }

  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => createItemMacro(data, slot));

});
