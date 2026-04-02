/**
 * This is your TypeScript entry file for Foundry VTT.
 * Register custom settings, sheets, and constants using the Foundry API.
 * Change this heading to be more descriptive to your system, or remove it.
 * Author: See the system.json file, where they are in chronological order.
 * Content License: Basically OGL, see License section of README.md for details
 * Software License: Apache, see License section of README.md for details
 */


import TwodsixCombatTracker from './module/applications/sidebar/TwodsixCombatTracker';

import { COMPONENT_SUBTYPES, CONSUMABLE_SUBTYPES, TWODSIX } from './module/config';
import { AnimalData } from './module/data/actors/animalData.js';
import { RobotData } from './module/data/actors/robotData.js';
import { TravellerData } from './module/data/actors/travellerData.js';
import { TwodsixCombatantData } from './module/data/combats/twodsixCombatantData.js';
import { TwodsixCombatData } from './module/data/combats/twodsixCombatData.js';
import { ArmorData } from './module/data/items/armorData.js';
import { AugmentData } from './module/data/items/augmentData.js';
import { ComponentData } from './module/data/items/componentData.js';
import { ComputerData } from './module/data/items/computerData.js';
import { ConsumableData } from './module/data/items/consumableData.js';
import { GearData } from './module/data/items/gear-data.js';
import { JunkStorageData } from './module/data/items/junkStorageData.js';
import { PsiAbilityData } from './module/data/items/psiAbilityData.js';
import { ShipPositionData } from './module/data/items/shipPositionData.js';
import { SkillData } from './module/data/items/skillData.js';
import { SpellData } from './module/data/items/spellData.js';
import { TraitData } from './module/data/items/traitData.js';
import { WeaponData } from './module/data/items/weaponData.js';
import { ShipData } from './module/data/vehicles/shipData.js';
import { SpaceObjectData } from './module/data/vehicles/spaceObjectData.js';
import { VehicleData } from './module/data/vehicles/vehicleData.js';
import { WorldData } from './module/data/world';
import { AnimalActor } from './module/entities/actors/AnimalActor';
import { RobotActor } from './module/entities/actors/RobotActor';
import { ShipActor } from './module/entities/actors/ShipActor';
import { SpaceObjectActor } from './module/entities/actors/SpaceObjectActor';
import { TravellerActor } from './module/entities/actors/TravellerActor';
import { VehicleActor } from './module/entities/actors/VehicleActor';
import { WorldActor } from './module/entities/actors/WorldActor';
import { ArmorItem } from './module/entities/items/ArmorItem';
import { AugmentItem } from './module/entities/items/AugmentItem';
import { ComponentItem } from './module/entities/items/ComponentItem';
import { COMPONENT_SUBTYPE_CLASSES } from './module/entities/items/components/index.js';
import { ComputerItem } from './module/entities/items/ComputerItem';
import { ConsumableItem } from './module/entities/items/ConsumableItem';
import { CONSUMABLE_SUBTYPE_CLASSES } from './module/entities/items/consumables/index.js';
import { EquipmentItem } from './module/entities/items/EquipmentItem';
import { JunkItem } from './module/entities/items/JunkItem';
import { PsiAbilityItem } from './module/entities/items/PsiAbilityItem';
import { ShipPositionItem } from './module/entities/items/ShipPositionItem';
import { SkillItem } from './module/entities/items/SkillItem';
import { SpellItem } from './module/entities/items/SpellItem';
import { StorageItem } from './module/entities/items/StorageItem';
import { ToolItem } from './module/entities/items/ToolItem';
import { TraitItem } from './module/entities/items/TraitItem';
import { WeaponItem } from './module/entities/items/WeaponItem';
import { TwodsixActiveEffect } from './module/entities/TwodsixActiveEffect';
import TwodsixActor from './module/entities/TwodsixActor';
import { TwodsixChatLog, TwodsixChatPopout } from './module/entities/TwodsixChat';
import TwodsixCombat from './module/entities/TwodsixCombat';
import TwodsixCombatant from './module/entities/TwodsixCombatant';
import { TwodsixGamePause } from './module/entities/TwodsixGamePause';
import TwodsixItem from './module/entities/TwodsixItem';
import registerHandlebarsHelpers from './module/handlebars';
import { registerSettings, switchCss } from './module/settings';
import './module/migration';
import { TwodsixActiveEffectConfig } from './module/sheets/TwodsixActiveEffectConfig';
import { TwodsixAnimalSheet } from './module/sheets/TwodsixAnimalSheet';
import { TwodsixBattleSheet } from './module/sheets/TwodsixBattleSheet';
import { TwodsixItemSheet } from './module/sheets/TwodsixItemSheet';
import { WeaponItemSheet } from './module/sheets/WeaponItemSheet';
import { ComponentItemSheet } from './module/sheets/ComponentItemSheet';
import { ConsumableItemSheet } from './module/sheets/ConsumableItemSheet';
import { SkillItemSheet } from './module/sheets/SkillItemSheet';
import { CareerItemSheet } from './module/sheets/CareerItemSheet';
import { ChargenRulesetItemSheet } from './module/sheets/ChargenRulesetItemSheet';
import { TwodsixRobotSheet } from './module/sheets/TwodsixRobotSheet';
import { TwodsixShipPositionSheet } from './module/sheets/TwodsixShipPositionSheet';
import { TwodsixShipSheet } from './module/sheets/TwodsixShipSheet';
import { TwodsixSpaceObjectSheet } from './module/sheets/TwodsixSpaceObjectSheet';
import { TwodsixNPCSheet, TwodsixTravellerSheet } from './module/sheets/TwodsixTravellerSheet';
import { TwodsixVehicleSheet } from './module/sheets/TwodsixVehicleSheet';
import { TwodsixWorldSheet } from './module/sheets/TwodsixWorldSheet';
import { addCustomEnrichers } from './module/utils/enrichers';
import { rollItemMacro } from './module/utils/rollItemMacro';
import { TwodsixDiceRoll } from './module/utils/TwodsixDiceRoll';
import { TwodsixRollSettings } from './module/utils/TwodsixRollSettings';
import { TwodsixTokenRuler } from './module/utils/TwodsixTokenRuler';
//import { addChatMessageContextOptions } from "./module/hooks/addChatContext";

await Promise.all(hookScriptFiles.map((hookFile) => import(`./module/hooks/${hookFile}.js`)));

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


  game[`twodsix`] = {
    TwodsixActor,
    TwodsixItem,
    TwodsixActiveEffect,
    rollItemMacro,
    TwodsixDiceRoll,
    TwodsixRollSettings
  };
  // Add custom constants for configuration.
  CONFIG.TWODSIX = TWODSIX;

  // Active Effects
  CONFIG.ActiveEffect.phases = {
    initial: { label: "EFFECT.CHANGES.PHASES.initial.label", hint: "EFFECT.CHANGES.PHASES.initial.hint" },
    derived: { label: "EFFECT.CHANGES.PHASES.derived.label", hint: "EFFECT.CHANGES.PHASES.derived.hint" },
    custom: { label: "EFFECT.CHANGES.PHASES.custom.label", hint: "EFFECT.CHANGES.PHASES.custom.hint" },
    encumbMax: { label: "EFFECT.CHANGES.PHASES.encumbMax.label", hint: "EFFECT.CHANGES.PHASES.encumbMax.hint" },
    final: { label: "EFFECT.CHANGES.PHASES.final.label", hint: "EFFECT.CHANGES.PHASES.final.hint" }
  };

  foundry.applications.apps.DocumentSheetConfig.unregisterSheet(CONFIG.ActiveEffect.documentClass, 'core', foundry.applications.sheets.ActiveEffectConfig);
  foundry.applications.apps.DocumentSheetConfig.registerSheet(CONFIG.ActiveEffect.documentClass, `twodsix`, TwodsixActiveEffectConfig, { makeDefault: true });


  // Actor
  CONFIG.Actor.documentClasses = {
    "traveller": TravellerActor,
    "animal": AnimalActor,
    "robot": RobotActor,
    "ship": ShipActor,
    "vehicle": VehicleActor,
    "space-object": SpaceObjectActor,
    "world": WorldActor,
  };
  /** A `Proxy` to get Foundry to construct `TwodsixActor` subclasses */
  CONFIG.Actor.documentClass = new Proxy(TwodsixActor, {
    construct(_target, args) {
      const [data, context] = args;
      const type = data?.type;
      const cls = CONFIG.Actor.documentClasses[type] ?? TwodsixActor;
      return new cls(data, context);
    }
  });
  foundry.documents.collections.Actors.unregisterSheet('core', foundry.appv1.sheets.ActorSheet);
  foundry.documents.collections.Actors.unregisterSheet('core', foundry.applications.sheets.ActorSheetV2);

  // Sheets
  const actorSheetDefinitions = [
    { class: TwodsixAnimalSheet, types: ["animal"], label: "TWODSIX.SheetTypes.AnimalSheet", makeDefault: true },
    { class: TwodsixBattleSheet, types: ["ship"], label: "TWODSIX.SheetTypes.BattleSheet", makeDefault: false },
    { class: TwodsixNPCSheet, types: ["traveller"], label: "TWODSIX.SheetTypes.NPCSheet", makeDefault: false },
    { class: TwodsixRobotSheet, types: ["robot"], label: "TWODSIX.SheetTypes.RobotSheet", makeDefault: true },
    { class: TwodsixShipSheet, types: ["ship"], label: "TWODSIX.SheetTypes.ShipSheet", makeDefault: true },
    { class: TwodsixSpaceObjectSheet, types: ["space-object"], label: "TWODSIX.SheetTypes.SpaceObjectSheet", makeDefault: true },
    { class: TwodsixTravellerSheet, types: ["traveller"], label: "TWODSIX.SheetTypes.TravellerSheet", makeDefault: true },
    { class: TwodsixVehicleSheet, types: ["vehicle"], label: "TWODSIX.SheetTypes.VehicleSheet", makeDefault: true },
    { class: TwodsixWorldSheet, types: ["world"], label: "TWODSIX.SheetTypes.WorldSheet", makeDefault: true },
  ];

  for (const sheetDef of actorSheetDefinitions) {
    foundry.documents.collections.Actors.registerSheet(`twodsix`, sheetDef.class, {
      types: sheetDef.types,
      label: sheetDef.label,
      makeDefault: sheetDef.makeDefault
    });
  }

  /* Load Schemas */
  Object.assign(CONFIG.Actor.dataModels, {
    "animal": AnimalData,
    "robot": RobotData,
    "ship": ShipData,
    "space-object": SpaceObjectData,
    "traveller": TravellerData,
    "vehicle": VehicleData,
    "world": WorldData
  });


  // Items
  CONFIG.Item.documentClasses = {
    "armor": ArmorItem,
    "augment": AugmentItem,
    "component": ComponentItem,
    "computer": ComputerItem,
    "consumable": ConsumableItem,
    "equipment": EquipmentItem,
    "junk": JunkItem,
    "psiAbility": PsiAbilityItem,
    "ship_position": ShipPositionItem,
    "skills": SkillItem,
    "spell": SpellItem,
    "storage": StorageItem,
    "tool": ToolItem,
    "trait": TraitItem,
    "weapon": WeaponItem,
  };
  /** A `Proxy` to get Foundry to construct `TwodsixItem` subclasses */
  CONFIG.Item.documentClass = new Proxy(TwodsixItem, {
    construct(_target, args) {
      const [data, context] = args;
      const type = data?.type;
      if (type === "component") {
        const subtype = data?.system?.subtype ?? COMPONENT_SUBTYPES.OTHER_INTERNAL;
        const cls = COMPONENT_SUBTYPE_CLASSES[subtype] ?? COMPONENT_SUBTYPE_CLASSES._default;
        return new cls(data, context);
      }
      if (type === "consumable") {
        const subtype = data?.system?.subtype ?? CONSUMABLE_SUBTYPES.OTHER;
        const cls = CONSUMABLE_SUBTYPE_CLASSES[subtype] ?? CONSUMABLE_SUBTYPE_CLASSES._default;
        return new cls(data, context);
      }
      const cls = CONFIG.Item.documentClasses[type] ?? TwodsixItem;
      return new cls(data, context);
    }
  });
  /* Load Schemas */
  Object.assign(CONFIG.Item.dataModels, {
    "armor": ArmorData,
    "augment": AugmentData,
    "component": ComponentData,
    "computer": ComputerData,
    "consumable": ConsumableData,
    "equipment": GearData,
    "junk": JunkStorageData,
    "psiAbility": PsiAbilityData,
    "ship_position": ShipPositionData,
    "skills": SkillData,
    "spell": SpellData,
    "storage": JunkStorageData,
    "tool": GearData,
    "trait": TraitData,
    "weapon": WeaponData,
  });

  //Assign Sheets
  foundry.documents.collections.Items.unregisterSheet("core", foundry.applications.sheets.ItemSheetV2);
  //Should unregister untill appv1 goes away (foundry 16 I think?)
  foundry.documents.collections.Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
  const specializedItemTypes = ['weapon', 'component', 'consumable', 'skills', 'career', 'chargen_ruleset', 'ship_position'];
  const baseItemTypes = Object.keys(CONFIG.Item.dataModels).filter(t => !specializedItemTypes.includes(t));

  const itemSheetDefinitions = [
    { class: WeaponItemSheet, types: ["weapon"], label: "TWODSIX.SheetTypes.ItemSheet", makeDefault: true },
    { class: ComponentItemSheet, types: ["component"], label: "TWODSIX.SheetTypes.ItemSheet", makeDefault: true },
    { class: ConsumableItemSheet, types: ["consumable"], label: "TWODSIX.SheetTypes.ItemSheet", makeDefault: true },
    { class: SkillItemSheet, types: ["skills"], label: "TWODSIX.SheetTypes.ItemSheet", makeDefault: true },
    { class: CareerItemSheet, types: ["career"], label: "TWODSIX.SheetTypes.ItemSheet", makeDefault: true },
    { class: ChargenRulesetItemSheet, types: ["chargen_ruleset"], label: "TWODSIX.SheetTypes.ItemSheet", makeDefault: true },
    { class: TwodsixItemSheet, types: baseItemTypes, label: "TWODSIX.SheetTypes.ItemSheet", makeDefault: true },
    { class: TwodsixShipPositionSheet, types: ["ship_position"], label: "TWODSIX.SheetTypes.ShipPositionSheet", makeDefault: true },
  ];

  for (const sheetDef of itemSheetDefinitions) {
    foundry.documents.collections.Items.registerSheet(`twodsix`, sheetDef.class, {
      types: sheetDef.types,
      label: sheetDef.label,
      makeDefault: sheetDef.makeDefault
    });
  }

  //Extend ActiveEffects class with custom overrides
  CONFIG.ActiveEffect.documentClass = TwodsixActiveEffect;

  //Extend Combat and Combatant classes with custom overrides and data models
  CONFIG.Combat.documentClass = TwodsixCombat;
  CONFIG.Combat.dataModels = TwodsixCombatData;
  CONFIG.Combatant.documentClass = TwodsixCombatant;
  CONFIG.Combatant.dataModels = TwodsixCombatantData;

  registerHandlebarsHelpers();

  registerSettings();

  //Dice Rolls
  CONFIG.Dice.rolls.push(TwodsixDiceRoll);

  //Add custom Enrichers
  addCustomEnrichers();

  /* add fonts */
  // @ts-expect-error Font definitions are not typed in Foundry config.
  CONFIG.fontDefinitions["Asap"] = {
    editor: true,
    fonts: [
      {urls: [`systems/twodsix/fonts/Asap-Regular.woff2`, `systems/twodsix/fonts/Asap-Regular.ttf`]},
      {urls: [`systems/twodsix/fonts/Asap-Bold.woff2`, `systems/twodsix/fonts/Asap-Bold.ttf`], weight: 700},
      {urls: [`systems/twodsix/fonts/Asap-Italic.woff2`, `systems/twodsix/fonts/Asap-Italic.ttf`], style: "italic"},
      {
        urls: [`systems/twodsix/fonts/Asap-BoldItalic.woff2`, `systems/twodsix/fonts/Asap-BoldItalic.ttf`],
        style: "italic",
        weight: 700
      }
    ]
  };
  CONFIG.fontDefinitions["Rye"] = {
    editor: true,
    fonts: [
      {urls: [`systems/twodsix/fonts/Rye-Regular.ttf`]},
    ]
  };

  /*Add time for a combat round default*/
  CONFIG.time.roundTime = 6;

  /*Register CSS Styles*/

  let sheetName = `systems/twodsix/styles/`;
  const themeStyle = game.settings.get(`twodsix`, 'themeStyle');
  switch (themeStyle) {
    case "foundry":
      sheetName += "twodsix_basic.css";
      break;
    case "western":
      sheetName += "twodsix-western-theme.css";
      break;
    case "classic":
      sheetName += "twodsix.css";
      break;
    default:
      sheetName += "twodsix_basic.css";
  }
  switchCss(sheetName);

  if (themeStyle === "classic") {
    if (game.settings.get(`twodsix`, 'useModuleFixStyle')) {
      switchCss(`systems/twodsix/styles/twodsix_moduleFix.css`);
    }
    // Set CSS variables on the document root
    const defaultColor = game.settings.get(`twodsix`, 'defaultColor');
    const lightColor = game.settings.get(`twodsix`, 'lightColor');
    const battleColor = game.settings.get(`twodsix`, 'battleColor');
    const damageColor = game.settings.get(`twodsix`, 'damageStatColor');
    document.documentElement.style.setProperty('--s2d6-default-color', defaultColor);
    document.documentElement.style.setProperty('--s2d6-light-color', lightColor);
    document.documentElement.style.setProperty('--s2d6-battle-color', battleColor);
    document.documentElement.style.setProperty('--s2d6-damage-stat-color', damageColor);
  }

  // @ts-expect-error Handlebars template loader typing is missing in Foundry types.
  await foundry.applications.handlebars.loadTemplates(handlebarsTemplateFiles);

  //Add TL to compendium index
  CONFIG.Item.compendiumIndexFields.push('system.techLevel');

  //Game pause icon change
  CONFIG.ui.pause = TwodsixGamePause;
  // All other hooks are found in the module/hooks directory, and should be in the system.json esModules section.

  //Add chat context
  CONFIG.ui.chat = TwodsixChatLog;
  CONFIG.ChatMessage.popoutClass = TwodsixChatPopout;

  //Add custom combat tracker for space combat
  CONFIG.ui.combat = TwodsixCombatTracker;

  //Add Ruler measurements
  CONFIG.Token.rulerClass = TwodsixTokenRuler;
});

Hooks.once('devModeReady', ({registerPackageDebugFlag}) => {
  registerPackageDebugFlag(`${systemId}`);
});
