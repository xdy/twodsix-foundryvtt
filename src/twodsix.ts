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
import "./module/hooks/index";
import "./module/migration";
import {rollItemMacro} from "./module/utils/rollItemMacro";

Hooks.once('init', async function () {
  console.log(
    `TWODSIX | Initializing Twodsix system\n${("\n" +
      "\n" +
      "___________                 .___     .__        \n" +
      "\\__    ___/_  _  ______   __| _/_____|__|__  ___\n" +
      "  |    |  \\ \\/ \\/ /  _ \\ / __ |/  ___  /  \\  \\/  /\n" +
      "  |    |   \\     (  <_> ) /_/ |\\___ \\|  |>    < \n" +
      "  |____|    \\/\\_/ \\____/\\____ /____  >__/__/\\_ \\\n" +
      "                             \\/    \\/         \\/\n" +
      "\n")}`,
  );

  game.twodsix = {
    TwodsixActor,
    TwodsixItem,
    rollItemMacro
  };

  // Actor
  // @ts-ignore Until fvtt-types goes to 0.8
  CONFIG.Actor.documentClass = TwodsixActor;
  Actors.unregisterSheet('core', ActorSheet);

  // @ts-ignore
  Actors.registerSheet('twodsix', TwodsixActorSheet, {
    types: ["traveller"],
    makeDefault: true
  });

  // @ts-ignore
  Actors.registerSheet("twodsix", TwodsixShipSheet, {
    types: ["ship"],
    makeDefault: true,
  });

  // Items
  // @ts-ignore Until fvtt-types goes to 0.8
  CONFIG.Item.documentClass = TwodsixItem;
  // CONFIG.Item.entityClass = TwodsixItem;
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
    //TODO Set up so the templates are instead loaded during build (or possibly during startup?), using all html files in the templates folder
    "systems/twodsix/templates/actors/actor-sheet.html",
    "systems/twodsix/templates/actors/damage-dialog.html",
    "systems/twodsix/templates/actors/ship-sheet.html",
    //
    "systems/twodsix/templates/actors/parts/actor/actor-characteristics.html",
    "systems/twodsix/templates/actors/parts/actor/actor-characteristics-atom.html",
    "systems/twodsix/templates/actors/parts/actor/actor-consumable.html",
    "systems/twodsix/templates/actors/parts/actor/actor-finances.html",
    "systems/twodsix/templates/actors/parts/actor/actor-info.html",
    "systems/twodsix/templates/actors/parts/actor/actor-items.html",
    

    "systems/twodsix/templates/actors/parts/actor/actor-notes.html",
    "systems/twodsix/templates/actors/parts/actor/actor-skills.html",
    "systems/twodsix/templates/actors/parts/actor/actor-ucf.html",
    //
    "systems/twodsix/templates/actors/parts/ship/ship-cargo.html",
    "systems/twodsix/templates/actors/parts/ship/ship-crew.html",
    "systems/twodsix/templates/actors/parts/ship/ship-notes.html",
    "systems/twodsix/templates/actors/parts/ship/ship-storage.html",
    //
    "systems/twodsix/templates/chat/damage-message.html",
    "systems/twodsix/templates/chat/throw-dialog.html",
    //
    "systems/twodsix/templates/items/dialogs/create-consumable.html",
    //
    "systems/twodsix/templates/items/parts/common-parts.html",
    "systems/twodsix/templates/items/parts/consumables-part.html",
    //
    "systems/twodsix/templates/items/armor-sheet.html",
    "systems/twodsix/templates/items/augment-sheet.html",
    "systems/twodsix/templates/items/consumable-sheet.html",
    "systems/twodsix/templates/items/equipment-sheet.html",
    "systems/twodsix/templates/items/item-sheet.html",
    "systems/twodsix/templates/items/junk-sheet.html",
    "systems/twodsix/templates/items/skills-sheet.html",
    "systems/twodsix/templates/items/storage-sheet.html",
    "systems/twodsix/templates/items/trait-sheet.html",
    "systems/twodsix/templates/items/tool-sheet.html",
    "systems/twodsix/templates/items/weapon-sheet.html"
  ];
  await loadTemplates(templatePaths);

  // All other hooks are found in the module/hooks directory, and should be in the system.json esModules section.

});
