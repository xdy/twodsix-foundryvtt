// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import AdvancedSettings from "./AdvancedSettings";
import {booleanSetting, colorSetting, stringChoiceSetting, stringSetting, numberSetting, arrayChoiceSetting} from "./settingsUtils";
import {TWODSIX} from "../config";

export default class DisplaySettings extends foundry.applications.api.HandlebarsApplicationMixin(AdvancedSettings) {
  static create() {
    DisplaySettings.settings = DisplaySettings.registerSettings();
    return DisplaySettings;
  }

  constructor(object, options?) {
    super(object, DisplaySettings.settings, options);
  }

  /** @override */
  static DEFAULT_OPTIONS =  {
    classes: ["twodsix"],
    position: {
      width: 675,
      height: 'auto'
    },
    window: {
      resizable: true,
      contentClasses: ["standard-form"],
      title: "TWODSIX.Settings.settingsInterface.displaySettings.name",
      icon: "fa-solid fa-tv"
    },
    form: {
      handler: AdvancedSettings.onSubmit,
      closeOnSubmit: true,
      submitOnChange: false,
      submitOnClose: false
    },
    tag: "form"
  };

  static PARTS = {
    main: {
      template: "systems/twodsix/templates/misc/advanced-settings.hbs",
      scrollable: ['']
    }
  };

  /** @override */
  tabGroups = {
    primary: "general"  //set default tab
  };

  /** @override */
  async _prepareContext(options): any {
    const context: any = await super._prepareContext(options);
    //context.intro = `<h2>${game.i18n.localize(`TWODSIX.Settings.settingsInterface.displaySettings.intro`)}</h2>`;
    context.tabs = this.getTabs(DisplaySettings.settings, this.tabGroups.primary);
    return context;
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
    settings.general.push(colorSetting('damageStatColor', "#b52c2c", "Color", false, 'world', changeDamageColor));
    settings.general.push(colorSetting('battleColor', "#29aae1", "Color", false, 'world', changeBattleColor));
    settings.general.push(booleanSetting('showHitsChangesInChat', false));
    settings.token.push(booleanSetting('reduceStatusIcons', false, false, "world", updateStatusIcons));
    settings.general.push(booleanSetting('useTabbedViews', false));
    settings.actor.push(booleanSetting('showAllCharWithTable', true));
    settings.general.push(booleanSetting('showTLonItemsTab', false, false, 'world', setDocumentPartials));
    settings.actor.push(booleanSetting('omitPSIifZero', false));
    settings.actor.push(booleanSetting('omitALTifZero', false));
    settings.actor.push(stringChoiceSetting('equippedToggleStates', "default", true, TWODSIX.EQUIPPED_TOGGLE_OPTIONS));
    settings.actor.push(booleanSetting('showSkillGroups', false));
    settings.ship.push(stringSetting('jDriveLabel', "TWODSIX.Ship.JDrive", false, "world", updateJDrive, true));
    settings.ship.push(booleanSetting('showCost', false));
    settings.actor.push(booleanSetting('showTotalArmor', false));
    settings.general.push(booleanSetting('showItemIconsInChat', true));
    settings.actor.push(numberSetting('defaultActorSheetWidth', 915, false, 'world', refreshWindow));
    settings.actor.push(numberSetting('defaultActorSheetHeight', 718, false, 'world', refreshWindow));
    /*settings.actor.push(booleanSetting('showAttachmentsList', false));
    settings.actor.push(booleanSetting('showConsumablesList', false));*/
    settings.ship.push(booleanSetting('showCombatPosition', false));
    settings.ship.push(booleanSetting('showCommonFundsMCr', true));
    const nonCargoTypes = foundry.utils.duplicate(TWODSIX.ComponentTypes);
    delete nonCargoTypes.cargo;
    settings.ship.push(arrayChoiceSetting('componentsIgnored', [], true, nonCargoTypes));
    settings.token.push(booleanSetting('showMovementColors', false));
    settings.actor.push(booleanSetting('showTraitAE', true));
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

export const changeBattleColor = function () {
  if (game.settings.get('twodsix', 'battleColor') === "") {
    game.settings.set('twodsix', 'battleColor', "#29aae1");
  }
  document.documentElement.style.setProperty('--s2d6-battle-color',  game.settings.get('twodsix', 'battleColor'));
};

export const changeLightColor = function () {
  if (game.settings.get('twodsix', 'lightColor') === "") {
    game.settings.set('twodsix', 'lightColor', "#00e5ff");
  }
  document.documentElement.style.setProperty('--s2d6-light-color', game.settings.get('twodsix', 'lightColor'));
};

export const changeDamageColor = function () {
  if (game.settings.get('twodsix', 'damageStatColor') === "") {
    game.settings.set('twodsix', 'damageStatColor', "#b52c2c");
  }
  document.documentElement.style.setProperty('--s2d6-damage-stat-color', game.settings.get('twodsix', 'damageStatColor'));
};

export const updateStatusIcons = function () {
  if (game.settings.get('twodsix', 'reduceStatusIcons')) {
    CONFIG.statusEffects = CONFIG.statusEffects.filter( (se) => ["dead", "unconscious", "stun", "sleep", "prone", "restrain", "paralysis", "fly", "blind", "corrode", "burning", "poison",
      "invisible", "target", "encumbered", "wounded", "aiming", "fatigued", "cover", "thrust", "irradiated", "target-lock"].includes(se.id));
  } else {
    window.location.reload();
  }
};

export const setDocumentPartials = function () {
  if (game.settings.get('twodsix', 'showTLonItemsTab')) {
    foundry.applications.sidebar.tabs.ItemDirectory._entryPartial = 'systems/twodsix/templates/misc/revised-document-partial.hbs';
    foundry.applications.sidebar.apps.Compendium._entryPartial = 'systems/twodsix/templates/misc/revised-compendium-index-partial.hbs';
  } else {
    foundry.applications.sidebar.tabs.ItemDirectory._entryPartial = game.settings.get('twodsix', 'defaultItemPartial');
    foundry.applications.sidebar.apps.Compendium._entryPartial = game.settings.get('twodsix', 'defaultCompendiumPartial');
  }
  ui.items.render();
};

export const updateJDrive = function (value) {
  if (value === "") {
    game.settings.set('twodsix', 'jDriveLabel', "TWODSIX.Ship.JDrive");
  }
};
