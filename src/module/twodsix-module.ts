// Import Modules
import {twodsixActor} from "./actor/actor.js";
import {twodsixItem} from "./item/item.js";
import {registerSettings} from "./settings";
import registerHandlebarsHelpers from "./handlebars";
import registerItemSheets from "./register-sheets";
import {registerActors} from "./register-actors";

Hooks.once('init', async function () {

    game.twodsix = {
        yoActor: twodsixActor,
        yoItem: twodsixItem
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
    CONFIG.Actor.entityClass = twodsixActor;
    CONFIG.Item.entityClass = twodsixItem;

    registerSettings();
    registerActors();
    registerItemSheets();
    registerHandlebarsHelpers();

});