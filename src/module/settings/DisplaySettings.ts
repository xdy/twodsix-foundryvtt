// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
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

  static registerSettings(): any {

    const settings = {
      general: [],
      token: [],
      actor: [],
      ship: []
    };
    settings.token.push(booleanSetting('defaultTokenSettings', true));
    settings.token.push(booleanSetting('useSystemDefaultTokenIcon', false));
    settings.ship.push(booleanSetting('showSingleComponentColumn', false));
    settings.ship.push(booleanSetting('showBandwidth', false));
    settings.general.push(booleanSetting('useFoundryStandardStyle', false, false, 'world', refreshWindow));
    settings.actor.push(booleanSetting('useWoundedStatusIndicators', false));
    settings.actor.push(booleanSetting('useEncumbranceStatusIndicators', false));
    settings.ship.push(booleanSetting('showWeightUsage', false));
    settings.general.push(booleanSetting('showActorReferences', true));
    settings.general.push(booleanSetting('usePDFPagerForRefs', false));
    settings.actor.push(booleanSetting('showIcons', false));
    settings.actor.push(booleanSetting('useEncumbrance', false));
    settings.actor.push(booleanSetting('showStatusIcons', true));
    settings.actor.push(booleanSetting('showRangeSpeedNoUnits', false));
    settings.actor.push(booleanSetting('showInitiativeButton', false));
    settings.actor.push(booleanSetting('showSkillCountsRanks', true));
    settings.ship.push(booleanSetting('showComponentSummaryIcons', false));
    settings.actor.push(booleanSetting('showSpells', false));
    settings.general.push(booleanSetting('showModifierDetails', false));
    settings.general.push(booleanSetting('showFeaturesInChat', false));
    settings.general.push(colorSetting('defaultColor', "#29aae1", "Color", false, 'world', changeDefaultColor));
    settings.general.push(colorSetting('lightColor', "#00e5ff", "Color", false, 'world', changeLightColor));
    settings.general.push(booleanSetting('showHitsChangesInChat', false));
    settings.token.push(booleanSetting('reduceStatusIcons', false, false, "world", updateStatusIcons));
    settings.general.push(booleanSetting('useTabbedViews', false));
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

export const updateStatusIcons = function () {
  if (game.settings.get('twodsix', 'reduceStatusIcons')) {
    CONFIG.statusEffects = CONFIG.statusEffects.filter( (se) => ["dead", "unconscious", "stun", "sleep", "prone", "restrain", "paralysis", "fly", "blind", "corrode", "burning", "poison",
      "invisible", "target", "encumbered", "wounded", "aiming", "fatigued", "cover", "thrust", "irradiated", "target-lock"].includes(se.id));
  } else {
    window.location.reload();
  }
};
