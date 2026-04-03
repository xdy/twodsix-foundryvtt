import { TWODSIX } from './config';
import TwodsixActor from './entities/TwodsixActor';
import DebugSettings from './settings/DebugSettings';
import DisplaySettings from './settings/DisplaySettings';
import ItemSettings from './settings/ItemSettings';
import RulesetSettings from './settings/RulesetSettings';
import { booleanSetting, stringChoiceSetting, stringSetting } from './settings/settingsUtils';


export const registerSettings = function() {
  RulesetSettings.registerMenu(RulesetSettings.create(), "rulesetSettings", "gavel");
  ItemSettings.registerMenu(ItemSettings.create(), "itemSettings", "bars");
  DisplaySettings.registerMenu(DisplaySettings.create(), "displaySettings", "tv");
  DebugSettings.registerMenu(DebugSettings.create(), "debugSettings", "flask");

  const rulesetOptions = Object.entries(TWODSIX.RULESETS).map(([id, ruleset]) => {
    return [id, ruleset["name"]];
  }).sort((a, b) => a[1].localeCompare(b[1], game.i18n.lang, { sensitivity: 'base' }));
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
  booleanSetting('NoDuplicatesOnHotbar', false, true, "client");
  //Store default partials for items and compendium tab - hidden
  stringSetting('defaultItemPartial', foundry.applications.sidebar.tabs.ItemDirectory._entryPartial, false, "client");
  stringSetting('defaultCompendiumPartial', foundry.applications.sidebar.apps.Compendium._entryPartial, false, "client");

  function _onHideUntrainedSkillsChange(setting) {
    if (!setting) {
      TwodsixActor.resetUntrainedSkill();
    } else {
      TwodsixActor.setUntrainedSkillForItems();
    }
  }

  async function  _overrideDamageRollSetting(setting) {
    const currentValue = game.settings.get('twodsix', 'automateDamageRollOnHit');
    if (currentValue !== undefined) {
      const setScope = setting ? 'world' : 'client';
      await game.settings.set('twodsix', 'automateDamageRollOnHit', currentValue, {scope: setScope, default: currentValue, config: true, type: Boolean});
    }
  }
};

/**
 * @param {string} fileName
 * @returns {void}
 */
export function switchCss(fileName) {
  const head = document.getElementsByTagName("head")[0];
  const mainCss = document.createElement("style");

  mainCss.textContent = ` @import "${fileName}" layer(system); `;
  head.insertBefore(mainCss, head.lastChild);
}
