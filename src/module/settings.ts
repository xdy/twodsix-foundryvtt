// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
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
  DebugSettings.registerMenu(DebugSettings.create(), "debugSettings", "flask");

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
  stringChoiceSetting('ruleset', TWODSIX.RULESETS["CE"].key, false, Object.fromEntries(rulesetOptions), true);

  game.settings.register("twodsix", "overrideDamageRoll", {
    name: game.i18n.localize("TWODSIX.Settings.overrideDamageRoll.name"),
    hint: game.i18n.localize("TWODSIX.Settings.overrideDamageRoll.hint"),
    scope: "world",      // This specifies a world-level setting
    config: true,        // This specifies that the setting appears in the configuration view
    requiresReload: true, // This will prompt the GM to have all clients reload the application for the setting to
    type: Boolean,
    default: true,         // The default value for the setting
    onChange: _overrideDamageRollSetting
  });
  //booleanSetting('overrideDamageRoll', true, true, 'world', _overrideDamageRollSetting);
  booleanSetting('automateDamageRollOnHit', true, true, game.settings.get('twodsix', 'overrideDamageRoll')? 'world' : 'client');
  booleanSetting('hideUntrainedSkills', false, true, "world", _onHideUntrainedSkillsChange);
  booleanSetting('invertSkillRollShiftClick', false, true);
  booleanSetting('transferDroppedItems', false, true);
  booleanSetting('autoAddUnarmed', false, true);
  numberSetting('weightModifierForWornArmor', 1.0, true);

  function _onHideUntrainedSkillsChange(setting:boolean) {
    if (!setting) {
      TwodsixActor.resetUntrainedSkill();
    } else {
      TwodsixActor.setUntrainedSkillForItems();
    }
  }

  function  _overrideDamageRollSetting(setting:boolean) {
    const currentValue = game.settings.get('twodsix', 'automateDamageRollOnHit');
    if (currentValue !== undefined) {
      const setScope = setting ? 'world' : 'client';
      game.settings.set('twodsix', 'automateDamageRollOnHit', currentValue, {scope: setScope, default: currentValue, config: true, type: Boolean});
    }
  }
};

export function switchCss(fileName:string) {
  const head = document.getElementsByTagName("head")[0];
  const mainCss = document.createElement("link");

  mainCss.setAttribute("rel", "stylesheet");
  mainCss.setAttribute("type", "text/css");
  mainCss.setAttribute("href", fileName);
  mainCss.setAttribute("media", "all");
  head.insertBefore(mainCss, head.lastChild);
}
