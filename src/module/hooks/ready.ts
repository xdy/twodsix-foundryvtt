import {Migration} from "../migration";
import compareVersions from "compare-versions";


export function before(worldVersion, MIGRATIONS_IMPLEMENTED:string) {
  return compareVersions(worldVersion, MIGRATIONS_IMPLEMENTED) === -1;
}

Hooks.once("ready", async function () {
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
  Hooks.on("hotbarDrop", (bar, data, slot) => createTwodsixMacro(data, slot));

});

//TODO Move these to a better place
/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createTwodsixMacro(data, slot) {
  if (data.type !== "Item") {
    return;
  }
  if (!("data" in data)) {
    return ui.notifications.warn("You can only create macro buttons for owned Items");
  }
  const item = data.data;

  // Create the macro command
  const command = `game.twodsix.rollItemMacro("${item.name}");`;

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  let macro:Macro = game.macros.entities.find((m:Macro) => (m.name === item.name) && (m.data.command === command));
  if (!macro) {
    macro = <Macro>await Macro.create({
      name: item.name,
      type: "script",
      img: item.img,
      command: command,
      flags: {"twodsix.itemMacro": true}
    });
  }
  await game.user.assignHotbarMacro(macro, slot);
  return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemName
 * @return {Promise}
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function rollItemMacro(itemName) { // lgtm [js/unused-local-variable]
  const speaker = ChatMessage.getSpeaker();
  let actor;
  if (speaker.token) {
    actor = game.actors.tokens[speaker.token];
  }
  if (!actor) {
    actor = game.actors.get(speaker.actor);
  }
  const item = actor ? actor.items.find(i => i.name === itemName) : null;
  if (!item) {
    return ui.notifications.warn(`Your controlled Actor does not have an item named ${itemName}`);
  }


  // Trigger the item roll
  return item.roll();
}
