// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import AdvancedSettings from "./AdvancedSettings";
import {booleanSetting, stringSetting} from "./settingsUtils";
import {refreshWindow} from "./DisplaySettings";

export default class DebugSettings extends AdvancedSettings {
  static create() {
    DebugSettings.settings = DebugSettings.registerSettings();
    return DebugSettings;
  }

  constructor(object, options?) {
    super(object, DebugSettings.settings, options);
  }

  /** @override */
  getData() {
    const data = super.getData();
    data.intro = `<h2>${game.i18n.localize(`TWODSIX.Settings.settingsInterface.debugSettings.intro`)}</h2><br>`;
    return data;
  }

  static registerSettings(): string[] {
    const settings: string[] = [];
    settings.push(booleanSetting('ExperimentalFeatures', false));
    settings.push(stringSetting('systemMigrationVersion', game.system.version));
    settings.push(booleanSetting('useModuleFixStyle', false, false, 'world', refreshWindow));
    settings.push(booleanSetting('useShipAutoCalcs', false, false, 'world', refreshWindow));
    settings.push(booleanSetting('useProseMirror', false));
    settings.push(booleanSetting('allowDropOnIcon', false));
    return settings;
  }
}
