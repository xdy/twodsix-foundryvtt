import {Migration} from "../migration";
import compareVersions from "compare-versions";
import {simpleUpdateInit} from "../settings";
import {TwodsixRolls} from "../utils/TwodsixRolls";


export function before(worldVersion:string, MIGRATIONS_IMPLEMENTED:string):boolean {
  return compareVersions(worldVersion, MIGRATIONS_IMPLEMENTED) === -1;
}

Hooks.once("ready", async function () {

  //Things that need to be done once settings have been set (and should probably be moved elsewhere...)
  simpleUpdateInit(game.settings.get("twodsix", "initiativeFormula"));

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

  const needMigration = worldVersion === null || compareVersions(worldVersion, systemVersion) === -1;

  // Perform the migration
  if (needMigration && game.user.isGM) {
    if (!worldVersion || before(worldVersion, MIGRATIONS_IMPLEMENTED)) {
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
    const name = item.name ? item.name : item.data.name;
    const img = item.img ? item.img : item.data.img;
    macro = await Macro.create({
      command: command,
      name: name,
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
export async function rollItemMacro(itemId):Promise<void> {
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
    await TwodsixRolls.performRoll(actor, itemId, domStringMap, false);
  }
}

