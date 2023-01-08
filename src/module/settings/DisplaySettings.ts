import AdvancedSettings from "./AdvancedSettings";
import {booleanSetting, colorSetting} from "./settingsUtils";

export default class DisplaySettings extends AdvancedSettings {
  static create() {
    DisplaySettings.settings = DisplaySettings.registerSettings();
    return DisplaySettings;
  }

  constructor(object, options?) {
    super(object, DisplaySettings.settings, options);
  }

  /** @override */
  getData() {
    const data = super.getData();
    data.intro = `<h2>${game.i18n.localize(`TWODSIX.Settings.settingsInterface.displaySettings.intro`)}</h2><br>`;
    return data;
  }

  static registerSettings(): string[] {

    const settings: string[] = [];
    settings.push(booleanSetting('defaultTokenSettings', true));
    settings.push(booleanSetting('useSystemDefaultTokenIcon', false));
    settings.push(booleanSetting('showMissingCompendiumWarnings', true));
    settings.push(booleanSetting('showSingleComponentColumn', false));
    settings.push(booleanSetting('useFoundryStandardStyle', false, false, 'world', refreshWindow));
    settings.push(booleanSetting('useWoundedStatusIndicators', false));
    settings.push(booleanSetting('useEncumbranceStatusIndicators', false));
    settings.push(booleanSetting('showWeightUsage', false));
    settings.push(booleanSetting('usePDFPagerForRefs', false));
    settings.push(booleanSetting('showIcons', false));
    settings.push(booleanSetting('useEncumbrance', false));
    settings.push(booleanSetting('showStatusIcons', true));
    settings.push(booleanSetting('showRangeSpeedNoUnits', false));
    settings.push(booleanSetting('showInitiativeButton', false));
    settings.push(booleanSetting('showSkillCountsRanks', true));
    settings.push(booleanSetting('showComponentSummaryIcons', false));
    settings.push(booleanSetting('showSpells', false));
    settings.push(booleanSetting('showModifierDetails', false));
    settings.push(booleanSetting('showFeaturesInChat', false));
    settings.push(colorSetting('defaultColor', "#29aae1", "Color", false, 'world', changeDefaultColor));
    settings.push(colorSetting('lightColor', "#00e5ff", "Color", false, 'world', changeLightColor));
    settings.push(booleanSetting('showHitsChangesInChat', false));
    return settings;
  }
}
export const refreshWindow = function () {
  /*switchCss();*/
  window.location.reload();
};

export const changeDefaultColor = function () {
  if (game.settings.get('twodsix', 'defaultColor') === "") {
    game.settings.set('twodsix', 'defaultColor', "#29aae1");
  }
  document.documentElement.style.setProperty('--s2d6-default-color',  game.settings.get('twodsix', 'defaultColor'));
};

export const changeLightColor = function () {
  if (game.settings.get('twodsix', 'lightColor') === "") {
    game.settings.set('twodsix', 'lightColor', "#00e5ff");
  }
  document.documentElement.style.setProperty('--s2d6-light-color', game.settings.get('twodsix', 'lightColor'));
};
