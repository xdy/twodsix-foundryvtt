import RulsetSettings from "./settings/RulsetSettings";
import ItemSettings from "./settings/ItemSettings";
import DisplaySettings from "./settings/DisplaySettings";
import DebugSettings from "./settings/DebugSettings";

import {TWODSIX} from "./config";
import TwodsixActor from "./entities/TwodsixActor";
import { booleanSetting, numberSetting, stringChoiceSetting } from "./settings/settingsUtils";



export const registerSettings = function ():void {
  RulsetSettings.registerMenu(RulsetSettings.create(), "rulesetSettings", "gavel");
  ItemSettings.registerMenu(ItemSettings.create(), "itemSettings", "bars");
  DisplaySettings.registerMenu(DisplaySettings.create(), "displaySettings", "tv");
  DebugSettings.registerMenu(DebugSettings.create(), "debugSettings", "bug");

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
  stringChoiceSetting('ruleset', TWODSIX.RULESETS["CE"].key, Object.fromEntries(rulesetOptions), true);

  booleanSetting('automateDamageRollOnHit', false, true, 'client');
  booleanSetting('hideUntrainedSkills', false, true, "world", _onHideUntrainedSkillsChange);
  booleanSetting('invertSkillRollShiftClick', false, true);
  numberSetting('weightModifierForWornArmor', 1.0, true);

  function _onHideUntrainedSkillsChange(setting:boolean) {
    if (!setting) {
      TwodsixActor.resetUntrainedSkill();
    } else {
      TwodsixActor.setUntrainedSkillForWeapons();
    }
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
