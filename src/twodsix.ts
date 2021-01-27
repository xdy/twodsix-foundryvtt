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
require.context("./module/hooks", false, /\.ts$/).keys().forEach(fileName => {
  import("./module/hooks/" + fileName.substring(2));
});
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
  CONFIG.Actor.entityClass = TwodsixActor;
  Actors.unregisterSheet('core', ActorSheet);

  Actors.registerSheet('twodsix', TwodsixActorSheet, {
    types: ["traveller"],
    makeDefault: true
  });

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

  const templatePaths = require.context("../static/templates", true, /\.html$/).keys().map(fileName => {
    return "systems/twodsix/templates" + fileName.substring(1);
  });

  await loadTemplates(templatePaths);

  // All other hooks are found in the module/hooks directory, and should be in the system.json esModules section.

});
