import {Migration} from "../migration";
import {TwodsixRolls} from "../utils/TwodsixRolls";


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

  const MIGRATIONS_IMPLEMENTED = "0.6.1";
  const systemVersion = game.system.data.version;
  let worldVersion = null;
  if (game.settings.settings.has("twodsix.systemMigrationVersion")) {
    worldVersion = await game.settings.get("twodsix", "systemMigrationVersion");
    if (worldVersion == "null" || worldVersion == "") {
      worldVersion = null;
    }
  }

  const needMigration = worldVersion === null || isNewerVersion(worldVersion, systemVersion);

  // Perform the migration
  if (needMigration && game.user.isGM) {
    if (!worldVersion || !isNewerVersion(worldVersion, MIGRATIONS_IMPLEMENTED)) {
      ui.notifications.error(`Your world data is from a Twodsix system version before migrations were implemented (in 0.6.1). This is most likely not a problem if you have used the system recently, but errors may occur.`, {permanent: true});
    }
    await Migration.migrateWorld();
  }

  // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
  Hooks.on("hotbarDrop", (bar, data, slot) => createItemMacro(data, slot));

});

//TODO Move these to a better place
/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} item     The item data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(item, slot):Promise<void> {
  const command = `game.twodsix.rollItemMacro("${item._id ? item._id : item.data._id}");`;
  let macro = game.macros.entities.find((m) => (m.name === item.name) /*&& (m.data.command === command)*/);
  if (!macro) {
    const itemName = item.name ? item.name : item.data.name;
    const img = item.img ? item.img : item.data.img;
    macro = await Macro.create({
      command: command,
      name: itemName,
      type: 'script',
      img: img,
      flags: {'twodsix.itemMacro': true},
    }, {displaySheet: false}) as Macro;

    await game.user.assignHotbarMacro(macro, slot);
  }
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemId
 * @return {Promise}
 */
export async function rollItemMacro(itemId:string):Promise<void> {
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (speaker.token) {
    actor = game.actors.tokens[speaker.token];
  }
  if (!actor) {
    actor = game.actors.get(speaker.actor);
  }
  const item = actor ? actor.items.find((i) => i._id === itemId) : null;
  if (!item) {
    ui.notifications.warn(`Your controlled Actor does not have an item with ID ${itemId}`);
  } else {
    // Trigger the item roll
    const domStringMap = DOMStringMap.prototype;
    await TwodsixRolls.performThrow(actor, itemId, domStringMap, false);
  }
}

