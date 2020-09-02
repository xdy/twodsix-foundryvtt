/**
 * This is your TypeScript entry file for Foundry VTT.
 * Register custom settings, sheets, and constants using the Foundry API.
 * Change this heading to be more descriptive to your system, or remove it.
 * Author: See the system.json file, where they are in chronological order.
 * Content License: Basically OGL, see License section of README.md for details
 * Software License: Apache, see License section of README.md for details
 */
import {registerSettings} from './module/settings';
import preloadTemplates from './module/templates';
import registerHandlebarsHelpers from './module/handlebars';
import {TwodsixSystem} from './module/TwodsixSystem';
import TwodsixActor from "./module/entities/TwodsixActor";
import TwodsixItem from "./module/entities/TwodsixItem";
import {TwodsixActorSheet} from "./module/sheets/TwodsixActorSheet";
import {TwodsixItemSheet} from "./module/sheets/TwodsixItemSheet";
import {TWODSIX} from "./module/config";
import {Migration} from "./module/migration";


require('../static/styles/twodsix.css');

/* ------------------------------------ */
/* Initialize system					*/
/* ------------------------------------ */

Hooks.once('init', async function () {
    const ASCII = "\n" +
    "\n" +
    "___________                 .___     .__        \n" +
    "\\__    ___/_  _  ______   __| _/_____|__|__  ___\n" +
    "  |    |  \\ \\/ \\/ /  _ \\ / __ |/  ___  /  \\  \\/  /\n" +
    "  |    |   \\     (  <_> ) /_/ |\\___ \\|  |>    < \n" +
    "  |____|    \\/\\_/ \\____/\\____ /____  >__/__/\\_ \\\n" +
    "                             \\/    \\/         \\/\n" +
    "\n";
    console.log(
        `TWODSIX | Initializing Twodsix system\n${ASCII}`,
    );


    game.twodsix = {
        TwodsixActor,
        TwodsixItem,
        rollItemMacro
    };

    // Actor
    CONFIG.Actor.entityClass = TwodsixActor;
    Actors.unregisterSheet('core', ActorSheet);
    Actors.registerSheet('twodsix', TwodsixActorSheet, {makeDefault: true});

    // Items
    CONFIG.Item.entityClass = TwodsixItem;
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("twodsix", TwodsixItemSheet, {makeDefault: true});

    /**
   * Set an initiative formula for the system
   * @type {String}
   */
    CONFIG.Combat.initiative = {
        formula: "1d6",
        decimals: 1
    };

    registerHandlebarsHelpers();
    registerSettings();
    await preloadTemplates();

});
/* ------------------------------------ */
/* Setup system							*/
/* ------------------------------------ */
Hooks.once('setup', async function () {
    // Do anything after initialization but before ready

    CONFIG.TWODSIX = TWODSIX;

    (window as any).Twodsix = new TwodsixSystem();

});

Hooks.once("ready", async function () {
    // Determine whether a system migration is required and feasible
    const MIGRATIONS_IMPLEMENTED = "0.6.1";
    let currentVersion = null;
    if (game.settings.settings.has("twodsix.systemMigrationVersion")) {
        currentVersion = await game.settings.get("twodsix", "systemMigrationVersion")
        if (currentVersion == "null") {
            currentVersion = null;
        }
    }
    const needMigration = currentVersion === null || currentVersion === "" || currentVersion < game.system.data.version;

    // Perform the migration
    if (needMigration && game.user.isGM) {
        if (!currentVersion || currentVersion < MIGRATIONS_IMPLEMENTED) {
            ui.notifications.error(`Your world data is from a Twodsix system version before migrations were implemented (in 0.6.1). This is most likely not a problem if you have used the system recently, but errors may occur.`, {permanent: true});
        }
        await Migration.migrateWorld();
    }

    // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
    Hooks.on("hotbarDrop", (bar, data, slot) => createTwodsixMacro(data, slot));

});

// Add any additional hooks if necessary
Hooks.on('preCreateActor', async (actor, dir) => {

    if (game.settings.get('twodsix', 'defaultTokenSettings')) {
        let link = true;
        let disposition = 1;

        if (actor.type !== 'traveller') {
            link = false;
            disposition = 0;
        }

        actor.token = actor.token || {};
        mergeObject(actor.token, {
            'token.displayName': CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
            'token.displayBars': CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
            vision: true,
            dimSight: 30,
            brightSight: 0,
            actorLink: link,
            disposition,
        });
    }
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */

/* -------------------------------------------- */

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
    let macro:Entity = game.macros.entities.find(m => (m.name === item.name) && (m.command === command));
    if (!macro) {
        macro = await Macro.create({
            name: item.name,
            type: "script",
            img: item.img,
            command: command,
            flags: {"twodsix.itemMacro": true}
        });
    }
    game.user.assignHotbarMacro(macro as Macro, slot);
    return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemName
 * @return {Promise}
 */
function rollItemMacro(itemName) {
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
