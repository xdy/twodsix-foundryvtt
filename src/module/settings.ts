import AdvancedSettings from "./AdvancedSettings";
import {TWODSIX} from "./config";
import TwodsixActor from "./entities/TwodsixActor";

class RulesetSettings extends AdvancedSettings {
  static settings = ["initiativeFormula", "difficultyListUsed", "difficultiesAsTargetNumber", "autofireRulesUsed", "modifierForZeroCharacteristic", "termForAdvantage",
    "termForDisadvantage", "absoluteBonusValueForEachTimeIncrement", 'maxSkillLevel', "criticalNaturalAffectsEffect", "absoluteCriticalEffectValue", "showLifebloodStamina",
    "lifebloodInsteadOfCharacteristics", "showContaminationBelowLifeblood", 'showHeroPoints', 'showAlternativeCharacteristics', "alternativeShort1", "alternativeShort2"];
  constructor() {
    super();
    const ruleset = TWODSIX.RULESETS[game.settings.get("twodsix", "ruleset")].name;
    this.intro = `<h2>Current rules: ${ruleset}</h2><br>`;
    this.settings = RulesetSettings.settings;
  }
}

class ItemSettings extends AdvancedSettings {
  static settings = ["ShowLawLevel", "ShowRangeBandAndHideRange", "ShowWeaponType", "ShowDamageType", "ShowRateOfFire", "ShowRecoil"];
  constructor() {
    super();
    this.intro = `<h2>Item Display Settings</h2><br>`;
    this.settings = ItemSettings.settings;
  }
}

class DisplaySettings extends AdvancedSettings {
  static settings = ['defaultTokenSettings', 'useSystemDefaultTokenIcon', 'showMissingCompendiumWarnings', 'showSingleComponentColumn', 'useFoundryStandardStyle','useWoundedStatusIndicators' ];
  constructor() {
    super();
    this.intro = `<h2>General Display Settings</h2><br>`;
    this.settings = DisplaySettings.settings;
  }
}
class DebugSettings extends AdvancedSettings {
  static settings = ['ExperimentalFeatures', 'systemMigrationVersion'];
  constructor() {
    super();
    this.intro = `<h2>Debug Settings</h2><br>`;
    this.settings = DebugSettings.settings;
  }
}
export const registerSettings = function ():void {

  const advancedSettings = RulesetSettings.settings.concat(ItemSettings.settings).concat(DisplaySettings.settings).concat(DebugSettings.settings);

  game.settings.registerMenu("twodsix", "rulesetSettings", {
    name: "Advanced Ruleset Settings",
    label: "Advanced Ruleset Settings",
    hint: "Here you can configure the ruleset settings.",
    icon: "fas fa-gavel",
    type: RulesetSettings,
    restricted: true
  });

  game.settings.registerMenu("twodsix", "itemSettings", {
    name: "Item Settings",
    label: "Item Settings",
    hint: "Here you can configure the item settings.",
    icon: "fas fa-bars",
    type: ItemSettings,
    restricted: true
  });

  game.settings.registerMenu("twodsix", "displaySettings", {
    name: "Display Settings",
    label: "Display Settings",
    hint: "Here you can configure the display settings.",
    icon: "fas fa-tv",
    type: DisplaySettings,
    restricted: true
  });

  game.settings.registerMenu("twodsix", "debugSettings", {
    name: "Debug Settings",
    label: "Debug Settings",
    hint: "Here you can configure the debug settings / information.",
    icon: "fas fa-bug",
    type: DebugSettings,
    restricted: true
  });

  const rulesetOptions = Object.entries(TWODSIX.RULESETS).map(([id, ruleset]) => {
    return [id, ruleset["name"]];
  }).sort(function (a, b) {
    if (a[1] < b[1]) {
      return -1;
    }
    if (a[1] > b[1]) {
      return 1;
    }
    return 0;
  });
  _stringChoiceSetting('ruleset', TWODSIX.RULESETS["CE"].name, Object.fromEntries(rulesetOptions));

  //Foundry default behaviour related settings
  _booleanSetting('defaultTokenSettings', true);
  _booleanSetting('useSystemDefaultTokenIcon', false);

  //House rules/variant related settings
  const DEFAULT_INITIATIVE_FORMULA = "2d6 + @characteristics.dexterity.mod";
  _stringSetting('initiativeFormula', DEFAULT_INITIATIVE_FORMULA, 'world', formula => CONFIG.Combat.initiative = {
    formula: formula,
    decimals: 0
  });
  _numberSetting('modifierForZeroCharacteristic', -2);
  _stringSetting('termForAdvantage', 'advantage');
  _stringSetting('termForDisadvantage', 'disadvantage');

  //Automation related settings
  _booleanSetting('automateDamageRollOnHit', false, 'client');

  //Cepheus weaponry related settings
  _booleanSetting('ShowLawLevel', false);
  _booleanSetting('ShowRangeBandAndHideRange', false);
  _booleanSetting('ShowWeaponType', false);
  _booleanSetting('ShowDamageType', false);
  _booleanSetting('ShowRateOfFire', true);
  _booleanSetting('ShowRecoil', false);

  _stringChoiceSetting('difficultyListUsed', TWODSIX.RULESETS.CE.key, TWODSIX.VARIANTS);
  _booleanSetting('difficultiesAsTargetNumber', false);

  _booleanSetting('ExperimentalFeatures', false);

  _booleanSetting('hideUntrainedSkills', false, "world", _onHideUntrainedSkillsChange);

  _stringChoiceSetting('autofireRulesUsed', TWODSIX.RULESETS.CE.key, TWODSIX.VARIANTS);

  _booleanSetting('showMissingCompendiumWarnings', true);
  _booleanSetting('criticalNaturalAffectsEffect', false);
  _numberSetting('absoluteCriticalEffectValue', 99);

  _booleanSetting('invertSkillRollShiftClick', false);
  _booleanSetting('lifebloodInsteadOfCharacteristics', false);
  _booleanSetting('showContaminationBelowLifeblood', true);
  _booleanSetting('showLifebloodStamina', false);
  _booleanSetting('showHeroPoints', false);
  _booleanSetting('showSingleComponentColumn', false);

  _numberSetting('weightModifierForWornArmor', 1.0);

  _booleanSetting('useFoundryStandardStyle', false, 'world', refreshWindow);

  _booleanSetting('showAlternativeCharacteristics', false);
  _stringSetting("alternativeShort1", "ALT1");
  _stringSetting("alternativeShort2", "ALT2");
  _booleanSetting('useWoundedStatusIndicators', false);

  //As yet unused
  _numberSetting('maxSkillLevel', 9);
  _numberSetting('absoluteBonusValueForEachTimeIncrement', -1);


  //Must be the last setting in the file
  _stringSetting('systemMigrationVersion', game.system.data.version);

  //Utility functions
  function _booleanSetting(key:string, defaultValue:boolean, scope = 'world', onChange = null):void {
    game.settings.register('twodsix', key, {
      name: game.i18n.localize(`TWODSIX.Settings.${key}.name`),
      hint: game.i18n.localize(`TWODSIX.Settings.${key}.hint`),
      scope: scope,
      config: !advancedSettings.includes(key),
      default: defaultValue,
      type: Boolean,
      onChange: onChange
    });
  }

  function _numberSetting(key:string, defaultValue:number, scope = 'world', onChange = null):void {
    game.settings.register('twodsix', key.replace('.', ''), {
      name: game.i18n.localize(`TWODSIX.Settings.${key}.name`),
      hint: game.i18n.localize(`TWODSIX.Settings.${key}.hint`),
      scope: scope,
      config: !advancedSettings.includes(key),
      default: defaultValue,
      type: Number,
      onChange: onChange
    });
  }

  function _stringChoiceSetting(key:string, defaultValue:string, choices, scope = 'world', onChange = null):void {
    game.settings.register('twodsix', key.replace('.', ''), {
      name: game.i18n.localize(`TWODSIX.Settings.${key}.name`),
      hint: game.i18n.localize(`TWODSIX.Settings.${key}.hint`),
      scope: scope,
      config: !advancedSettings.includes(key),
      default: defaultValue,
      type: String,
      onChange: onChange,
      choices: choices
    });
  }

  function _stringSetting(key:string, defaultValue:string, scope = 'world', onChange = null):void {
    game.settings.register('twodsix', key.replace('.', ''), {
      name: game.i18n.localize(`TWODSIX.Settings.${key}.name`),
      hint: game.i18n.localize(`TWODSIX.Settings.${key}.hint`),
      scope: scope,
      config: !advancedSettings.includes(key),
      default: defaultValue,
      type: String,
      onChange: onChange
    });
  }

  function _onHideUntrainedSkillsChange(setting:boolean) {
    if (!setting) {
      TwodsixActor.resetUntrainedSkill();
    } else {
      TwodsixActor.setUntrainedSkillForWeapons();
    }
  }

  function refreshWindow() {
    /*switchCss();*/
    window.location.reload();
  }
};

export function switchCss() {
  const head = document.getElementsByTagName("head")[0];
  const mainCss = document.createElement("link");
  let sheetName = "systems/twodsix/styles/";
  if (game.settings.get('twodsix', 'useFoundryStandardStyle')) {
    sheetName += "twodsix_basic.css";
  } else {
    sheetName += "twodsix.css";
  }
  mainCss.setAttribute("rel", "stylesheet");
  mainCss.setAttribute("type", "text/css");
  mainCss.setAttribute("href", sheetName);
  mainCss.setAttribute("media", "all");
  head.insertBefore(mainCss, head.lastChild);
}

export function getCharShortName(char: string): string {
  switch (char) {
    case "ALT1":
      return game.settings.get('twodsix', 'alternativeShort1');
      break;
    case "ALT2":
      return game.settings.get('twodsix', 'alternativeShort2');
      break;
    default:
      return game.i18n.localize("TWODSIX.Items.Skills." + char);
  }
}
