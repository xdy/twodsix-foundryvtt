// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import RulsetSettings from "./settings/RulsetSettings";
import ItemSettings from "./settings/ItemSettings";
import DisplaySettings from "./settings/DisplaySettings";
import DebugSettings from "./settings/DebugSettings";

import {TWODSIX} from "./config";
import TwodsixActor from "./entities/TwodsixActor";
import { booleanSetting, stringChoiceSetting } from "./settings/settingsUtils";



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
  //need a custom setting to use requiresReload
  game.settings.register("twodsix", "overrideDamageRoll", {
    name: game.i18n.localize("TWODSIX.Settings.overrideDamageRoll.name"),
    hint: game.i18n.localize("TWODSIX.Settings.overrideDamageRoll.hint"),
    scope: "world",
    config: true,
    requiresReload: true,
    type: Boolean,
    default: false,
    onChange: _overrideDamageRollSetting
  });

  booleanSetting('automateDamageRollOnHit', true, true, game.settings.get('twodsix', 'overrideDamageRoll')? 'world' : 'client');
  booleanSetting('autoDamageTarget', false, true, "world");
  booleanSetting('hideUntrainedSkills', false, true, "world", _onHideUntrainedSkillsChange);
  booleanSetting('invertSkillRollShiftClick', false, true);
  booleanSetting('transferDroppedItems', false, true);
  booleanSetting('autoAddUnarmed', false, true);

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
