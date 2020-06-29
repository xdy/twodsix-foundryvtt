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

// Import TypeScript modules
import {registerSettings} from './module/settings';
import loadTemplates from './module/templates';
import registerHandlebarsHelpers from './module/handlebars';
import TwodsixActor from './module/actor/actor';
import TwodsixItem from "./module/item/item";
import {TwodsixSystem} from './module/twodsix-system';
import registerActors from './module/register-actors';
import registerItemSheets from './module/register-sheets';


/* ------------------------------------ */
/* Initialize system					*/
/* ------------------------------------ */

Hooks.once('init', async function () {

    game.twodsix = {
        twodsixActor: TwodsixActor,
        twodsixItem: TwodsixItem
    };

    /**
     * Set an initiative formula for the system
     * @type {String}
     */
    CONFIG.Combat.initiative = {
        formula: "1d6",
        decimals: 1
    };

    // Define custom Entity classes
    CONFIG.Actor.entityClass = TwodsixActor;
    CONFIG.Item.entityClass = TwodsixItem;

    registerSettings();
    await loadTemplates();
    registerActors();
    registerItemSheets();
    registerHandlebarsHelpers();

});
/* ------------------------------------ */
/* Setup system							*/
/* ------------------------------------ */
Hooks.once('setup', function () {
    // Do anything after initialization but before
    // ready
    (window as any).Twodsix = new TwodsixSystem();
    // Localize CONFIG objects once up-front
    const toLocalize = [];
    for (const o of toLocalize) {
        CONFIG.Twodsix[o] = Object.entries(CONFIG.Twodsix[o]).reduce((obj, e: any) => {
            obj[e[0]] = game.i18n.localize(e[1]);
            return obj;
        }, {});
    }

});

/* ------------------------------------ */
/* When ready							*/
/* ------------------------------------ */
Hooks.once('ready', function () {
    // Do anything once the system is ready
    //Set up migrations here once needed.

});

// Add any additional hooks if necessary
Hooks.on('preCreateActor', (actor, dir) => {
    if (game.settings.get('twodsix', 'defaultTokenSettings')) {
        // Set wounds, advantage, and display name visibility
        mergeObject(actor, {
            'token.bar1': {attribute: 'attributes.hp'}, // Default Bar 1 to Wounds
            'token.displayName': CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER, // Default display name to be on owner hover
            'token.displayBars': CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER, // Default display bars to be on owner hover
            'token.disposition': CONST.TOKEN_DISPOSITIONS.HOSTILE, // Default disposition to hostile
            'token.name': actor.name, // Set token name to actor name
        });

        // Default characters to HasVision = true and Link Data = true
        if (actor.type == 'character') {
            actor.token.vision = true;
            actor.token.disposition = CONST.TOKEN_DISPOSITIONS.FRIENDLY;
            actor.token.actorLink = true;
        }
    }
});