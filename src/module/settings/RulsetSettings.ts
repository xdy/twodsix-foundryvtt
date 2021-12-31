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
    const rulesetName = ruleset.name + (settings.every(v => v === true) ? "" : ` (${modified})`);

    data.intro = `<h2>${game.i18n.localize(`TWODSIX.Settings.settingsInterface.rulesetSettings.intro`)}: ${rulesetName}</h2><br>`;
    return data;
  }

  static registerSettings(): string[] {
    const DEFAULT_INITIATIVE_FORMULA = "2d6 + @characteristics.dexterity.mod";
    const onChangeInitformula = (formula: string) => CONFIG.Combat.initiative = {
      formula: formula,
      decimals: 0
    };
    const settings: string[] = [];
    settings.push(stringSetting('initiativeFormula', DEFAULT_INITIATIVE_FORMULA, false, 'world', onChangeInitformula));
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
    settings.push(booleanSetting('lifebloodInsteadOfCharacteristics', false));
    settings.push(booleanSetting('showContaminationBelowLifeblood', true));
    settings.push(booleanSetting('showHeroPoints', false));
    settings.push(booleanSetting('showAlternativeCharacteristics', false));
    settings.push(stringSetting("alternativeShort1", "ALT1"));
    settings.push(stringSetting("alternativeShort2", "ALT2"));
    return settings;
  }
}
