import AdvancedSettings from "./AdvancedSettings";
import {booleanSetting} from "./settingsUtils";

export default class ItemSettings extends AdvancedSettings {
  static create() {
    ItemSettings.settings = ItemSettings.registerSettings();
    return ItemSettings;
  }

  constructor(object, options?) {
    super(object, ItemSettings.settings, options);
  }

  /** @override */
  getData() {
    const data = super.getData();
    data.intro = `<h2>${game.i18n.localize(`TWODSIX.Settings.settingsInterface.itemSettings.intro`)}</h2><br>`;
    return data;
  }

  static registerSettings(): string[] {
    const settings: string[] = [];
    settings.push(booleanSetting('ShowLawLevel', false));
    settings.push(booleanSetting('ShowRangeBandAndHideRange', false));
    settings.push(booleanSetting('ShowWeaponType', false));
    settings.push(booleanSetting('ShowDamageType', false));
    settings.push(booleanSetting('ShowRateOfFire', true));
    settings.push(booleanSetting('ShowRecoil', false));
    settings.push(booleanSetting('addEffectToManualDamage', false));
    settings.push(booleanSetting('showComponentRating', true));
    settings.push(booleanSetting('showComponentDM', true));
    return settings;
  }
}
