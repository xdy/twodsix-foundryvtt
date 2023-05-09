import AdvancedSettings from "./AdvancedSettings";
import {booleanSetting, stringSetting} from "./settingsUtils";
import {refreshWindow} from "./DisplaySettings";
import {applyToAllActors} from "../utils/migration-utils";

export default class DebugSettings extends AdvancedSettings {
  static create() {
    DebugSettings.settings = DebugSettings.registerSettings();
    return DebugSettings;
  }

  constructor(object, options) {
    super(object, DebugSettings.settings, options);
  }

  /** @override */
  getData() {
    const data = super.getData();
    data.intro = `<h2>${game.i18n.localize(`TWODSIX.Settings.settingsInterface.debugSettings.intro`)}</h2><br>`;
    return data;
  }

  static registerSettings() {
    const settings = [];
    settings.push(booleanSetting('ExperimentalFeatures', false));
    settings.push(stringSetting('systemMigrationVersion', game.system.version));
    settings.push(booleanSetting('useModuleFixStyle', false, false, 'world', refreshWindow));
    settings.push(booleanSetting('useShipAutoCalcs', false, false, 'world', refreshWindow));
    settings.push(booleanSetting('useProseMirror', false));
    settings.push(booleanSetting('allowDropOnIcon', false));
    settings.push(booleanSetting('allowDragDropOfLists', false));
    settings.push(booleanSetting('useItemActiveEffects', false, false, 'world', deactivateActorAE));
    return settings;
  }
}

async function deactivateActorAE() {
  if (!game.settings.get('twodsix', 'useItemActiveEffects')) {
    await applyToAllActors(deleteSystemAE);
  }
}

async function deleteSystemAE(actor) {
  actor.deleteCustomAEs();
}
