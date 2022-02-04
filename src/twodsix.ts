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
import TwodsixCombatant from "./module/entities/TwodsixCombatant";
import {TwodsixActorSheet, TwodsixNPCSheet} from "./module/sheets/TwodsixActorSheet";
import {TwodsixShipSheet} from "./module/sheets/TwodsixShipSheet";
import {TwodsixShipPositionSheet} from "./module/sheets/TwodsixShipPositionSheet";
import {TwodsixItemSheet} from "./module/sheets/TwodsixItemSheet";
import registerHandlebarsHelpers from "./module/handlebars";
import {registerSettings} from "./module/settings";
import {switchCss} from "./module/settings";
import "./module/migration";
import {rollItemMacro} from "./module/utils/rollItemMacro";

// @ts-ignore
hookScriptFiles.forEach((hookFile:string) => import(`./module/hooks/${hookFile}.ts`));

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

  game['twodsix'] = {
    TwodsixActor,
    TwodsixItem,
    rollItemMacro
  };

  // Actor
  CONFIG.Actor.documentClass = TwodsixActor;
  Actors.unregisterSheet('core', ActorSheet);

  Actors.registerSheet('twodsix', TwodsixActorSheet, {
    types: ["traveller"],
    label: "Traveller Sheet",
    makeDefault: true
  });

  Actors.registerSheet('twodsix', TwodsixNPCSheet, {
    types: ["traveller"],
    label: "NPC Sheet",
    makeDefault: false
  });

  Actors.registerSheet("twodsix", TwodsixShipSheet, {
    types: ["ship"],
    makeDefault: true,
  });

  // Items
  CONFIG.Item.documentClass = TwodsixItem;
  Items.unregisterSheet("core", ItemSheet);
  // @ts-ignore
  Items.registerSheet("twodsix", TwodsixItemSheet, {makeDefault: true});
  Items.registerSheet("twodsix", TwodsixShipPositionSheet, {types: ["ship_position"], makeDefault: true});

  CONFIG.Combatant.documentClass = TwodsixCombatant;
  registerHandlebarsHelpers();

  registerSettings();

  /*Register CSS Styles*/
  let sheetName = "systems/twodsix/styles/";
  if (game.settings.get('twodsix', 'useFoundryStandardStyle')) {
    sheetName += "twodsix_basic.css";
  } else {
    sheetName += "twodsix.css";
  }
  switchCss(sheetName);

  if (game.settings.get('twodsix', 'useModuleFixStyle') && !game.settings.get('twodsix', 'useFoundryStandardStyle')) {
    switchCss("systems/twodsix/styles/twodsix_moduleFix.css");
  }


  //@ts-ignore
  await loadTemplates(handlebarsTemplateFiles);

  // All other hooks are found in the module/hooks directory, and should be in the system.json esModules section.

});
