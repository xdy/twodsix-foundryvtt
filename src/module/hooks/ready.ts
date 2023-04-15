// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import migrateWorld from "../migration";
import {createItemMacro} from "../utils/createItemMacro";

Hooks.once("ready", async function () {

  if (game.settings.get('twodsix', 'showMissingCompendiumWarnings')) {
    if (game.modules.get("compendium-folders") === undefined) {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Modules.compendiumFolders.missing"), {permanent: true});
    } else if (game.modules.get("compendium-folders")?.active === false) {
      ui.notifications.warn(game.i18n.localize("TWODSIX.Modules.compendiumFolders.disabled"), {permanent: true});
    }
  }

  //Prevent a conflict with Twodsix conditions
  if (game.modules.get("combat-utility-belt")?.active) {
    if (game.settings.get("combat-utility-belt", "removeDefaultEffects")) {
      game.settings.set("combat-utility-belt", "removeDefaultEffects", false);
    }
  }

  //*Set default damage options localized
  if (game.settings.get("twodsix", "damageTypeOptions") === "") {
    game.settings.set("twodsix", "damageTypeOptions", game.i18n.localize("TWODSIX.Settings.defaultDamageOptions"));
  }

  if (!Roll.validate(game.settings.get('twodsix', 'maxEncumbrance'))) {
    ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.EncumbranceFormulaInvalid"));
  }

  // Determine whether a system migration is required and feasible

  let worldVersion = <string>game.settings.get("twodsix", "systemMigrationVersion");
  if (worldVersion == "null" || worldVersion == null) {
    worldVersion = "";
  }

  // Perform the migration
  if (game.user?.isGM) {
    await migrateWorld(worldVersion);
  }

  // A socket hook proxy
  game.socket?.on("system.twodsix", (data) => {
    Hooks.call(data[0], ...data.slice(1));
  });

  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => createItemMacro(data, slot));

});
