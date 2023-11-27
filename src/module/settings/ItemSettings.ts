// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.
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
    settings.ship.push(booleanSetting('showComponentRating', true));
    settings.ship.push(booleanSetting('showComponentDM', true));
    return settings;
  }
}
