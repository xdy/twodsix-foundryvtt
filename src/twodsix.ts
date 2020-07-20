/**
 * This is your TypeScript entry file for Foundry VTT.
 * Register custom settings, sheets, and constants using the Foundry API.
 * Change this heading to be more descriptive to your system, or remove it.
 * Author: [your name]
 * Content License: OGL, see License section of README.md for details
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


require('./styles/twodsix.scss');

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
        TwodsixItem
    };

    // Actor
    CONFIG.Actor.entityClass = TwodsixActor;
    Actors.unregisterSheet('core', ActorSheet);
    Actors.registerSheet('twodsix', TwodsixActorSheet, {
        types: ['character'],
        makeDefault: true,
    });

    // Items
    CONFIG.Item.entityClass = TwodsixItem;
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("twodsix", TwodsixItemSheet, {makeDefault: true});

    /**
     * Set an initiative formula for the system
     * TODO Should be done via a setting
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

/* ------------------------------------ */
/* When ready							*/
/* ------------------------------------ */
Hooks.once('ready', async function () {
    // Do anything once the system is ready

    // //TODO The below reads all skill *names* from all compendiums. Needs to be revisited. Should only read *this* variant's skills. Also, not sure I'm going to need it.
    // TWODSIX.skills = await TwodsixItemList.getItems('skill', 'skills');

    // Set up migrations here once needed.


});

// Add any additional hooks if necessary
Hooks.on('preCreateActor', async (actor, dir) => {

    if (game.settings.get('twodsix', 'defaultTokenSettings')) {
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
            disposition,
        });
    }
});