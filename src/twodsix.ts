/**
 * This is your TypeScript entry file for Foundry VTT.
 * Register custom settings, sheets, and constants using the Foundry API.
 * Change this heading to be more descriptive to your system, or remove it.
 * Author: [your name]
 * Content License: [copyright and-or license] If using an existing system
 *                    you may want to put a (link to a) license or copyright
 *                    notice here (e.g. the OGL).
 * Software License: [your license] Put your desired license here, which
 *                     determines how others may use and modify your system
 */

import preloadTemplates from './module/templates';
import registerHandlebarsHelpers from './module/handlebars';
import TwodsixActor from "./module/entities/TwodsixActor";
import TwodsixItem from "./module/entities/TwodsixItem";
import {TwodsixActorSheet} from "./module/sheets/TwodsixActorSheet";
import {TwodsixItemSheet} from "./module/sheets/TwodsixItemSheet";

require('./styles/twodsix.scss');

/* ------------------------------------ */
/* Initialize system					*/
/* ------------------------------------ */

Hooks.once('init', async function () {
    let ASCII = "\n" +
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
        TwodsixActor: TwodsixActor,
        TwodsixItem: TwodsixItem
    };

    //Actor
    CONFIG.Actor.entityClass = TwodsixActor;
    Actors.unregisterSheet('core', ActorSheet);
    Actors.registerSheet('twodsix', TwodsixActorSheet, {
        types: ['character'],
        makeDefault: true,
    });

    //Items
    CONFIG.Item.entityClass = TwodsixItem;
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("twodsix", TwodsixItemSheet, {makeDefault: true});

    registerHandlebarsHelpers();
    await preloadTemplates();

});
/* ------------------------------------ */
/* Setup system							*/
/* ------------------------------------ */
Hooks.once('setup', function () {
    // Do anything after initialization but before
    // ready
});

/* ------------------------------------ */
/* When ready							*/
/* ------------------------------------ */
Hooks.once('ready', async function () {
    // Do anything once the system is ready
    //Set up migrations here once needed.

});

// Add any additional hooks if necessary
Hooks.on('preCreateActor', async (actor, dir) => {

    let link = true;
    let disposition = 1;

    if (actor.type !== 'character') {
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
        disposition: disposition,
    });
});