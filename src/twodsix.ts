/**
 * This is your TypeScript entry file for Foundry VTT.
 * Register custom settings, sheets, and constants using the Foundry API.
 * Change this heading to be more descriptive to your system, or remove it.
 * Author: See the system.json file, where they are in chronological order.
 * Content License: Basically OGL, see License section of README.md for details
 * Software License: Apache, see License section of README.md for details
 */

import TwodsixActor from "./module/entities/TwodsixActor";
import TwodsixItem from "./module/entities/TwodsixItem";
import {TwodsixActorSheet} from "./module/sheets/TwodsixActorSheet";
import {TwodsixShipSheet} from "./module/sheets/TwodsixShipSheet";
import {TwodsixItemSheet} from "./module/sheets/TwodsixItemSheet";
import registerHandlebarsHelpers from "./module/handlebars";
import {registerSettings} from "./module/settings";

require('../static/styles/twodsix.css');

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
    // rollItemMacro
  };

  // Actor
  CONFIG.Actor.entityClass = TwodsixActor;
  Actors.unregisterSheet('core', ActorSheet);

  Actors.registerSheet('twodsix', TwodsixActorSheet, {
    types: ["traveller"],
    makeDefault: true});

  Actors.registerSheet("twodsix", TwodsixShipSheet, {
    types: ["ship"],
    makeDefault: true,
  });

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
  const templatePaths = [
    //TODO Set up so the templates are instead loaded during build, using all html files in the templates folder
    "systems/twodsix/templates/actors/actor-sheet.html",
    "systems/twodsix/templates/actors/parts/actor/actor-skills.html",
    "systems/twodsix/templates/actors/parts/actor/actor-items.html",
    "systems/twodsix/templates/actors/parts/actor/actor-finances.html",
    "systems/twodsix/templates/actors/parts/actor/actor-items.html",
    "systems/twodsix/templates/actors/parts/actor/actor-notes.html",
    "systems/twodsix/templates/actors/parts/actor/actor-info.html",
    "systems/twodsix/templates/actors/ship-sheet.html",
    "systems/twodsix/templates/actors/parts/ship/ship-crew.html",
    "systems/twodsix/templates/actors/parts/ship/ship-storage.html",
    "systems/twodsix/templates/actors/parts/ship/ship-cargo.html",
    "systems/twodsix/templates/actors/parts/ship/ship-notes.html",
    "systems/twodsix/templates/items/item-sheet.html",
    "systems/twodsix/templates/items/skills-sheet.html",
    "systems/twodsix/templates/items/armor-sheet.html",
    "systems/twodsix/templates/items/augment-sheet.html",
    "systems/twodsix/templates/items/tool-sheet.html",
    "systems/twodsix/templates/items/junk-sheet.html",
    "systems/twodsix/templates/items/equipment-sheet.html",
    "systems/twodsix/templates/items/storage-sheet.html"  ];
  loadTemplates(templatePaths);

  // All other hooks are found in the module/hooks directory, and should be in the system.json esModules section.

});

