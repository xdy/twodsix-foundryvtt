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
    settings.push(stringSetting('systemMigrationVersion', game.system.data.version));
    settings.push(booleanSetting('useModuleFixStyle', false, false, 'world', refreshWindow));
    settings.push(booleanSetting('useShipAutoCalcs', false));
    return settings;
  }
}
