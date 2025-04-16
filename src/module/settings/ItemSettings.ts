// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
import AdvancedSettings from "./AdvancedSettings";
import {booleanSetting, stringSetting} from "./settingsUtils";

export default class ItemSettings extends foundry.applications.api.HandlebarsApplicationMixin(AdvancedSettings) {
  static create() {
    ItemSettings.settings = ItemSettings.registerSettings();
    return ItemSettings;
  }

  constructor(object, options?) {
    super(object, ItemSettings.settings, options);
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
      title: "TWODSIX.Settings.settingsInterface.itemSettings.name",
      icon: "fa-solid fa-bars"
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
    primary: "weapon"  //set default tab
  };

  /** @override */
  async _prepareContext(options): any {
    const context: any = await super._prepareContext(options);
    //context.intro = `<h2>${game.i18n.localize(`TWODSIX.Settings.settingsInterface.itemSettings.intro`)}</h2><br>`;
    context.tabs = this.getTabs(ItemSettings.settings, this.tabGroups.primary);
    return context;
  }

  static registerSettings(): any {
    const settings = {
      weapon: [],
      ship: []
    };
    settings.weapon.push(booleanSetting('ShowLawLevel', false));
    settings.weapon.push(booleanSetting('ShowWeaponType', false));
    settings.weapon.push(booleanSetting('ShowDamageType', false));
    settings.weapon.push(booleanSetting('ShowRateOfFire', true));
    settings.weapon.push(booleanSetting('ShowRecoil', false));
    settings.weapon.push(booleanSetting('ShowDoubleTap', false));
    settings.weapon.push(stringSetting('defaultWeaponDamage', "1d6", false));
    settings.weapon.push(booleanSetting('autoTargetAOE', false));
    settings.ship.push(booleanSetting('showComponentRating', true));
    settings.ship.push(booleanSetting('showComponentDM', true));
    return settings;
  }
}
