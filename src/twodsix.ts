/**
 * This is your TypeScript entry file for Foundry VTT.
 * Register custom settings, sheets, and constants using the Foundry API.
 * Change this heading to be more descriptive to your system, or remove it.
 * Author: See the system.json file, where they are in chronological order.
 * Content License: Basically OGL, see License section of README.md for details
 * Software License: Apache, see License section of README.md for details
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

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
import { TwodsixVehicleSheet } from "./module/sheets/TwodsixVehicleSheet";
import { TwodsixAnimalSheet} from "./module/sheets/TwodsixAnimalSheet";
import { TwodsixRobotSheet } from "./module/sheets/TwodsixRobotSheet";
import { TwodsixSpaceObjectSheet } from "./module/sheets/TwodsixSpaceObjectSheet";
import { TwodsixDiceRoll } from "./module/utils/TwodsixDiceRoll";
import { TwodsixRollSettings } from "./module/utils/TwodsixRollSettings";
import { addCustomEnrichers } from "./module/utils/enrichers";

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
    rollItemMacro,
    TwodsixDiceRoll,
    TwodsixRollSettings
  };

  CONFIG.ActiveEffect.legacyTransferral = false;

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

  Actors.registerSheet('twodsix', TwodsixRobotSheet, {
    types: ["robot"],
    label: "Robot Sheet",
    makeDefault: true
  });

  Actors.registerSheet("twodsix", TwodsixShipSheet, {
    types: ["ship"],
    label: "Ship Sheet",
    makeDefault: true,
  });

  Actors.registerSheet("twodsix", TwodsixVehicleSheet, {
    types: ["vehicle"],
    label: "Vehicle Sheet",
    makeDefault: true,
  });

  Actors.registerSheet("twodsix", TwodsixAnimalSheet, {
    types: ["animal"],
    label: "Animal Sheet",
    makeDefault: true,
  });

  Actors.registerSheet("twodsix", TwodsixSpaceObjectSheet, {
    types: ["space-object"],
    label: "Space Object Sheet",
    makeDefault: true,
  });

  // Items
  CONFIG.Item.documentClass = TwodsixItem;
  Items.unregisterSheet("core", ItemSheet);

  Items.registerSheet("twodsix", TwodsixItemSheet, {makeDefault: true, label: "Item Sheet"});
  Items.registerSheet("twodsix", TwodsixShipPositionSheet, {types: ["ship_position"], makeDefault: true, label: "Ship Position Sheet"});

  CONFIG.Combatant.documentClass = TwodsixCombatant;
  registerHandlebarsHelpers();

  registerSettings();

  //Dice Rolls
  CONFIG.Dice.rolls.push(TwodsixDiceRoll);

  //Add custom Enrichers
  addCustomEnrichers();

  /* add fonts */
  // @ts-ignore
  CONFIG.fontDefinitions["Asap"] = {
    editor: true,
    fonts: [
      {urls: ["systems/twodsix/fonts/Asap-Regular.woff2", "systems/twodsix/fonts/Asap-Regular.ttf"]},
      {urls: ["systems/twodsix/fonts/Asap-Bold.woff2", "systems/twodsix/fonts/Asap-Bold.ttf"], weight: 700},
      {urls: ["systems/twodsix/fonts/Asap-Italic.woff2", "systems/twodsix/fonts/Asap-Italic.ttf"], style: "italic"},
      {urls: ["systems/twodsix/fonts/Asap-BoldItalic.woff2", "systems/twodsix/fonts/Asap-BoldItalic.ttf"], style: "italic", weight: 700}
    ]
  };

  /*Add time for a combat round default*/
  CONFIG.time.roundTime = 6;

  /*Register CSS Styles*/
  let sheetName = "systems/twodsix/styles/";
  if (game.settings.get('twodsix', 'useFoundryStandardStyle')) {
    sheetName += "twodsix_basic.css";
  } else {
    sheetName += "twodsix.css";
  }
  switchCss(sheetName);
  if (!game.settings.get('twodsix', 'useFoundryStandardStyle')) {
    document.documentElement.style.setProperty('--s2d6-default-color',  game.settings.get('twodsix', 'defaultColor'));
    document.documentElement.style.setProperty('--s2d6-light-color', game.settings.get('twodsix', 'lightColor'));
  }

  if (game.settings.get('twodsix', 'useModuleFixStyle') && !game.settings.get('twodsix', 'useFoundryStandardStyle')) {
    switchCss("systems/twodsix/styles/twodsix_moduleFix.css");
  }

  //@ts-ignore
  await loadTemplates(handlebarsTemplateFiles);

  //Add TL to compendium index
  CONFIG.Item.compendiumIndexFields.push('system.techLevel');

  // All other hooks are found in the module/hooks directory, and should be in the system.json esModules section.

});

Hooks.once('devModeReady', ({ registerPackageDebugFlag }) => {
  registerPackageDebugFlag('twodsix');
});
