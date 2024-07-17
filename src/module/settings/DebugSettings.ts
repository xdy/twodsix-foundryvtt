// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck This turns off *all* typechecking, make sure to remove this once foundry-vtt-types are updated to cover v10.

import AdvancedSettings from "./AdvancedSettings";
import {booleanSetting, stringSetting} from "./settingsUtils";
import {refreshWindow} from "./DisplaySettings";
import { applyToAllActors, applyToAllItems } from "../utils/migration-utils";
import TwodsixActor from "../entities/TwodsixActor";
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

  static registerSettings(): any {
    const settings = {
      general: [],
      style: [],
      dragDrop: []
    };
    settings.general.push(booleanSetting('ExperimentalFeatures', false));
    settings.general.push(stringSetting('systemMigrationVersion', game.system.version));
    settings.style.push(booleanSetting('useModuleFixStyle', false, false, 'world', refreshWindow));
    settings.general.push(booleanSetting('useShipAutoCalcs', false, false, 'world', refreshWindow));
    settings.style.push(booleanSetting('useProseMirror', false));
    settings.dragDrop.push(booleanSetting('allowDropOnIcon', false));
    settings.dragDrop.push(booleanSetting('allowDragDropOfListsActor', false));
    settings.dragDrop.push(booleanSetting('allowDragDropOfListsShip', false));
    settings.general.push(booleanSetting('useItemActiveEffects', false, false, 'world', deactivateActorAE));
    return settings;
  }
}

async function deactivateActorAE () {
  await applyToAllActors(toggleActorItemAEs);
  await applyToAllItems(toggleItemAEs);
}

async function toggleActorItemAEs(actor: TwodsixActor): Promise<void> {
  for ( const item of actor.items) {
    await toggleItemAEs(item);
  }
}

async function toggleItemAEs(item:TwodsixItem): Promise<void> {
  for ( const effect of item.effects.contents ) {
    if ( effect.transfer !== game.settings.get('twodsix', 'useItemActiveEffects') ) {
      await effect.update({"transfer": game.settings.get('twodsix', 'useItemActiveEffects')});
    }
  }
}
