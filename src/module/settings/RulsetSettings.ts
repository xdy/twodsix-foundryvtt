// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import AdvancedSettings from "./AdvancedSettings";
import {TWODSIX} from "../config";
import {booleanSetting, largeStringSetting, numberSetting, stringChoiceSetting, stringSetting} from "./settingsUtils";
import { refreshWindow } from "./DisplaySettings";
import { generateTargetDMObject } from "../utils/targetModifiers";

export default class RulesetSettings extends AdvancedSettings {
  static create() {
    RulesetSettings.settings = RulesetSettings.registerSettings();
    return RulesetSettings;
  }

  constructor(object, options?) {
    super(object, RulesetSettings.settings, options);
  }

  /** @override */
  getData() {
    const data = super.getData();
    const ruleset = TWODSIX.RULESETS[game.settings.get("twodsix", "ruleset")];
    const rulesetSettings = TWODSIX.RULESETS[ruleset.key].settings;
    const settings = Object.entries(rulesetSettings).map(([settingName, value]) => {
      return game.settings.get("twodsix", settingName) === value;
    });
    const modified = game.i18n.localize("TWODSIX.Settings.settingsInterface.rulesetSettings.modified");
    const rulesetName = ruleset.name + (settings.every(v => v) ? "" : ` (${modified})`);

    data.intro = `<h2>${game.i18n.localize(`TWODSIX.Settings.settingsInterface.rulesetSettings.intro`)}: ${rulesetName}</h2><br>`;
    return data;
  }

  static registerSettings(): any {
    const DEFAULT_INITIATIVE_FORMULA = "2d6 + @characteristics.dexterity.mod";
    // TODO: With the new ship positions this should be changed to take the pilot's piloting skill into consideration.
    const DEFAULT_SHIP_INITIATIVE_FORMULA = "2d6";
    const DEFAULT_MAX_ENCUMBRANCE_FORMULA = "12 * @characteristics.strength.current";

    const settings = {
      general: [],
      roll: [],
      characteristics: [],
      damage: [],
      movement: [],
      encumbrance: [],
      wounds: [],
      ship: [],
      animals_robots: []
    };
    settings.general.push(stringSetting('initiativeFormula', DEFAULT_INITIATIVE_FORMULA, false, 'world'));
    settings.damage.push(stringSetting('armorDamageFormula', "@damage - @effectiveArmor", false, 'world'));
    settings.damage.push(booleanSetting('useMaxArmorValue', false, false, 'world', refreshWindow));
    settings.ship.push(stringSetting('shipInitiativeFormula', DEFAULT_SHIP_INITIATIVE_FORMULA, false, 'world'));
    settings.roll.push(stringChoiceSetting('difficultyListUsed', TWODSIX.RULESETS.CE.key, false, TWODSIX.DIFFICULTY_VARIANTS));
    settings.roll.push(booleanSetting('difficultiesAsTargetNumber', false));
    settings.general.push(stringChoiceSetting('autofireRulesUsed', TWODSIX.RULESETS.CE.key, false, TWODSIX.AUTOFIRE_VARIANTS));
    settings.characteristics.push(numberSetting('modifierForZeroCharacteristic', -2));
    settings.roll.push(stringSetting('termForAdvantage', 'advantage'));
    settings.roll.push(stringSetting('termForDisadvantage', 'disadvantage'));
    settings.roll.push(numberSetting('absoluteBonusValueForEachTimeIncrement', -1));
    settings.general.push(numberSetting('maxSkillLevel', 9));
    settings.roll.push(booleanSetting('criticalNaturalAffectsEffect', false));
    settings.roll.push(numberSetting('absoluteCriticalEffectValue', 99));
    settings.characteristics.push(booleanSetting('showLifebloodStamina', false));
    settings.wounds.push(numberSetting('minorWoundsRollModifier', 0));
    settings.wounds.push(numberSetting('seriousWoundsRollModifier', 0));
    settings.characteristics.push(booleanSetting('lifebloodInsteadOfCharacteristics', false));
    settings.characteristics.push(booleanSetting('showContaminationBelowLifeblood', true));
    settings.characteristics.push(booleanSetting('showHeroPoints', false));
    settings.characteristics.push(stringChoiceSetting('showAlternativeCharacteristics', "base", true, TWODSIX.CharacteristicDisplayTypes));
    settings.characteristics.push(stringSetting("shortSTR", "TWODSIX.Items.Skills.STR", false, "world", updateSTRShortLabel, true));
    settings.characteristics.push(stringSetting("shortDEX", "TWODSIX.Items.Skills.DEX", false, "world", updateDEXShortLabel, true));
    settings.characteristics.push(stringSetting("shortEND", "TWODSIX.Items.Skills.END", false, "world", updateENDShortLabel, true));
    settings.characteristics.push(stringSetting("shortINT", "TWODSIX.Items.Skills.INT", false, "world", updateINTShortLabel, true));
    settings.characteristics.push(stringSetting("shortEDU", "TWODSIX.Items.Skills.EDU", false, "world", updateEDUShortLabel, true));
    settings.characteristics.push(stringSetting("shortSOC", "TWODSIX.Items.Skills.SOC", false, "world", updateSOCShortLabel, true));
    settings.characteristics.push(stringSetting("shortPSI", "TWODSIX.Items.Skills.PSI", false, "world", updatePSIShortLabel, true));
    settings.characteristics.push(stringSetting("alternativeShort1", "ALT1"));
    settings.characteristics.push(stringSetting("alternativeShort2", "ALT2"));
    settings.characteristics.push(stringSetting("alternativeShort3", "ALT3"));
    settings.ship.push(numberSetting('maxComponentHits', 3));
    settings.ship.push(numberSetting('mortgagePayment', 240, false));
    settings.ship.push(stringSetting('massProductionDiscount', "0.10", false)); //Should be a number setting, but FVTT unhappy with values other than 0.5
    settings.wounds.push(booleanSetting('reverseHealingOrder', false));
    settings.encumbrance.push(stringSetting("maxEncumbrance", DEFAULT_MAX_ENCUMBRANCE_FORMULA, false, "world"));
    settings.encumbrance.push(stringSetting('encumbranceFraction', "0.5", false)); //Should be a number setting, but FVTT unhappy with values other than 0.5
    settings.encumbrance.push(numberSetting('encumbranceModifier', -1, false));
    settings.encumbrance.push(stringSetting('weightModifierForWornArmor', "1.0", false));
    settings.movement.push(numberSetting('defaultMovement', 10));
    settings.movement.push(stringChoiceSetting('defaultMovementUnits', "m", true, TWODSIX.MovementUnits));
    settings.movement.push(stringSetting('encumbFractionOneSquare', "0.5")); //Should be a number setting, but FVTT unhappy with values other than 0.5
    settings.movement.push(stringSetting('encumbFraction75pct', "0.33")); //Should be a number setting, but FVTT unhappy with values other than 0.5
    settings.ship.push(booleanSetting('addEffectForShipDamage', false));
    settings.damage.push(stringSetting("unarmedDamage", "1d6", false, "world"));
    settings.roll.push(booleanSetting("showTimeframe", false));
    settings.general.push(stringChoiceSetting('showHullAndArmor', "armorOnly", true, TWODSIX.VehicleProtection));
    settings.general.push(stringSetting("sorcerySkill", "Sorcery", false, "world"));
    settings.general.push(numberSetting("maxSpellLevel", 7, false, "world"));
    settings.general.push(booleanSetting("useNationality", false));
    settings.animals_robots.push(booleanSetting("animalsUseHits", false));
    settings.animals_robots.push(booleanSetting("robotsUseHits", false));
    settings.animals_robots.push(booleanSetting("animalsUseLocations", false));
    settings.animals_robots.push(booleanSetting("animalTypesIndependentofNiche", false));
    settings.animals_robots.push(booleanSetting("displayReactionMorale", false));
    settings.damage.push(booleanSetting("useDodgeParry", false));
    settings.damage.push(largeStringSetting("damageTypeOptions", "", false, "world"));
    settings.damage.push(booleanSetting('addEffectToDamage', true, false, "world", checkManualDamageSetting));
    settings.damage.push(booleanSetting('addEffectToManualDamage', false, false, "world", checkManualDamageSetting));
    settings.roll.push(stringChoiceSetting('useDegreesOfSuccess', "none", true, TWODSIX.SuccessTypes));
    settings.roll.push(booleanSetting("overrideSuccessWithNaturalCrit", false));
    settings.general.push(stringChoiceSetting('rangeModifierType', "none", true, TWODSIX.RANGE_MODIFIERS_TYPES));
    settings.general.push(numberSetting("meleeRange", 2, false, "world"));
    settings.roll.push(largeStringSetting('targetDMList', "", false, "world", generateTargetDMObject));
    settings.roll.push(stringSetting('chainBonus', "", false, 'world'));
    return settings;
  }
}

export const checkManualDamageSetting = function () {
  if (!game.settings.get('twodsix', 'addEffectToDamage') && game.settings.get('twodsix', 'addEffectToManualDamage')) {
    game.settings.set('twodsix', 'addEffectToManualDamage', false);
    ui.notifications.warn(game.i18n.localize("TWODSIX.Warnings.ResetEffectForManualDamage"));
  }
};

export const updateSTRShortLabel = function (value:string) {
  if (!value) {
    game.settings.set('twodsix', "shortSTR", "TWODSIX.Items.Skills.STR");
  }
};

export const updateDEXShortLabel = function (value:string) {
  if (!value) {
    game.settings.set('twodsix', "shortDEX", "TWODSIX.Items.Skills.DEX");
  }
};

export const updateENDShortLabel = function (value:string) {
  if (!value) {
    game.settings.set('twodsix', "shortEND", "TWODSIX.Items.Skills.END");
  }
};

export const updateINTShortLabel = function (value:string) {
  if (!value) {
    game.settings.set('twodsix', "shortINT", "TWODSIX.Items.Skills.INT");
  }
};

export const updateEDUShortLabel = function (value:string) {
  if (!value) {
    game.settings.set('twodsix', "shortEDU", "TWODSIX.Items.Skills.EDU");
  }
};

export const updateSOCShortLabel = function (value:string) {
  if (!value) {
    game.settings.set('twodsix', "shortSOC", "TWODSIX.Items.Skills.SOC");
  }
};

export const updatePSIShortLabel = function (value:string) {
  if (!value) {
    game.settings.set('twodsix', "shortPSI", "TWODSIX.Items.Skills.PSI");
  }
};
