import {TWODSIX} from "./config";
import TwodsixActor from "./entities/TwodsixActor";

export const registerSettings = function ():void {

  //Foundry default behaviour related settings
  _booleanSetting('defaultTokenSettings', true);
  _booleanSetting('useSystemDefaultTokenIcon', false);

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
  
  /*game.settings.register('twodsix', 'useFoundryStandardStyle', {
    name: game.i18n.localize('TWODSIX.Settings.useFoundryStandardStyle.name'),
    hint: game.i18n.localize('TWODSIX.Settings.useFoundryStandardStyle.hint'),
    scope: 'world',
    config: true,
    type: String,
    choices: {
      'twodsixStyle': game.i18n.localize('TWODSIX.Settings.useFoundryStandardStyle.default'),
      'foundryStyle': game.i18n.localize('TWODSIX.Settings.useFoundryStandardStyle.foundry'),
    },
    default: 'awesomeOldStyle',
    onChange: () => switchCss(),
  });*/
  _booleanSetting('showAlternativeCharacteristics', false);
  _stringSetting("alternativeShort1", "ALT1");
  _stringSetting("alternativeShort2", "ALT2");

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
      config: true,
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
      config: true,
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
      config: true,
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
      config: true,
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
}

export function switchCss() {
  const head = document.getElementsByTagName("head")[0];
  const mainCss = document.createElement("link");
  let sheetName = "systems/twodsix/styles/";
  if (game.settings.get('twodsix', 'useFoundryStandardStyle')) {
    sheetName += "twodsix_basic.css";
  } else {
    sheetName += "twodsix.css";
  }
  mainCss.setAttribute("rel", "stylesheet")
  mainCss.setAttribute("type", "text/css")
  mainCss.setAttribute("href", sheetName)
  mainCss.setAttribute("media", "all")
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