import AdvancedSettings from "./AdvancedSettings";
import {TWODSIX} from "../config";
import {booleanSetting, numberSetting, stringChoiceSetting, stringSetting} from "./settingsUtils";

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

  static registerSettings(): string[] {
    const DEFAULT_INITIATIVE_FORMULA = "2d6 + @characteristics.dexterity.mod";
    // TODO: With the new ship positions this should be changed to take the pilot's piloting skill into consideration.
    const DEFAULT_SHIP_INITIATIVE_FORMULA = "2d6";
    const DEFAULT_MAX_ENCUMBRANCE_FORMULA = "12 * @characteristics.strength.current";

    const settings: string[] = [];
    settings.push(stringSetting('initiativeFormula', DEFAULT_INITIATIVE_FORMULA, false, 'world'));
    settings.push(stringSetting('shipInitiativeFormula', DEFAULT_SHIP_INITIATIVE_FORMULA, false, 'world'));
    settings.push(stringChoiceSetting('difficultyListUsed', TWODSIX.RULESETS.CE.key, TWODSIX.VARIANTS));
    settings.push(booleanSetting('difficultiesAsTargetNumber', false));
    settings.push(stringChoiceSetting('autofireRulesUsed', TWODSIX.RULESETS.CE.key, TWODSIX.VARIANTS));
    settings.push(numberSetting('modifierForZeroCharacteristic', -2));
    settings.push(stringSetting('termForAdvantage', 'advantage'));
    settings.push(stringSetting('termForDisadvantage', 'disadvantage'));
    settings.push(numberSetting('absoluteBonusValueForEachTimeIncrement', -1));
    settings.push(numberSetting('maxSkillLevel', 9));
    settings.push(booleanSetting('criticalNaturalAffectsEffect', false));
    settings.push(numberSetting('absoluteCriticalEffectValue', 99));
    settings.push(booleanSetting('showLifebloodStamina', false));
    settings.push(numberSetting('minorWoundsRollModifier', -1));
    settings.push(numberSetting('seriousWoundsRollModifier', -2));
    settings.push(booleanSetting('lifebloodInsteadOfCharacteristics', false));
    settings.push(booleanSetting('showContaminationBelowLifeblood', true));
    settings.push(booleanSetting('showHeroPoints', false));
    settings.push(stringChoiceSetting('showAlternativeCharacteristics', "base", TWODSIX.CharacteristicDisplayTypes));
    settings.push(stringSetting("alternativeShort1", "ALT1"));
    settings.push(stringSetting("alternativeShort2", "ALT2"));
    settings.push(numberSetting('maxComponentHits', 3));
    settings.push(numberSetting('mortgagePayment', 240, true));
    settings.push(numberSetting('massProductionDiscount', 0.10, true));
    settings.push(booleanSetting('reverseHealingOrder', false));
    settings.push(stringSetting("maxEncumbrance", DEFAULT_MAX_ENCUMBRANCE_FORMULA, false, "world"));
    settings.push(numberSetting('defaultMovement', 10));
    settings.push(stringChoiceSetting('defaultMovementUnits', "m", TWODSIX.MovementUnitsUnLocalized));
    settings.push(booleanSetting('addEffectForShipDamage', false));
    settings.push(stringSetting("unarmedDamage", "1d6", false, "world"));
    settings.push(booleanSetting("showTimeframe", false));
    return settings;
  }
}
