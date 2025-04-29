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
import {TwodsixTravellerSheet, TwodsixNPCSheet} from "./module/sheets/TwodsixTravellerSheet";
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
import {TravellerData, AnimalData, RobotData} from "./module/data/characters";
import { ShipData, SpaceObjectData, VehicleData } from "./module/data/vehicles";
import { ArmorData, AugmentData, ComponentData, ComputerData, ConsumableData, JunkStorageData, ShipPositionData, SkillData, SpellData, TraitData, WeaponData, PsiAbilityData } from "./module/data/item";
import { GearData } from "./module/data/item-base";
import { TwodsixActiveEffect } from "./module/entities/TwodsixActiveEffect";
import { TwodsixBattleSheet } from "./module/sheets/TwodsixBattleSheet";
import { TwodsixGamePause } from "./module/entities/TwodsixGamePause";
import { TwodsixChatLog, TwodsixChatPopout } from "./module/entities/TwodsixChat";
import { TwodsixTokenRuler } from "./module/utils/TwodsixTokenRuler";

//import { TWODSIX } from "./module/config";
//import { addChatMessageContextOptions } from "./module/hooks/addChatContext";

// @ts-ignore
hookScriptFiles.forEach((hookFile:string) => import(`./module/hooks/${hookFile}.ts`));

Hooks.once('init', async function () {
  console.log(
    `%cTWODSIX | Initializing system\n` +
    `%c
     _____                   _     _
    |_   _|_      _____   __| |___(_)_  __
      | | \\ \\ /\\ / / _ \\ / _\` / __| \\ \\/ /
      | |  \\ V  V / (_) | (_| \\__ \\ |>  <
      |_|   \\_/\\_/ \\___/ \\__,_|___/_/_/\\_\\
    `,
    "color: #ffffff; font-weight: bold; font-size: 16px;", // Style for the header
    "color:rgba(41, 170, 225, 1); font-weight: normal; font-size: 12px;" // Style for the ASCII art
  );

  game['twodsix'] = {
    TwodsixActor,
    TwodsixItem,
    TwodsixActiveEffect,
    rollItemMacro,
    TwodsixDiceRoll,
    TwodsixRollSettings
  };

  CONFIG.ActiveEffect.legacyTransferral = false;
  CONFIG.ActiveEffect.sidebarIcon = "fa-solid fa-person-rays";

  // Actor
  CONFIG.Actor.documentClass = TwodsixActor;
  foundry.documents.collections.Actors.unregisterSheet('core', foundry.appv1.sheets.ActorSheet);
  foundry.documents.collections.Actors.unregisterSheet('core', foundry.applications.sheets.ActorSheetV2);

  foundry.documents.collections.Actors.registerSheet('twodsix', TwodsixTravellerSheet, {
    types: ["traveller"],
    label: "Traveller Sheet",
    makeDefault: true
  });

  foundry.documents.collections.Actors.registerSheet('twodsix', TwodsixNPCSheet, {
    types: ["traveller"],
    label: "NPC Sheet",
    makeDefault: false
  });

  foundry.documents.collections.Actors.registerSheet('twodsix', TwodsixRobotSheet, {
    types: ["robot"],
    label: "Robot Sheet",
    makeDefault: true
  });

  foundry.documents.collections.Actors.registerSheet("twodsix", TwodsixShipSheet, {
    types: ["ship"],
    label: "Ship Sheet",
    makeDefault: true,
  });

  foundry.documents.collections.Actors.registerSheet("twodsix", TwodsixBattleSheet, {
    types: ["ship"],
    label: "Battle Sheet",
    makeDefault: false,
  });

  foundry.documents.collections.Actors.registerSheet("twodsix", TwodsixVehicleSheet, {
    types: ["vehicle"],
    label: "Vehicle Sheet",
    makeDefault: true,
  });

  foundry.documents.collections.Actors.registerSheet("twodsix", TwodsixAnimalSheet, {
    types: ["animal"],
    label: "Animal Sheet",
    makeDefault: true,
  });

  foundry.documents.collections.Actors.registerSheet("twodsix", TwodsixSpaceObjectSheet, {
    types: ["space-object"],
    label: "Space Object Sheet",
    makeDefault: true,
  });

  /* Load Schemas */
  Object.assign(CONFIG.Actor.dataModels, {
    "traveller": TravellerData,
    "animal": AnimalData,
    "robot": RobotData,
    "ship": ShipData,
    "vehicle": VehicleData,
    "space-object": SpaceObjectData
  });


  // Items
  CONFIG.Item.documentClass = TwodsixItem;
  foundry.documents.collections.Items.unregisterSheet("core", foundry.applications.sheets.ItemSheetV2);
  //Items.unregisterSheet("core", ItemSheet);

  foundry.documents.collections.Items.registerSheet("twodsix", TwodsixItemSheet, {makeDefault: true, label: "Item Sheet"});
  foundry.documents.collections.Items.registerSheet("twodsix", TwodsixShipPositionSheet, {types: ["ship_position"], makeDefault: true, label: "Ship Position Sheet"});
  /* Load Schemas */
  Object.assign(CONFIG.Item.dataModels, {
    "equipment": GearData,
    "weapon": WeaponData,
    "armor": ArmorData,
    "augment": AugmentData,
    "storage": JunkStorageData,
    "tool": GearData,
    "junk": JunkStorageData,
    "skills": SkillData,
    "spell": SpellData,
    "trait": TraitData,
    "consumable": ConsumableData,
    "component": ComponentData,
    "ship_position": ShipPositionData,
    "computer": ComputerData,
    "psiAbility": PsiAbilityData
  });

  //Extend ActiveEffects class with custom overrides
  CONFIG.ActiveEffect.documentClass = TwodsixActiveEffect;

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
    document.documentElement.style.setProperty('--s2d6-battle-color', game.settings.get('twodsix', 'battleColor'));
  }
  document.documentElement.style.setProperty('--s2d6-damage-stat-color', game.settings.get('twodsix', 'damageStatColor'));

  if (game.settings.get('twodsix', 'useModuleFixStyle') && !game.settings.get('twodsix', 'useFoundryStandardStyle')) {
    switchCss("systems/twodsix/styles/twodsix_moduleFix.css");
  }

  //@ts-ignore
  await foundry.applications.handlebars.loadTemplates(handlebarsTemplateFiles);

  //Add TL to compendium index
  CONFIG.Item.compendiumIndexFields.push('system.techLevel');

  //Game pause icon change
  CONFIG.ui.pause = TwodsixGamePause;
  // All other hooks are found in the module/hooks directory, and should be in the system.json esModules section.

  //Add chat context
  CONFIG.ui.chat = TwodsixChatLog;
  CONFIG.ChatMessage.popoutClass = TwodsixChatPopout;

  //Add Ruler measurements
  CONFIG.Token.rulerClass = TwodsixTokenRuler;
});

Hooks.once('devModeReady', ({ registerPackageDebugFlag }) => {
  registerPackageDebugFlag('twodsix');
});
